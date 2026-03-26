import { loadSnippet } from './api.js';

export async function renderWidget(widget, container) {
  const statusClass = (widget.evidence_level || 'PRETEND').toLowerCase();
  const badgeClass = `badge-${statusClass}`;
  
  const card = document.createElement('div');
  card.className = `widget-card status-${statusClass}`;
  card.innerHTML = `
    <div class="widget-header">
      <span class="widget-title">${widget.widget_name}</span>
      <span class="badge ${badgeClass}">${widget.evidence_level}</span>
    </div>
    <div class="widget-body" id="body-${widget.widget_slug}">
      <span style="color:#475569;font-size:11px">Loading…</span>
    </div>
  `;
  container.appendChild(card);
  
  // Load snippet if available
  if (widget.ui_snippet_slug) {
    chrome.storage.local.get(['api_key', 'supabase_url'], async (config) => {
      const html = await loadSnippet(widget.ui_snippet_slug, config);
      const body = document.getElementById(`body-${widget.widget_slug}`);
      if (body && html) {
        body.innerHTML = html;
      } else if (body) {
        body.innerHTML = `<span style="color:#475569;font-size:11px">${widget.description || widget.source_ref || 'No snippet yet'}</span>`;
      }
    });
  } else {
    const body = document.getElementById(`body-${widget.widget_slug}`);
    if (body) body.innerHTML = `<span style="color:#475569;font-size:11px">${widget.description || widget.product_family}</span>`;
  }
}
