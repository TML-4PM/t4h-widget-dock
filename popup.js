document.getElementById('open-panel').addEventListener('click', () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.sidePanel.open({ tabId: tabs[0].id });
    window.close();
  });
});

document.getElementById('open-options').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

chrome.storage.local.get(['widgets_count', 'last_sync'], (data) => {
  const status = document.getElementById('status');
  if (data.widgets_count) {
    status.textContent = `${data.widgets_count} widgets loaded · ${data.last_sync ? 'synced' : 'not synced'}`;
  } else {
    status.textContent = 'Sign in to load your widgets';
  }
});
