const SUPABASE_URL = 'https://lzfgigiyqpuuxslsygjt.supabase.co';

export async function loadWidgets(config) {
  // Load entitled widgets from v_widget_catalogue
  const url = `${config.supabase_url || SUPABASE_URL}/rest/v1/v_widget_catalogue?select=*&browser_ready=eq.true&resale_ready=eq.true&order=sort_order.asc`;
  const resp = await fetch(url, {
    headers: {
      'apikey': config.api_key,
      'Authorization': `Bearer ${config.api_key}`,
      'Content-Type': 'application/json'
    }
  });
  if (!resp.ok) throw new Error(`API error: ${resp.status}`);
  return resp.json();
}

export async function loadSnippet(slug, config) {
  const url = `${config.supabase_url || SUPABASE_URL}/rest/v1/t4h_ui_snippet?slug=eq.${encodeURIComponent(slug)}&select=html&limit=1`;
  const resp = await fetch(url, {
    headers: {
      'apikey': config.api_key,
      'Authorization': `Bearer ${config.api_key}`
    }
  });
  if (!resp.ok) return null;
  const rows = await resp.json();
  return rows?.[0]?.html ?? null;
}
