// Snaps by T4H — Service Worker v1.1.0
// Added: ConsentX consent capture, badge count, Supabase sync
import { createSnap, retryQueue } from './lib/api.js';

const BRIDGE_URL = 'https://m5oqj21chd.execute-api.ap-southeast-2.amazonaws.com/lambda/invoke';
const BRIDGE_KEY = 'bk_tOH8P5WD3mxBKfICa4yI56vJhpuYOynfdf1d_GfvdK4';
const CX_VERSION = '1.1.0';

// ── CONSENT CAPTURE ──────────────────────────────────────────────────
async function captureConsentToWallet(event, walletHandle) {
  if (!walletHandle) {
    // Queue for when wallet is set up
    const queue = (await chrome.storage.local.get(['cx_capture_queue'])).cx_capture_queue || [];
    queue.push({ event, queued_at: Date.now() });
    await chrome.storage.local.set({ cx_capture_queue: queue });
    return { queued: true };
  }

  try {
    const resp = await fetch(BRIDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': BRIDGE_KEY },
      body: JSON.stringify({
        fn: 'troy-sql-executor',
        route: 'sql',
        sql: `SELECT public.fn_capture_consent(
          '${walletHandle.replace(/'/g,"''")}',
          '${event.domain.replace(/'/g,"''")}',
          '${(event.url || '').replace(/'/g,"''")}',
          '${(event.pageTitle || '').replace(/'/g,"''")}',
          '${(event.consent_type || 'Explicit').replace(/'/g,"''")}',
          '${(event.consent_label || event.domain).replace(/'/g,"''")}',
          '${event.sensitivity || 'medium'}',
          '${event.sector || 'platform'}',
          NULL, NULL, NULL
        ) as result`
      })
    });
    const data = await resp.json();
    return data.rows?.[0]?.result || { error: 'no result' };
  } catch (err) {
    // Queue on failure
    const queue = (await chrome.storage.local.get(['cx_capture_queue'])).cx_capture_queue || [];
    queue.push({ event, walletHandle, queued_at: Date.now() });
    await chrome.storage.local.set({ cx_capture_queue: queue });
    return { queued: true, error: err.message };
  }
}

async function drainCaptureQueue() {
  const { cx_capture_queue, cx_wallet_handle } = await chrome.storage.local.get(['cx_capture_queue','cx_wallet_handle']);
  if (!cx_capture_queue?.length || !cx_wallet_handle) return;
  const remaining = [];
  for (const item of cx_capture_queue) {
    const result = await captureConsentToWallet(item.event, cx_wallet_handle);
    if (result.queued) remaining.push(item);
  }
  await chrome.storage.local.set({ cx_capture_queue: remaining });
}

