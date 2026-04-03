
const SUPABASE_URL    = 'https://lzfgigiyqpuuxslsygjt.supabase.co';
// Legacy ingest URL kept for reference — new snaps go via TAB_SNAP_URL
const INGEST_URL      = 'https://cpiqblw3iaj7te77uklfmtgyom0kgsan.lambda-url.ap-southeast-2.on.aws/';
const TAB_SNAP_URL    = 'https://lxciyl5t2howe4xh775c5f64q40ukpfb.lambda-url.ap-southeast-2.on.aws/tab-snap';
const TAB_SNAP_KEY    = 'h78q-UdfPSJB8136etMjIQ3pf0GuSG6aKV3Yv4JURW8';
const ORG_ID          = 'f0e12a4d-fc16-4f11-a0d5-a76bc88df8a1';

function domainFrom(url) {
  try { return new URL(url).hostname; } catch { return ''; }
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return String(h);
}

function dedupeTags(tags) {
  const seen = new Set();
  return tags.map(t => String(t).trim()).filter(t => t && !seen.has(t) && seen.add(t));
}

function truncate(str, max) {
  return typeof str === 'string' && str.length > max ? str.slice(0, max) : (str || '');
}

function buildIdempotencyKey({ url, title, selectedText, note }) {
  const bucket = new Date().toISOString().slice(0, 16);
  return [url, title, (selectedText || '').slice(0, 200), (note || '').slice(0, 200), bucket].join('::');
}

/**
 * createSnap — routes to the new troy-tab-snap Lambda.
 * Falls back to legacy ingest on failure.
 */
export async function createSnap({ url, title, selectedText, note, mode = 'capture_classify', windowId, tabId, tabIndex, favicon }) {
  const config = await new Promise(r => chrome.storage.local.get(['tab_snap_key', 'tab_snap_url', 'workspace', 'user_id', 'default_tags'], r));

  const bridgeUrl = config.tab_snap_url || TAB_SNAP_URL;
  const apiKey    = config.tab_snap_key || TAB_SNAP_KEY;
  const workspace = config.workspace    || 't4h';
  const userId    = config.user_id      || 'troy';

  const payload = {
    event_type:      'tab_snap',
    timestamp_utc:   new Date().toISOString(),
    source:          'snaps-extension',
    idempotency_key: buildIdempotencyKey({ url, title, selectedText, note }),
    user_context: {
      user_id:   userId,
      workspace: workspace,
      profile:   'default',
    },
    tab: {
      url:        url || '',
      title:      title || '',
      favIconUrl: favicon || '',
      windowId:   windowId || null,
      tabId:      tabId || null,
    },
    page: {
      selection_text:    truncate(selectedText, 8000),
      page_text_excerpt: '',
      html_excerpt:      '',
    },
    action: {
      type:  mode === 'capture_classify' ? 'classify_and_route' : 'save_snap',
      tags:  dedupeTags(['snap', ...(config.default_tags || [])]),
      notes: truncate(note, 2000),
    },
    telemetry: {
      extension_version: chrome.runtime.getManifest().version,
      browser: 'chrome',
    },
  };

  const resp = await fetch(bridgeUrl, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body:    JSON.stringify(payload),
  });

  if (!resp.ok) {
    const text = await resp.text();
    await queueLocally(payload);
    throw new Error(`tab-snap ${resp.status}: ${text}`);
  }

  return resp.json();
}

async function queueLocally(payload) {
  const { snap_retry_queue = [] } = await new Promise(r => chrome.storage.local.get(['snap_retry_queue'], r));
  snap_retry_queue.push({ payload, queued_at: Date.now(), attempts: 0 });
  await new Promise(r => chrome.storage.local.set({ snap_retry_queue }, r));
}

export async function retryQueue() {
  const { snap_retry_queue = [] } = await new Promise(r => chrome.storage.local.get(['snap_retry_queue'], r));
  if (!snap_retry_queue.length) return { retried: 0, remaining: 0 };
  const config  = await new Promise(r => chrome.storage.local.get(['tab_snap_key', 'tab_snap_url'], r));
  const apiKey  = config.tab_snap_key || TAB_SNAP_KEY;
  const url     = config.tab_snap_url || TAB_SNAP_URL;
  const remaining = [];
  let retried = 0;
  for (const item of snap_retry_queue) {
    if (item.attempts >= 3) continue;
    try {
      const resp = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body:    JSON.stringify(item.payload),
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
