// T4H Widget Dock — Service Worker
import { checkEntitlements } from './lib/auth.js';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ installed: Date.now(), version: '0.1.0' });
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});