async function updateBadge() {
  const { cx_pending_count } = await chrome.storage.local.get(['cx_pending_count']);
  const count = cx_pending_count || 0;
  if (count > 0) {
    chrome.action.setBadgeText({ text: count > 99 ? '99+' : String(count) });
    chrome.action.setBadgeBackgroundColor({ color: '#9b4218' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// ── INSTALL ──────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ installed: Date.now(), version: CX_VERSION });

  chrome.contextMenus.create({ id: 'snap-tab',       title: 'Snap this tab to T4H',    contexts: ['page','link','selection'] });
  chrome.contextMenus.create({ id: 'snap-selection',  title: 'Snap selection to T4H',   contexts: ['selection'] });
  chrome.contextMenus.create({ id: 'cx-capture-page', title: 'Capture consent on page', contexts: ['page'] });
});

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {});

// ── CLICK ─────────────────────────────────────────────────────────────
chrome.action.onClicked.addListener(async (tab) => {
  try {
    const result = await createSnap({
      url: tab.url, title: tab.title, mode: 'capture_classify',
      windowId: tab.windowId, tabId: tab.id, tabIndex: tab.index, favicon: tab.favIconUrl
    });
    chrome.notifications.create({
      type: 'basic', iconUrl: 'icons/icon48.png',
      title: 'Snapped ✓', message: tab.title?.slice(0,60) || tab.url?.slice(0,60)
    });
    chrome.storage.local.set({ last_snap: { ...result, title: tab.title, url: tab.url, at: Date.now() } });
  } catch {
    chrome.notifications.create({ type:'basic', iconUrl:'icons/icon48.png', title:'Snap queued (offline)', message:'Will retry when online.' });
  }
});

// ── CONTEXT MENU ──────────────────────────────────────────────────────
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'snap-tab' || info.menuItemId === 'snap-selection') {
    try {
      await createSnap({ url: info.linkUrl||tab.url, title: tab.title, selectedText: info.selectionText||null,
        mode:'capture_classify', windowId:tab.windowId, tabId:tab.id, tabIndex:tab.index, favicon:tab.favIconUrl });
    } catch {}
  }
  if (info.menuItemId === 'cx-capture-page') {
    // Trigger scanner on the current page
    chrome.tabs.sendMessage(tab.id, { type: 'CX_SCAN_NOW' }, async (res) => {
      const detected = res?.detected || [];
      if (detected.length > 0) {
        const { cx_wallet_handle } = await chrome.storage.local.get(['cx_wallet_handle']);
        for (const event of detected) {
          await captureConsentToWallet(event, cx_wallet_handle);
        }
        chrome.notifications.create({
          type: 'basic', iconUrl: 'icons/icon48.png',
          title: `ConsentX — ${detected.length} event${detected.length>1?'s':''} captured`,
          message: detected.map(d => d.consent_label).join(', ').slice(0, 80)
        });
      } else {
        chrome.notifications.create({
          type: 'basic', iconUrl: 'icons/icon48.png',
          title: 'ConsentX — No events found',
          message: 'No consent events detected on this page.'
        });
      }
    });
  }
});

// ── KEYBOARD ──────────────────────────────────────────────────────────
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (command === 'quick-snap') {
    try { await createSnap({ url:tab.url, title:tab.title, mode:'capture_classify', windowId:tab.windowId, tabId:tab.id, tabIndex:tab.index, favicon:tab.favIconUrl }); } catch {}
  }

  if (command === 'dump-window') {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    for (const t of tabs) {
      try { await createSnap({ url:t.url, title:t.title, mode:'capture_classify', windowId:t.windowId, tabId:t.id, tabIndex:t.index, favicon:t.favIconUrl }); } catch {}
    }
    chrome.notifications.create({ type:'basic', iconUrl:'icons/icon48.png', title:`Window dumped ✓`, message:`${tabs.length} tabs sent to Snaps.` });
  }

  if (command === 'scan-consent') {
    chrome.tabs.sendMessage(tab.id, { type: 'CX_SCAN_NOW' }, async (res) => {
      const detected = res?.detected || [];
      const { cx_wallet_handle } = await chrome.storage.local.get(['cx_wallet_handle']);

      // Update pending count badge
      const prev = (await chrome.storage.local.get(['cx_pending_count'])).cx_pending_count || 0;
      await chrome.storage.local.set({ cx_pending_count: prev + detected.length, cx_last_detected: detected });
      await updateBadge();

      if (detected.length > 0) {
        chrome.notifications.create({
          type: 'basic', iconUrl: 'icons/icon48.png',
          title: `ConsentX — ${detected.length} consent event${detected.length>1?'s':''} found`,
          message: `Click the extension to review and capture to your wallet.`
        });
      }
    });
  }
});

