# Phase 49 — Complete Living Motion, Persistent Navigation & Security Hardening

## Implemented

### Complete-page motion coverage
- Scroll motion is now mounted globally inside the authenticated router tree, not only inside the public layout.
- Public pages, customer pages and Owner/Tenant/Admin workspace pages all use the same living-motion observer.
- Long-page lower sections are included: headings, paragraphs, images, links, buttons, inputs, selects, textareas, badges, list items, table rows, cards, articles, regions, dialogs and footer content.
- Dynamically inserted content is detected with `MutationObserver` and animated as it enters view.
- Staggering is subtle and deterministic so the page feels responsive rather than theatrical.
- Reduced-motion users receive an immediate, non-animated presentation.
- A safety fallback prevents content from remaining invisible if IntersectionObserver is delayed.
- The persistent header is deliberately excluded from the reveal choreography.

### Persistent public navigation
- The public HighPark header is now fixed to the top of the viewport with a high stacking order.
- Public content receives the correct top offset so it is not hidden behind the header.
- Dashboard workspace navigation remains independently positioned.

### Security continuation
- Preserves Phase 47 security surface hardening (migration 0062).
- Preserves Phase 48 public short-stay booking flow (migration 0063).
- Adds migration 0064 to protect profile privilege fields from browser-side role escalation.
- Profile `role` and `is_super_admin` changes require service-role execution or a Super Admin with MFA.
- Prevents authenticated clients from forging another user's `audit_logs.user_id`.
- Removes client-side audit-log update/delete capability.
- Retains authorized audit viewing through the staff permission model / Super Admin path.

## Verification

The ZIP was structurally inspected after generation. A clean dependency installation in the build environment timed out, so the final package should be verified in the user's working environment with:

```powershell
npm ci
npm run build
npm run lint
supabase db push --include-all
```

Do not use `npm audit fix --force` as part of this phase; dependency remediation should be handled as a separate controlled upgrade.
