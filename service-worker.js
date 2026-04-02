
// Snaps by T4H — Service Worker v1.0
import { createSnap, retryQueue } from './lib/api.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ installed: Date.now(), version: '1.0.0' });

  chrome.contextMenus.create({
    id: 'snap-tab',
    title: 'Snap this tab to T4H',
    contexts: ['page', 'link', 'selection']
  });
  chrome.contextMenus.create({
    id: 'snap-selection',
    title: 'Snap selection to T4H',
    contexts: ['selection']
  });
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

// Single click = snap. Long intention = panel.
chrome.action.onClicked.addListener(async (tab) => {
  try {
    const result = await createSnap({
      url:      tab.url,
      title:    tab.title,
      mode:     'capture_classify',
      windowId: tab.windowId,
      tabId:    tab.id,
      tabIndex: tab.index,
      favicon:  tab.favIconUrl
    });
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Snapped ✓',
      message: tab.title?.slice(0, 60) || tab.url?.slice(0, 60)
    });
    chrome.storage.local.set({ last_snap: { ...result, title: tab.title, url: tab.url, at: Date.now() } });
  } catch (err) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Snap queued (offline)',
      message: 'Will retry when online.'
    });
  }
});

// Context menu
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const selectedText = info.selectionText || null;
  const url = info.linkUrl || tab.url;
  try {
    await createSnap({
      url, title: tab.title, selectedText,
      mode: 'capture_classify',
      windowId: tab.windowId, tabId: tab.id, tabIndex: tab.index, favicon: tab.favIconUrl
    });
  } catch {}
});

// Keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'quick-snap') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    try {
      await createSnap({
        url: tab.url, title: tab.title, mode: 'capture_classify',
        windowId: tab.windowId, tabId: tab.id, tabIndex: tab.index, favicon: tab.favIconUrl
      });
    } catch {}
  }

  if (command === 'dump-window') {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    for (const tab of tabs) {
      try {
        await createSnap({
          url: tab.url, title: tab.title, mode: 'capture_classify',
          windowId: tab.windowId, tabId: tab.id, tabIndex: tab.index, favicon: tab.favIconUrl
        });
      } catch {}
    }
    chrome.notifications.create({
      type: 'basic', iconUrl: 'icons/icon48.png',
      title: `Window dumped ✓`,
      message: `${tabs.length} tabs sent to Snaps.`
    });
  }
});

// Retry queue every 5 minutes
chrome.alarms.create('retry-queue', { periodInMinutes: 5 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'retry-queue') {
    await retryQueue();
  }
});

// Message from popup/sidepanel
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'snap') {
    createSnap(msg.payload)
      .then(r => sendResponse({ success: true, result: r }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }
  if (msg.action === 'dump-window') {
    chrome.tabs.query({ currentWindow: true }).then(async (tabs) => {
      let ok = 0;
      for (const tab of tabs) {
        try { await createSnap({ url: tab.url, title: tab.title, mode: 'capture_classify', windowId: tab.windowId, tabId: tab.id, tabIndex: tab.index, favicon: tab.favIconUrl }); ok++; } catch {}
      }
      sendResponse({ success: true, count: ok });
    });
    return true;
  }
  if (msg.action === 'open-panel') {
    chrome.sidePanel.open({ tabId: sender.tab?.id }).catch(() => {});
    sendResponse({ success: true });
    return true;
  }
});
