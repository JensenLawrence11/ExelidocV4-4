const input = document.getElementById("api-key-input");
const status = document.getElementById("status");

chrome.storage.sync.get(["apiKey"], (result) => {
  if (result.apiKey) {
    input.value = result.apiKey;
    status.textContent = "Active on Gmail and Google Docs.";
  } else {
    status.textContent = "No API key set -- suggestions are paused.";
  }
});

document.getElementById("save-btn").addEventListener("click", () => {
  const apiKey = input.value.trim();
  chrome.storage.sync.set({ apiKey }, () => {
    status.textContent = apiKey ? "Saved. Active on Gmail and Google Docs." : "No API key set -- suggestions are paused.";
  });
});
