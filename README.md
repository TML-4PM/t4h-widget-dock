# T4H Widget Dock

Chrome extension (MV3) for loading purchased T4H widgets in a browser side panel.

## What it does

- Loads entitled widgets from `v_widget_catalogue` (Supabase)
- Renders HTML snippets from `t4h_ui_snippet`
- Shows REAL / PARTIAL / PRETEND badge per widget
- Side panel architecture — stays open while you browse

## Widget types included

| Category | Widgets |
|---|---|
| Control Plane | Pipeline Health, AI Truth Engine, Coverage Scanner, Runtime Lock |
| Finance | Instant Accountant Pack, RDTI Tracker, Audit Trail |
| Growth | AI Outreach Engine, Offer Validator |
| Platform | Universal Widget Engine, AI Command Terminal |

## Install (dev)

1. `chrome://extensions` → Enable Developer Mode
2. Load Unpacked → select this folder
3. Click extension → Settings → paste your Supabase anon key
4. Open side panel

## Pricing

Individual widgets: $29–$299/mo AUD  
Bundles: $149–$999/mo AUD  
Full suite: $999/mo AUD  

→ [t4h.app/widgets](https://mcp-command-centre.vercel.app/widget-catalog)

## Architecture

```
Chrome Extension (MV3)
  └── sidepanel.js
       └── lib/api.js → Supabase v_widget_catalogue
       └── lib/renderer.js → t4h_ui_snippet HTML
```
