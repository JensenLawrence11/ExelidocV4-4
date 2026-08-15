// Runs inside mail.google.com. Gmail has no official API for this, so this
// watches the compose box DOM directly -- similar to how Grammarly's
// extension works. This is a stub; fill in the real selectors/logic next.

// Gmail's compose body is a contenteditable div. Its selector can change
// with Gmail updates, so this needs to stay resilient (e.g. a MutationObserver
// watching for [contenteditable="true"][role="textbox"] appearing in the DOM).

function findComposeBoxes() {
  return document.querySelectorAll('div[contenteditable="true"][role="textbox"]');
}

function attachToComposeBox(box) {
  if (box.dataset.exelidocAttached) return;
  box.dataset.exelidocAttached = "true";

  // TODO: debounce this -- don't call the backend on every keystroke.
  box.addEventListener("blur", () => {
    const text = box.innerText;
    if (!text.trim()) return;

    try {
      chrome.runtime.sendMessage({ type: "ANALYZE_TEXT", text }, (response) => {
        // This callback fires asynchronously, on its own call stack -- the
        // outer try/catch below does NOT protect code in here. If the
        // extension context was invalidated between sendMessage() being
        // called and this callback actually firing, accessing
        // chrome.runtime.lastError itself can throw, so this needs its own
        // try/catch.
        try {
          if (chrome.runtime.lastError) {
            console.error("Exelidoc: message failed --", chrome.runtime.lastError.message);
            return;
          }
          if (response && response.ok) {
            // TODO: auto-apply -- replace box.innerText with response.data.corrected,
            // being careful to preserve cursor position and not fight the user
            // while they're actively typing.
            console.log("Exelidoc suggestion:", response.data);
          } else {
            console.error("Exelidoc: request failed --", response ? response.error : "no response");
          }
        } catch (err) {
          console.warn("Exelidoc: extension was reloaded -- refresh this page to keep using Exelidoc.");
        }
      });
    } catch (err) {
      // Covers the case where sendMessage() itself throws synchronously
      // (context already invalidated at call time).
      console.warn("Exelidoc: extension was reloaded -- refresh this page to keep using Exelidoc.");
    }
  });
}

const observer = new MutationObserver(() => {
  findComposeBoxes().forEach(attachToComposeBox);
});
observer.observe(document.body, { childList: true, subtree: true });
