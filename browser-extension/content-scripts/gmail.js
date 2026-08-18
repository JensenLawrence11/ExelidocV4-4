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
    <button class="exelidoc-undo" hidden>Undo</button>
    <div class="exelidoc-status"></div>
  `;

  const queryEl = panel.querySelector(".exelidoc-query");
  const submitEl = panel.querySelector(".exelidoc-submit");
  const undoEl = panel.querySelector(".exelidoc-undo");
  const statusEl = panel.querySelector(".exelidoc-status");
  const panelHeader = panel.querySelector(".exelidoc-panel-header");

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
  });

  panel.addEventListener("pointerup", () => {
    dragState = null;
  });

  panel.addEventListener("pointerleave", () => {
    dragState = null;
  });

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
          statusEl.textContent = "No changes suggested.";
          return;
        }

        preEditSnapshot = {
          html: activeBox.innerHTML,
          text: activeBox.innerText || "",
        };
        applyEditToBox(activeBox, corrected);
        undoEl.hidden = false;
      }
    );
  });

  undoEl.addEventListener("click", () => {
    if (activeBox && preEditSnapshot) {
      activeBox.focus();
      if (preEditSnapshot.html !== undefined) {
        activeBox.innerHTML = preEditSnapshot.html;
      } else {
        activeBox.textContent = preEditSnapshot.text || "";
      }
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

function applyEditToBox(box, corrected) {
  if (!box) return;
  box.focus();

  const existingText = (box.innerText || "").trim();
  if (existingText) {
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, corrected);
    return;
  }

  box.innerHTML = "";
  document.execCommand("insertText", false, corrected);
}

const observer = new MutationObserver(() => {
  findComposeBoxes().forEach(attachToComposeBox);

  if (activeBox && activePanel && document.body.contains(activeBox) && activePanel.dataset.userMoved !== "true") {
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