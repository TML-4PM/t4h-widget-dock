
import { loadWidgets, loadSnippet, loadSnapStats } from './lib/api.js';
import { renderWidget } from './lib/renderer.js';

const SUPABASE_URL = 'https://lzfgigiyqpuuxslsygjt.supabase.co';

// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('pane-' + tab.dataset.tab).classList.add('active');
  });
});

// Snap now button
document.getElementById('snap-now').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await chrome.runtime.sendMessage({
    action: 'snap',
    payload: { url: tab.url, title: tab.title, mode: 'capture_classify',
               windowId: tab.windowId, tabId: tab.id, tabIndex: tab.index, favicon: tab.favIconUrl }
  });
  setTimeout(loadSnapsPane, 800);
});

document.getElementById('refresh').addEventListener('click', init);

async function getConfig() {
  return new Promise(r => chrome.storage.local.get(['api_key', 'supabase_url'], r));
}

async function supabaseGet(path, config) {
  const base = config.supabase_url || SUPABASE_URL;
  const resp = await fetch(`${base}/rest/v1/${path}`, {
    headers: { apikey: config.api_key || '', Authorization: `Bearer ${config.api_key || ''}` }
  });
  if (!resp.ok) return [];
  return resp.json();
}

// ── Snaps pane ─────────────────────────────────────────────────────────────
async function loadSnapsPane() {
  const config = await getConfig();
  if (!config.api_key) {
    document.getElementById('stats').innerHTML = '<div class="empty">Connect your account in Settings →</div>';
    return;
  }
  try {
    const [stats, recent] = await Promise.all([
      supabaseGet('v_snaps_front_door?select=*&limit=1', config),
      supabaseGet('v_snaps_recent?select=snap_id,page_title,page_domain,state,biz_key,evidence_state,received_at&order=received_at.desc&limit=20', config)
    ]);
    const s = stats?.[0] || {};
    document.getElementById('stats').innerHTML = `
      <div class="stat green"><div class="stat-val">${s.real_snaps ?? 0}</div><div class="stat-lbl">REAL snaps</div></div>
      <div class="stat"><div class="stat-val">${s.total_snaps ?? 0}</div><div class="stat-lbl">Total</div></div>
      <div class="stat green"><div class="stat-val">${s.revenue_ready ?? 0}</div><div class="stat-lbl">Revenue ready</div></div>
      <div class="stat amber"><div class="stat-val">${s.queue_pending ?? 0}</div><div class="stat-lbl">Queue pending</div></div>
    `;
    const el = document.getElementById('recent-snaps');
    if (!recent.length) { el.innerHTML = '<div class="empty">No snaps yet — click Snap to start</div>'; return; }
    el.innerHTML = recent.map(r => `
      <div class="snap-item ${(r.evidence_state||'partial').toLowerCase()}">
        <div class="snap-title">${r.page_title || r.page_domain || 'Untitled'}</div>
        <div class="snap-meta">
          ${r.biz_key ? `<span class="snap-biz">${r.biz_key}</span> · ` : ''}
          ${r.evidence_state || 'PARTIAL'} · ${r.page_domain || ''}
        </div>
      </div>`).join('');
  } catch (e) {
    document.getElementById('stats').innerHTML = `<div class="empty">Error: ${e.message}</div>`;
  }
}

// ── Widgets pane ───────────────────────────────────────────────────────────
async function loadWidgetsPane() {
  const config = await getConfig();
  const el = document.getElementById('widget-grid');
  if (!config.api_key) {
    el.innerHTML = '<div class="empty">Connect your account in Settings →</div>';
    return;
  }
  try {
    const widgets = await loadWidgets(config);
    if (!widgets.length) { el.innerHTML = '<div class="empty">No widgets found</div>'; return; }
    el.innerHTML = '';
    for (const w of widgets) await renderWidget(w, el);
  } catch (e) {
    el.innerHTML = `<div class="empty">Error loading widgets: ${e.message}</div>`;
  }
}

// ── Revenue pane ───────────────────────────────────────────────────────────
async function loadRevenuePane() {
  const config = await getConfig();
  const el = document.getElementById('revenue-content');
  if (!config.api_key) {
    el.innerHTML = '<div class="empty">Connect your account in Settings →</div>';
    return;
  }
  try {
    const rows = await supabaseGet(
      'v_snaps_revenue_ready?select=page_title,page_domain,biz_key,monetisation_path,offer_slug,evidence_state,action_priority&order=action_priority.desc&limit=30',
      config
    );
    if (!rows.length) { el.innerHTML = '<div class="empty">No revenue-ready snaps yet</div>'; return; }
    el.innerHTML = rows.map(r => `
      <div class="snap-item ${(r.evidence_state||'partial').toLowerCase()}">
        <div class="snap-title">${r.page_title || r.page_domain || 'Untitled'}</div>
        <div class="snap-meta">
          ${r.biz_key ? `<span class="snap-biz">${r.biz_key}</span> · ` : ''}
          ${r.monetisation_path || ''} ${r.offer_slug ? '· ' + r.offer_slug : ''}
        </div>
      </div>`).join('');
  } catch (e) {
    el.innerHTML = `<div class="empty">Error: ${e.message}</div>`;
  }
}

