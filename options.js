
chrome.storage.local.get(['api_key', 'supabase_url', 'ingest_api_key'], (data) => {
  if (data.api_key)        document.getElementById('api_key').value        = data.api_key;
  if (data.supabase_url)   document.getElementById('supabase_url').value   = data.supabase_url;
  if (data.ingest_api_key) document.getElementById('ingest_api_key').value = data.ingest_api_key;
});

document.getElementById('save').addEventListener('click', () => {
  const api_key        = document.getElementById('api_key').value.trim();
  const supabase_url   = document.getElementById('supabase_url').value.trim();
  const ingest_api_key = document.getElementById('ingest_api_key').value.trim();
  chrome.storage.local.set({ api_key, supabase_url, ingest_api_key }, () => {
    const s = document.getElementById('status');
    s.style.display = 'block';
    setTimeout(() => s.style.display = 'none', 2000);
  });
});
