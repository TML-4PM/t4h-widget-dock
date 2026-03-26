# Chrome Web Store Submission Checklist

## Account
- [ ] Sign into https://chrome.google.com/webstore/devconsole
- [ ] Pay $5 USD one-time developer registration (if not already done)
- [ ] Select account: Tech 4 Humanity / TML-4PM

## Package
- [ ] Run: `zip -r t4h-widget-dock.zip . --exclude ".git/*" --exclude "store-assets/*" --exclude "*.md"`
- [ ] Verify zip includes: manifest.json, service-worker.js, popup.*, sidepanel.*, options.*, styles.css, lib/, icons/
- [ ] Upload zip to Developer Dashboard → New Item

## Store listing
Copy from STORE_LISTING.md:
- [ ] Name: T4H Widget Dock — AI Business Dashboard
- [ ] Short description (132 chars): See your business clearly in 10 seconds...
- [ ] Category: Productivity
- [ ] Language: English (AU) + English (US)
- [ ] Full description: paste verbatim from STORE_LISTING.md
- [ ] Privacy policy URL: https://tech4humanity.com.au/privacy
- [ ] Homepage URL: https://mcp-command-centre.vercel.app/widget-catalog

## Assets
- [ ] Upload: icons/icon128.png as store icon (128x128)
- [ ] Upload: store-assets/screenshot_1_sidepanel.png (1280x800)
- [ ] Upload: store-assets/screenshot_2_catalog.png (1280x800)

## Permissions justification (reviewer will ask)
- storage: save API key locally
- sidePanel: side panel widget dock UI
- activeTab: current tab context display
- notifications: alert on stuck runs/failures

## Single purpose statement
"Loads purchased business intelligence widgets into a Chrome side panel using the user's own Supabase credentials."

## Visibility
- [ ] Set to: Public
- [ ] Regions: All regions (or AU/US/UK/NZ first)

## Pricing model
- [ ] Free (users authenticate with their own subscription key)

## Review notes for Google
This extension connects exclusively to the user's own Supabase instance using credentials they provide. No user data is collected by the developer. The extension renders HTML snippets from the user's database into a side panel UI.

## Expected review time
3–7 business days for new extensions.

## Post-approval
- [ ] Share install link on LinkedIn
- [ ] Add to tech4humanity.com.au
- [ ] Add to /widget-catalog page as install CTA
- [ ] Onboard first 20 users manually → request reviews
