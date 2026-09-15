# Phase 39 — Invitation Routing Repair & Crisp UI Refresh

## Included
- Invitation/password-reset callbacks are recognised from both hash and query-string Supabase callback formats, including `/reset-password` pathname callbacks.
- Removes emoji-based property category icons from the public homepage and replaces them with Lucide icons.
- Removes decorative logo rounding and logo ring/border styling.
- Applies a crisp, square visual language globally by removing border radii from interface surfaces.
- Adds a thin scroll progress indicator at the top of every page.
- Keeps smooth scrolling and a restrained custom scrollbar.

## The scrolling styling
The scrolling effect is a **scroll progress indicator**: a thin line at the top of the browser that fills as the visitor moves down the page. The scrollbar itself is also styled to match the crisp interface.

## Deployment
No database migration or Supabase deployment is required for these UI/routing changes.

Validate locally:
```powershell
npm ci
npm run build
npm run lint
npm run dev
```
Then test a fresh staff invitation and confirm the invitation callback opens the password setup page instead of the Not Found page.


## Phase 39 repair / motion refinement
- Fixed HomePage tuple typing so JSX elements cannot be inferred as React keys.
- Added a Vercel SPA rewrite so direct `/reset-password` invitation callbacks resolve to `index.html` instead of a Vercel 404.
- Normalised invitation/recovery callbacks into the hash router while preserving callback query/hash tokens.
- Added scroll-reveal motion: sections and cards fade/slide into place as they enter the viewport. This is the common 'scroll reveal' / 'animate-on-scroll' interaction the user described as pages feeling 'movy' and 'poppy'.
- Kept the crisp, squared visual language and removed decorative UI rounding globally.
