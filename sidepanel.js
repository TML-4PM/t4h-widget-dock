import { loadWidgets } from './lib/api.js';
import { renderWidget } from './lib/renderer.js';

const root = document.getElementById('root');

async function init() {
  chrome.storage.local.get(['api_key', 'supabase_url'], async (config) => {
    if (!config.api_key) {
      root.innerHTML = `
        <div class="signin-prompt">
          <h3>Welcome to T4H Widget Dock</h3>
          <p>Connect your T4H account to load your widgets.</p>
          <button class="signin-btn" onclick="chrome.runtime.openOptionsPage()">Connect Account</button>
        </div>`;
      return;
    }
    
    root.innerHTML = '<div class="widget-loading">Loading widgets…</div>';
    
    try {
      const widgets = await loadWidgets(config);
      chrome.storage.local.set({ widgets_count: widgets.length, last_sync: Date.now() });
      
      root.innerHTML = '<div class="widget-grid" id="grid"></div>';
      const grid = document.getElementById('grid');
      
      for (const widget of widgets) {
        await renderWidget(widget, grid);
      }
    } catch (err) {
      root.innerHTML = `<div class="widget-loading" style="color:#f87171">Error: ${err.message}</div>`;
    }
  });
}

document.getElementById('refresh').addEventListener('click', init);
init();
