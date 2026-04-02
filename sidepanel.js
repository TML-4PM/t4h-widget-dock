
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
