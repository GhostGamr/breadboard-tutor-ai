// Only the local dashboard may request a lesson launch.
if (
  [
    'http://127.0.0.1:8787',
    'http://localhost:8787',
    'http://127.0.0.1:5173',
    'http://localhost:5173',
  ].includes(location.origin)
) {
  document.documentElement.dataset.breadboardExtension = chrome.runtime.id;
}