async function init() {
  loadSnapsPane();
  loadWidgetsPane();
  loadRevenuePane();
}

init();


// ── ConsentX Sidepanel Functions ────────────────────────────────────
const BRIDGE_URL = 'https://m5oqj21chd.execute-api.ap-southeast-2.amazonaws.com/lambda/invoke';
const BRIDGE_KEY = 'bk_tOH8P5WD3mxBKfICa4yI56vJhpuYOynfdf1d_GfvdK4';
let spDetected = [];

async function spBridge(sql) {
  try {
    const r = await fetch(BRIDGE_URL, { method:'POST',
      headers:{'Content-Type':'application/json','x-api-key':BRIDGE_KEY},
      body: JSON.stringify({fn:'troy-sql-executor',route:'sql',sql}) });
    return (await r.json()).rows || [];
  } catch { return []; }
}

window.spScanConsent = async function() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]) return;
  document.getElementById('sp-cx-events').innerHTML = '<div class="loading">Scanning…</div>';
  try {
    const resp = await chrome.tabs.sendMessage(tabs[0].id, { type: 'CX_SCAN_NOW' });
    spDetected = resp?.detected || [];
    document.getElementById('sp-cx-count').textContent = spDetected.length;
    document.getElementById('sp-capture-all').style.display = spDetected.length > 0 ? 'block' : 'none';
    spRenderEvents();
  } catch {
    document.getElementById('sp-cx-events').innerHTML = '<div class="empty">Could not scan — reload the page first.</div>';
  }
};

window.spCaptureAll = async function() {
  const store = await chrome.storage.local.get(['cx_wallet_handle']);
  if (!store.cx_wallet_handle) { alert('Set your wallet handle in the popup first.'); return; }
  const btn = document.getElementById('sp-capture-all');
  btn.textContent = 'Capturing…'; btn.disabled = true;
  const resp = await chrome.runtime.sendMessage({ type: 'CX_CAPTURE_ALL', wallet_handle: store.cx_wallet_handle });
  btn.textContent = `✓ ${resp?.captured || 0} captured`;
  spDetected = []; spRenderEvents();
  setTimeout(() => { btn.textContent = 'Capture All to Wallet →'; btn.disabled = false; btn.style.display='none'; spLoadWalletRecs(store.cx_wallet_handle); }, 2000);
};

function spRenderEvents() {
  const el = document.getElementById('sp-cx-events');
  if (!spDetected.length) { el.innerHTML = '<div class="empty">No consent events found.</div>'; return; }
  el.innerHTML = spDetected.map(e => `<div class="snap-item" style="border-left-color:${e.sensitivity==='high'?'#ef4444':e.sensitivity==='low'?'#34d399':'#f59e0b'}">
    <div class="snap-title">${e.consent_label||e.domain}</div>
    <div class="snap-meta"><span class="snap-biz">${e.sector||'platform'}</span> · ${e.sensitivity||'medium'} · ${e.domain}</div>
  </div>`).join('');
}

async function spLoadWalletRecs(handle) {
  const recs = await spBridge(`SELECT cc.consent_label,cc.domain,cc.sensitivity,cc.captured_at FROM public.v_consent_capture_feed cc JOIN public.consent_wallet cw ON cw.wallet_handle='${handle}' AND cw.id=cc.wallet_id ORDER BY cc.captured_at DESC LIMIT 6`);
  const el = document.getElementById('sp-wallet-recs');
  if (!recs.length) { el.innerHTML = '<div class="empty" style="font-size:10px">No records yet.</div>'; return; }
  el.innerHTML = recs.map(r => `<div class="snap-item ${r.sensitivity==='high'?'pretend':r.sensitivity==='low'?'real':'partial'}">
    <div class="snap-title" style="font-size:11px">${r.consent_label||r.domain}</div>
    <div class="snap-meta">${r.domain} · ${new Date(r.captured_at).toLocaleDateString('en-AU')}</div>
  </div>`).join('');
}

// Load wallet recs on consent tab activation
document.querySelectorAll('.tab').forEach(t => {
  t.addEventListener('click', () => {
    if (t.dataset.tab === 'consent') {
      chrome.storage.local.get(['cx_wallet_handle','cx_pending_count'], store => {
        if (store.cx_wallet_handle) spLoadWalletRecs(store.cx_wallet_handle);
        const n = store.cx_pending_count||0;
        document.getElementById('sp-cx-count').textContent = n;
      });
    }
  });
});
