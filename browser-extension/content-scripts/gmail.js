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
    <textarea class="exelidoc-query" placeholder="e.g. make this more formal, fix grammar, shorten it..."></textarea>
    <button class="exelidoc-submit">Ask</button>
    <div class="exelidoc-result" hidden>
      <div class="exelidoc-result-text"></div>
      <button class="exelidoc-keep">Keep</button>
      <button class="exelidoc-undo">Undo</button>
    </div>
    <div class="exelidoc-status"></div>
  `;

  const queryEl = panel.querySelector(".exelidoc-query");
  const submitEl = panel.querySelector(".exelidoc-submit");
  const resultEl = panel.querySelector(".exelidoc-result");
  const resultTextEl = panel.querySelector(".exelidoc-result-text");
  const keepEl = panel.querySelector(".exelidoc-keep");
  const undoEl = panel.querySelector(".exelidoc-undo");
  const statusEl = panel.querySelector(".exelidoc-status");

  submitEl.addEventListener("click", () => {
    if (!activeBox) return;
    const instruction = queryEl.value.trim();
    const text = activeBox.innerText;
    if (!instruction || !text.trim()) return;

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
        if (!activeBox) return; // user switched away while waiting

        statusEl.textContent = "";
        const corrected = response.data.corrected;
        if (!corrected || corrected === text) {
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

  keepEl.addEventListener("click", () => {
    preEditSnapshot = null;
    resultEl.hidden = true;
    queryEl.value = "";
  });

  undoEl.addEventListener("click", () => {
    if (activeBox && preEditSnapshot !== null) {
      activeBox.focus();
      document.execCommand("selectAll", false, null);
      document.execCommand("insertHTML", false, preEditSnapshot);
      preEditSnapshot = null;
    }
    resultEl.hidden = true;
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
  box.focus();
  document.execCommand("selectAll", false, null);
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