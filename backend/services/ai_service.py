"""
All actual AI-provider calls live here, isolated from the Flask route layer.
Swap providers or add fallback logic in one place without touching routes/ai.py.
"""
import json
import re

from anthropic import Anthropic
from config import Config

_client = None


def _get_client():
    global _client
    if _client is None:
        if not Config.ANTHROPIC_API_KEY:
            return None
        _client = Anthropic(api_key=Config.ANTHROPIC_API_KEY)
    return _client


def _extract_json(raw: str):
    """Models sometimes wrap JSON in ```json fences despite instructions not to -- strip them."""
    cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.MULTILINE)
    return json.loads(cleaned)


# ---------------------------------------------------------------------------
# Free text (Gmail, Google Docs, Word, Outlook)
# ---------------------------------------------------------------------------

TEXT_SYSTEM_PROMPT = (
    "You are a grammar and clarity editor, similar to Grammarly. Given a piece of text, "
    "fix grammar, spelling, punctuation, and awkward phrasing. Preserve the author's "
    "meaning, tone, and formatting (line breaks, etc). Do not add or remove content "
    "beyond what's needed for correctness and clarity.\n\n"
    "Respond with ONLY valid JSON, no other text, in this exact shape:\n"
    '{"corrected": "<the full corrected text>", '
    '"suggestions": [{"original": "<snippet>", "revised": "<snippet>", "reason": "<short reason>"}]}\n\n'
    "If the text needs no changes, return it unchanged with an empty suggestions list."
)


def analyze_text(text: str) -> dict:
    client = _get_client()
    if client is None:
        # No key configured yet -- dummy passthrough so the frontend can be built now.
        return {"corrected": text, "suggestions": []}

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            temperature=0,
            system=TEXT_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": text}],
        )
        raw = "".join(block.text for block in response.content if block.type == "text")
        parsed = _extract_json(raw)
        return {
            "corrected": parsed.get("corrected", text),
            "suggestions": parsed.get("suggestions", []),
        }
    except Exception as e:
        # Fail safe: never corrupt the user's text if the AI call or parsing breaks.
        print(f"analyze_text error: {e}")
        return {"corrected": text, "suggestions": []}


# ---------------------------------------------------------------------------
# Spreadsheet ranges (Excel)
# ---------------------------------------------------------------------------

RANGE_SYSTEM_PROMPT = (
    "You are a data-entry proofreader for spreadsheet cells. You will receive a JSON list "
    "of text cell values (formulas and pure numbers are filtered out before reaching you, "
    "so everything you see is free text). Fix obvious typos, inconsistent capitalization, "
    "extra whitespace, and inconsistent date/label formatting within a column's apparent "
    "pattern. Do not change values that already look correct. Do not invent data.\n\n"
    "Respond with ONLY valid JSON, no other text, in this exact shape:\n"
    '{"corrected": ["<value1>", "<value2>", ...], "notes": ["<short note about a change made>"]}\n\n'
    "The corrected array MUST have exactly the same number of elements, in the same order, "
    "as the input array. If nothing needs fixing, return the input unchanged with an empty notes list."
)


def _is_formula_or_number(cell) -> bool:
    if isinstance(cell, (int, float)):
        return True
    if isinstance(cell, str) and cell.strip().startswith("="):
        return True
    return False


def analyze_spreadsheet_range(values: list) -> dict:
    """
    Only text-looking cells are sent to the AI -- formulas and numbers pass
    through completely untouched. This is a deliberate safety choice: letting
    the AI guess at a formula or a number and auto-applying it is far riskier
    than a text label, since spreadsheet errors compound silently across
    dependent cells. If you want AI help on formulas/numbers later, build
    that as a separate, non-auto-apply, user-reviewed feature.
    """
    client = _get_client()
    if client is None:
        return {"correctedValues": values, "notes": []}

    # Flatten, remembering each editable cell's (row, col) position.
    positions = []
    editable_cells = []
    for r, row in enumerate(values):
        for c, cell in enumerate(row):
            if isinstance(cell, str) and cell.strip() and not _is_formula_or_number(cell):
                positions.append((r, c))
                editable_cells.append(cell)

    if not editable_cells:
        return {"correctedValues": values, "notes": []}

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            temperature=0,
            system=RANGE_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": json.dumps(editable_cells)}],
        )
        raw = "".join(block.text for block in response.content if block.type == "text")
        parsed = _extract_json(raw)
        corrected = parsed.get("corrected", editable_cells)
        notes = parsed.get("notes", [])

        if len(corrected) != len(editable_cells):
            # Model didn't follow the shape contract -- don't risk misaligned writes.
            return {"correctedValues": values, "notes": []}

        result = [row[:] for row in values]
        for (r, c), new_value in zip(positions, corrected):
            result[r][c] = new_value

        return {"correctedValues": result, "notes": notes}
    except Exception as e:
        print(f"analyze_spreadsheet_range error: {e}")
        return {"correctedValues": values, "notes": []}