// ── MESSAGE FROM CONTENT SCRIPT (CX_CONSENT_DETECTED) ────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {

  // Consent scanner found events automatically
  if (msg.type === 'CX_CONSENT_DETECTED') {
    const { detected, wallet_handle } = msg.payload || {};
    if (!detected?.length) { sendResponse({ ok: true }); return true; }

    chrome.storage.local.get(['cx_wallet_handle','cx_pending_count','cx_last_detected','cx_auto_capture'], async (store) => {
      const wh = wallet_handle || store.cx_wallet_handle;
      const autoCapture = store.cx_auto_capture || false;
      const pending = (store.cx_pending_count || 0) + detected.length;

      // Store for popup/sidepanel display
      const existing = store.cx_last_detected || [];
      const merged = [...existing, ...detected].slice(-50); // keep last 50
      await chrome.storage.local.set({ cx_last_detected: merged, cx_pending_count: pending });
      await updateBadge();

      // Auto-capture if enabled
      if (autoCapture && wh) {
        for (const event of detected) {
          await captureConsentToWallet(event, wh);
        }
        await chrome.storage.local.set({ cx_pending_count: 0 });
        await updateBadge();
      }
    });
    sendResponse({ ok: true });
    return true;
  }

  // Manual capture from popup
  if (msg.type === 'CX_CAPTURE_EVENT') {
    chrome.storage.local.get(['cx_wallet_handle'], async (store) => {
      const result = await captureConsentToWallet(msg.event, msg.wallet_handle || store.cx_wallet_handle);
      sendResponse({ ok: true, result });
    });
    return true;
  }

  // Capture all pending
  if (msg.type === 'CX_CAPTURE_ALL') {
    chrome.storage.local.get(['cx_last_detected','cx_wallet_handle'], async (store) => {
      const events = store.cx_last_detected || [];
      const wh = msg.wallet_handle || store.cx_wallet_handle;
      let captured = 0;
      for (const event of events) {
        const r = await captureConsentToWallet(event, wh);
        if (r && !r.queued) captured++;
      }
      await chrome.storage.local.set({ cx_pending_count: 0, cx_last_detected: [] });
      await updateBadge();
      sendResponse({ ok: true, captured });
    });
    return true;
  }

  // Existing Snaps messages
  if (msg.action === 'snap') {
    createSnap(msg.payload).then(r => sendResponse({ success:true, result:r })).catch(e => sendResponse({ success:false, error:e.message }));
    return true;
  }
  if (msg.action === 'dump-window') {
    chrome.tabs.query({ currentWindow: true }).then(async (tabs) => {
      let ok = 0;
      for (const tab of tabs) {
        try { await createSnap({ url:tab.url, title:tab.title, mode:'capture_classify', windowId:tab.windowId, tabId:tab.id, tabIndex:tab.index, favicon:tab.favIconUrl }); ok++; } catch {}
      }
      sendResponse({ success:true, count:ok });
    });
    return true;
  }
  if (msg.action === 'open-panel') {
    chrome.sidePanel.open({ tabId: sender.tab?.id }).catch(() => {});
    sendResponse({ success:true });
    return true;
  }
});

// ── ALARMS ────────────────────────────────────────────────────────────
chrome.alarms.create('retry-queue',   { periodInMinutes: 5 });
chrome.alarms.create('drain-consent', { periodInMinutes: 2 });
chrome.alarms.create('expire-check',  { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'retry-queue')   await retryQueue();
  if (alarm.name === 'drain-consent') await drainCaptureQueue();
  if (alarm.name === 'expire-check') {
    // Check for expiring wallet records and notify
    const { cx_wallet_handle } = await chrome.storage.local.get(['cx_wallet_handle']);
    if (!cx_wallet_handle) return;
    try {
      const resp = await fetch(BRIDGE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': BRIDGE_KEY },
        body: JSON.stringify({
          fn: 'troy-sql-executor', route: 'sql',
          sql: `SELECT COUNT(*) as cnt FROM public.consent_capture cc
                JOIN public.consent_wallet cw ON cw.id = cc.wallet_id
                WHERE cw.wallet_handle = '${cx_wallet_handle}'
                AND cc.expires_at BETWEEN NOW() AND NOW() + INTERVAL '7 days'
                AND cc.status = 'active'`
        })
      });
      const d = await resp.json();
      const expiring = parseInt(d.rows?.[0]?.cnt || 0);
      if (expiring > 0) {
        chrome.notifications.create({
          type: 'basic', iconUrl: 'icons/icon48.png',
          title: `ConsentX — ${expiring} consent${expiring>1?'s':''} expiring soon`,
          message: 'Open your consent wallet to review.'
        });
      }
    } catch {}
  }
});
