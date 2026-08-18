let activePanel = null;
let activeBox = null;
let preEditSnapshot = null;

function findComposeBoxes() {
  return document.querySelectorAll('div[contenteditable="true"][role="textbox"]');
}

function attachToComposeBox(box) {
  if (box.dataset.exelidocAttached) return;
  box.dataset.exelidocAttached = "true";

  box.addEventListener("focus", () => setActiveBox(box));

  // if this box gets removed from the DOM (draft closed/sent), and it was
  // the active one, tear the panel down
  const removalObserver = new MutationObserver(() => {
    if (!document.body.contains(box)) {
      removalObserver.disconnect();
      if (activeBox === box) setActiveBox(null);
    }
  });
  removalObserver.observe(document.body, { childList: true, subtree: true });
}

function setActiveBox(box) {
  activeBox = box;
  preEditSnapshot = null;

  if (!box) {
    if (activePanel) activePanel.style.display = "none";
    return;
  }

  if (!activePanel) activePanel = createExelidocPanel();
  resetPanelState(activePanel);
  activePanel.style.display = "flex";
  positionPanel(activePanel, box);
}

function positionPanel(panel, box) {
  const rect = box.getBoundingClientRect();
  const panelWidth = 280; // keep in sync with CSS width
  panel.style.top = `${window.scrollY + rect.top}px`;
  panel.style.left = `${window.scrollX + rect.left - panelWidth - 12}px`;
}

function createExelidocPanel() {
  const panel = document.createElement("div");
  panel.className = "exelidoc-panel";
  panel.innerHTML = `
    <div class="exelidoc-panel-header">Exelidoc</div>
    <textarea class="exelidoc-query" placeholder="e.g. make this more formal, fix grammar, shorten it... or write a new email from scratch"></textarea>
    <button class="exelidoc-submit">Ask</button>
    <div class="exelidoc-result" hidden>
      <div class="exelidoc-result-text"></div>
      <button class="exelidoc-undo">Undo</button>
    </div>
    <div class="exelidoc-status"></div>
  `;

  const queryEl = panel.querySelector(".exelidoc-query");
  const submitEl = panel.querySelector(".exelidoc-submit");
  const resultEl = panel.querySelector(".exelidoc-result");
  const resultTextEl = panel.querySelector(".exelidoc-result-text");
  const undoEl = panel.querySelector(".exelidoc-undo");
  const statusEl = panel.querySelector(".exelidoc-status");

  submitEl.addEventListener("click", () => {
    console.log("Exelidoc: Ask clicked", { activeBox, query: queryEl.value });
    if (!activeBox) return;
    const instruction = queryEl.value.trim();
    const text = (activeBox.innerText || "").trim();
    if (!instruction) { console.log("Exelidoc: empty instruction", { instruction, text }); return; }

    statusEl.textContent = "Thinking...";
    submitEl.disabled = true;

    chrome.runtime.sendMessage(
      { type: "ANALYZE_TEXT", text, instruction },
      (response) => {
        submitEl.disabled = false;
        if (chrome.runtime.lastError) {
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
        if (!activeBox) return; // user switched away while waiting

        statusEl.textContent = "";
        const suggestions = Array.isArray(response.data.suggestions) ? response.data.suggestions : [];
        const corrected = response.data.corrected || (suggestions[0] && suggestions[0].revised) || text;

        if (!corrected || corrected === text) {
          if (suggestions.length) {
            const preview = suggestions[0].revised || text;
            resultTextEl.textContent = preview;
            resultEl.hidden = false;
            statusEl.textContent = "Suggested rewrite ready.";
            return;
          }
          statusEl.textContent = "No changes suggested.";
          return;
        }

        preEditSnapshot = activeBox.innerHTML;
        applyEditToBox(activeBox, corrected);

        resultTextEl.textContent = corrected;
        resultEl.hidden = false;
      }
    );
  });

  undoEl.addEventListener("click", () => {
    if (activeBox && preEditSnapshot !== null) {
      activeBox.focus();
      activeBox.innerHTML = preEditSnapshot;
      preEditSnapshot = null;
    }
    resultEl.hidden = true;
    statusEl.textContent = "";
  });

  document.body.appendChild(panel);
  return panel;
}

function resetPanelState(panel) {
  panel.querySelector(".exelidoc-query").value = "";
  panel.querySelector(".exelidoc-result").hidden = true;
  panel.querySelector(".exelidoc-status").textContent = "";
}

function applyEditToBox(box, corrected) {
  if (!box) return;
  box.focus();

  const existingText = (box.innerText || "").trim();
  if (existingText) {
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, corrected);
    return;
  }

  document.execCommand("insertText", false, corrected);
}

const observer = new MutationObserver(() => {
  findComposeBoxes().forEach(attachToComposeBox);

  if (activeBox && activePanel && document.body.contains(activeBox)) {
    positionPanel(activePanel, activeBox);
  }
});
observer.observe(document.body, { childList: true, subtree: true });

document.addEventListener("focusin", (event) => {
  if (!activeBox) return;

  const target = event.target;
  const withinBox = activeBox.contains(target);
  const withinPanel = activePanel && activePanel.contains(target);

  if (!withinBox && !withinPanel) {
    setActiveBox(null);
  }
});
observer.observe(document.body, { childList: true, subtree: true });