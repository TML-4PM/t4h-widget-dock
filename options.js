chrome.storage.local.get(['api_key', 'supabase_url'], (data) => {
  if (data.api_key) document.getElementById('api_key').value = data.api_key;
  if (data.supabase_url) document.getElementById('supabase_url').value = data.supabase_url;
});

document.getElementById('save').addEventListener('click', () => {
  const api_key = document.getElementById('api_key').value.trim();
  const supabase_url = document.getElementById('supabase_url').value.trim();
  chrome.storage.local.set({ api_key, supabase_url }, () => {
    const status = document.getElementById('status');
    status.style.display = 'block';
    setTimeout(() => status.style.display = 'none', 2000);
  });
});
