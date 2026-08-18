let activePanel = null;
let activeBox = null;
let preEditSnapshot = null;
let docsLauncher = null;

function findFirstEditableElement(root) {
  if (!root) return null;

  const selectors = [
    '.kix-appview-editor[contenteditable="true"]',
    '[role="textbox"][contenteditable="true"]',
    'div[contenteditable="true"]',
    '[contenteditable="true"]',
  ];

  for (const selector of selectors) {
    const el = root.querySelector(selector);
    if (el) return el;
  }

  const active = root.activeElement;
  if (active && active.isContentEditable) return active;

  return null;
}

function getDocsEditor() {
  const directEditor = findFirstEditableElement(document);
  if (directEditor) return directEditor;

  const frames = Array.from(document.querySelectorAll('iframe'));
  for (const frame of frames) {
    try {
      const doc = frame.contentDocument || frame.contentWindow?.document;
      const found = doc ? findFirstEditableElement(doc) : null;
      if (found) return found;
    } catch (err) {
      // cross-origin frames cannot be read; ignore and continue
    }
  }

  const allContentEditable = document.querySelectorAll('[contenteditable="true"]');
  if (allContentEditable.length) return allContentEditable[0];

  return null;
}

function ensureDocsLauncher() {
  if (docsLauncher || !document.body) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "exelidoc-docs-launcher";
  button.textContent = "Exelidoc";
  button.setAttribute("aria-label", "Open Exelidoc panel");
  button.addEventListener("click", () => {
    const editor = getDocsEditor();
    if (!activePanel) activePanel = createExelidocPanel();
    if (editor) {
      setActiveBox(editor);
    } else {
      activePanel.style.display = "flex";
    }
  });

  document.body.appendChild(button);
  docsLauncher = button;
}

function captureComposeSnapshot(box) {
  if (!box) return null;

  return {
    html: box.innerHTML,
    text: box.textContent || box.innerText || "",
  };
}

function setComposeText(box, value) {
  if (!box) return;

  box.focus();
  box.innerHTML = "";
  box.textContent = value || "";

  if (typeof InputEvent !== "undefined") {
    box.dispatchEvent(new InputEvent("input", { bubbles: true, data: value || "" }));
  }
  box.dispatchEvent(new Event("change", { bubbles: true }));
}

function restoreComposeSnapshot(box, snapshot) {
  if (!box || !snapshot) return;

  box.focus();

  if (snapshot.html !== undefined && snapshot.html !== null) {
    box.innerHTML = snapshot.html;
  } else {
    box.textContent = snapshot.text || "";
  }

  if (typeof InputEvent !== "undefined") {
    box.dispatchEvent(new InputEvent("input", { bubbles: true, data: snapshot.text || "" }));
  }
  box.dispatchEvent(new Event("change", { bubbles: true }));
}

function setActiveBox(box) {
  const sameBox = activeBox === box;
  activeBox = box;

  if (!box) {
    preEditSnapshot = null;
    if (activePanel) activePanel.style.display = "none";
    return;
  }

  if (!sameBox) {
    preEditSnapshot = null;
  }

  if (!activePanel) activePanel = createExelidocPanel();
  resetPanelState(activePanel);
  activePanel.style.display = "flex";
  positionPanel(activePanel, box);
}

function positionPanel(panel, box) {
  if (!panel) return;
  panel.classList.add("docs-mode");
  panel.style.top = "72px";
  panel.style.right = "22px";
  panel.style.left = "auto";
  panel.style.zIndex = "2147483647";
}

