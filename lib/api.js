
const SUPABASE_URL = 'https://lzfgigiyqpuuxslsygjt.supabase.co';
const INGEST_URL   = 'https://cpiqblw3iaj7te77uklfmtgyom0kgsan.lambda-url.ap-southeast-2.on.aws/';
const ORG_ID       = 'f0e12a4d-fc16-4f11-a0d5-a76bc88df8a1';

function domainFrom(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return String(h);
}

export async function createSnap({ url, title, selectedText, note, mode = 'capture_classify', windowId, tabId, tabIndex, favicon }) {
  const config = await new Promise(r => chrome.storage.local.get(['ingest_api_key'], r));
  const apiKey = config.ingest_api_key || 'ik_darIRORqfCUA6CQlwSbuOrjOhucCbNyd7bXdhLDfdA4';

  const payload = {
    org_id:        ORG_ID,
    signal_family: 'tabs_content',
    channel:       'browser_tab',
    source_system: 'chrome_ext',
    topic:         title || url,
    primary_url:   url,
    tags:          ['snap', 'tab'],
    importance_score: selectedText ? 7 : note ? 6 : 4,
    time_window_start: new Date().toISOString(),
    raw_meta: {
      tab_title:     title,
      snap_source:   mode,
      page_domain:   domainFrom(url),
      selected_text: selectedText || null,
      user_note:     note || null,
      window_id:     windowId ? String(windowId) : null,
      tab_id:        tabId ? String(tabId) : null,
      tab_index:     tabIndex ?? null,
      favicon_url:   favicon || null,
      content_hash:  hashStr((url || '') + (title || '') + (note || '')),
    }
  };

  const resp = await fetch(INGEST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    const text = await resp.text();
    // Queue locally on failure
    await queueLocally(payload);
    throw new Error(`Ingest ${resp.status}: ${text}`);
  }
  const result = await resp.json();
  return result;
}

async function queueLocally(payload) {
  const { snap_retry_queue = [] } = await new Promise(r => chrome.storage.local.get(['snap_retry_queue'], r));
  snap_retry_queue.push({ payload, queued_at: Date.now(), attempts: 0 });
  await new Promise(r => chrome.storage.local.set({ snap_retry_queue }, r));
}

export async function retryQueue() {
  const { snap_retry_queue = [] } = await new Promise(r => chrome.storage.local.get(['snap_retry_queue'], r));
  if (!snap_retry_queue.length) return { retried: 0, remaining: 0 };
  const config = await new Promise(r => chrome.storage.local.get(['ingest_api_key'], r));
  const apiKey = config.ingest_api_key || 'ik_darIRORqfCUA6CQlwSbuOrjOhucCbNyd7bXdhLDfdA4';
  const remaining = [];
  let retried = 0;
  for (const item of snap_retry_queue) {
    if (item.attempts >= 3) continue; // drop after 3
    try {
      const resp = await fetch(INGEST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify(item.payload)
      });
      if (resp.ok) { retried++; continue; }
    } catch {}
    remaining.push({ ...item, attempts: item.attempts + 1 });
  }
  await new Promise(r => chrome.storage.local.set({ snap_retry_queue: remaining }, r));
  return { retried, remaining: remaining.length };
}

export async function loadWidgets(config) {
  const url = `${config.supabase_url || SUPABASE_URL}/rest/v1/v_widget_catalogue?select=*&browser_ready=eq.true&order=sort_order.asc`;
  const resp = await fetch(url, {
    headers: { 'apikey': config.api_key, 'Authorization': `Bearer ${config.api_key}` }
  });
  if (!resp.ok) throw new Error(`Widgets API ${resp.status}`);
  return resp.json();
}

export async function loadSnippet(slug, config) {
  const url = `${config.supabase_url || SUPABASE_URL}/rest/v1/t4h_ui_snippet?slug=eq.${encodeURIComponent(slug)}&select=html&limit=1`;
  const resp = await fetch(url, { headers: { 'apikey': config.api_key, 'Authorization': `Bearer ${config.api_key}` } });
  if (!resp.ok) return null;
  const rows = await resp.json();
  return rows?.[0]?.html ?? null;
}

export async function loadSnapStats() {
  const url = `${SUPABASE_URL}/rest/v1/v_snaps_front_door?select=*&limit=1`;
  const config = await new Promise(r => chrome.storage.local.get(['api_key'], r));
  const resp = await fetch(url, {
    headers: { 'apikey': config.api_key || '', 'Authorization': `Bearer ${config.api_key || ''}` }
  });
  if (!resp.ok) return null;
  const rows = await resp.json();
  return rows?.[0] ?? null;
}
