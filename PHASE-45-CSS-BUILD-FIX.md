# Phase 45 CSS Build Fix

This revision fixes the PostCSS/Tailwind CSS parsing failure reported during `npm run build`.

Changes are frontend-only:
- Removed arbitrary-value Tailwind utilities from `@apply` declarations that could be parsed incorrectly by the project's PostCSS/Tailwind pipeline.
- Replaced them with equivalent plain CSS declarations.
- Replaced the `:where(...)` focus selector with explicit focus selectors for broad parser compatibility.
- Preserved the restored rounded HighPark UI language.
- Preserved universal scroll-reveal animation.
- Preserved responsive hero imagery and mobile hero asset.
- Preserved responsive layout rules.
- Backend, Supabase, RBAC, authentication and business logic are untouched.

Validation to run on Windows:
```
npm ci
npm run build
npm run lint
npm run dev
```