function createExelidocPanel() {
  const panel = document.createElement("div");
  panel.className = "exelidoc-panel docs-mode";
  panel.innerHTML = `
    <div class="exelidoc-panel-header">
      <span>Exelidoc</span>
      <button type="button" class="exelidoc-close" aria-label="Close Exelidoc panel">×</button>
    </div>
    <textarea class="exelidoc-query" placeholder="e.g. write a section, rewrite this, make it more concise"></textarea>
    <button class="exelidoc-submit">Ask</button>
    <button class="exelidoc-undo" hidden>Undo</button>
    <div class="exelidoc-status"></div>
  `;

  const queryEl = panel.querySelector(".exelidoc-query");
  const submitEl = panel.querySelector(".exelidoc-submit");
  const undoEl = panel.querySelector(".exelidoc-undo");
  const statusEl = panel.querySelector(".exelidoc-status");
  const closeEl = panel.querySelector(".exelidoc-close");
  const panelHeader = panel.querySelector(".exelidoc-panel-header");

  closeEl.addEventListener("click", () => {
    if (activePanel) {
      activePanel.style.display = "none";
    }
  });

  let dragState = null;
  panelHeader.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, textarea")) return;
    dragState = {
      startX: event.clientX,
      startY: event.clientY,
      left: parseFloat(panel.style.left || "0") || 0,
      top: parseFloat(panel.style.top || "0") || 0,
    };
    panel.dataset.userMoved = "true";
    panel.setPointerCapture?.(event.pointerId);
  });

  panel.addEventListener("pointermove", (event) => {
    if (!dragState) return;
    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    panel.style.left = `${dragState.left + dx}px`;
    panel.style.top = `${dragState.top + dy}px`;
    panel.style.right = "auto";
  });

  panel.addEventListener("pointerup", () => {
    dragState = null;
  });

  panel.addEventListener("pointerleave", () => {
    dragState = null;
  });

  submitEl.addEventListener("click", () => {
    console.log("Exelidoc Docs: click", {
      activeBox,
      docEditor: getDocsEditor(),
      query: queryEl.value,
    });

    const editor = getDocsEditor();
    if (editor) {
      activeBox = editor;
    }
    if (!activeBox) {
      statusEl.textContent = "No editable doc found yet.";
      console.log("Exelidoc Docs: no editable target found");
      return;
    }

    const instruction = queryEl.value.trim();
    const text = (activeBox.innerText || "").trim();
    if (!instruction) return;

    console.log("Exelidoc Docs: sending request", { text, instruction });
    statusEl.textContent = "Thinking...";
    submitEl.disabled = true;

    chrome.runtime.sendMessage(
      { type: "ANALYZE_TEXT", text, instruction },
      (response) => {
        submitEl.disabled = false;
        console.log("Exelidoc Docs: background response", response);
        if (chrome.runtime.lastError) {
          console.log("Exelidoc Docs: runtime error", chrome.runtime.lastError.message);
          statusEl.textContent = "Extension reloaded — refresh this page.";
          return;
        }
        if (!response || !response.ok) {
          statusEl.textContent = `Error: ${response ? response.error : "no response"}`;
          return;
        }
        if (response.data && response.data.error) {
          statusEl.textContent = `Error: ${response.data.error}`;
          return;
        }
        if (!activeBox) return;

        statusEl.textContent = "";
        const suggestions = Array.isArray(response.data.suggestions) ? response.data.suggestions : [];
        const corrected = response.data.corrected || (suggestions[0] && suggestions[0].revised) || text;

        if (!corrected || corrected === text) {
          statusEl.textContent = "No changes suggested.";
          return;
        }

        preEditSnapshot = captureComposeSnapshot(activeBox);
        setComposeText(activeBox, corrected);
        undoEl.hidden = false;
      }
    );
  });

  undoEl.addEventListener("click", () => {
    if (activeBox && preEditSnapshot) {
      restoreComposeSnapshot(activeBox, preEditSnapshot);
      preEditSnapshot = null;
      undoEl.hidden = true;
      statusEl.textContent = "Restored previous draft.";
    }
  });

  document.body.appendChild(panel);
  return panel;
}

function resetPanelState(panel) {
  panel.querySelector(".exelidoc-query").value = "";
  panel.querySelector(".exelidoc-status").textContent = "";
  panel.querySelector(".exelidoc-undo").hidden = true;
  panel.dataset.userMoved = "false";
}

function initDocsPanel() {
  ensureDocsLauncher();

  const editor = getDocsEditor();
  if (!editor) {
    if (!activePanel) {
      activePanel = createExelidocPanel();
    }
    activePanel.style.display = "flex";
    return;
  }

  if (!activePanel) {
    activePanel = createExelidocPanel();
  }

  activeBox = editor;
  setActiveBox(editor);
  activePanel.style.display = "flex";

  if (editor.addEventListener) {
    editor.addEventListener("focus", () => setActiveBox(editor));
  }
}

const docsObserver = new MutationObserver(() => {
  if (!docsLauncher) {
    initDocsPanel();
    return;
  }

  const editor = getDocsEditor();
  if (editor && !activeBox) {
    setActiveBox(editor);
  }
});
docsObserver.observe(document.body, { childList: true, subtree: true });

if (document.body) {
  initDocsPanel();
}
