
const statusEl = document.getElementById('status');
const noteEl   = document.getElementById('note');

function setStatus(msg, type = '') {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (type ? ' ' + type : '');
}

document.getElementById('snap').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  setStatus('Snapping…');
  const resp = await chrome.runtime.sendMessage({
    action: 'snap',
    payload: {
      url: tab.url, title: tab.title, note: noteEl.value.trim(),
      mode: 'capture_classify', windowId: tab.windowId,
      tabId: tab.id, tabIndex: tab.index, favicon: tab.favIconUrl
    }
  });
  if (resp?.success) {
    setStatus('Snapped ✓', 'ok');
    noteEl.value = '';
    setTimeout(window.close, 900);
  } else {
    setStatus('Queued locally (offline)', 'err');
  }
});

document.getElementById('dump').addEventListener('click', async () => {
  setStatus('Dumping…');
  const resp = await chrome.runtime.sendMessage({ action: 'dump-window' });
  if (resp?.success) {
    setStatus(`${resp.count} tabs snapped ✓`, 'ok');
    setTimeout(window.close, 1200);
  } else {
    setStatus('Error', 'err');
  }
});

document.getElementById('panel').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.sidePanel.open({ tabId: tab.id });
  window.close();
});

// Show queue size if any
chrome.storage.local.get(['snap_retry_queue', 'last_snap'], (data) => {
  const q = data.snap_retry_queue || [];
  if (q.length > 0) setStatus(`${q.length} in retry queue`, 'err');
  else if (data.last_snap) {
    const ago = Math.round((Date.now() - data.last_snap.at) / 60000);
    setStatus(`Last snap: ${ago < 1 ? 'just now' : ago + 'm ago'}`);
  }
});
