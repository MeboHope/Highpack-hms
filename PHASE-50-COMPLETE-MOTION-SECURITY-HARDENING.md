# HighPark Consult PMS — Phase 50
## Complete Object-Level Motion Coverage + Financial Sensitive-Write Hardening

### 1. Homepage/About animation coverage
Phase 49 used a broad semantic selector, but some lower-page content is built from custom `div` structures and therefore did not consistently enter the reveal observer. Phase 50 changes the observer to inspect **every rendered visual element under `main` and `footer`**.

The observer now:
- catches lower sections on the Home page, including content beginning with “From discovery to management” and everything below it;
- catches custom `div`-based cards, panels, feature blocks, stats, CTA areas and footer objects;
- continues to catch dynamically inserted content through MutationObserver;
- excludes SVG internals, scripts/styles, hidden/aria-hidden content and the fixed site header;
- preserves reduced-motion support and the visibility safety fallback;
- keeps a subtle stagger so the page feels alive rather than flashing all objects at once.

### 2. Navbar
The persistent public navbar work from Phase 49 is retained: it remains fixed above the public site while scrolling, with the public-page top offset preserved.

### 3. Financial sensitive-write hardening
Migration `20260916140000_0065_financial_sensitive_write_hardening.sql` removes browser-side INSERT/UPDATE/DELETE access to `owner_payouts`. Owners retain read access to their own settlement records; authorized reporting/finance staff and Super Admins can read settlement data. Trusted server-side workflows remain the intended path for creating or changing payout records.

This closes the legacy path where an authenticated owner could directly create or alter their own payout records.

### 4. Verification
Run from the extracted project folder:

```powershell
npm ci
npm run build
npm run lint
supabase db push --include-all
```

Then verify manually:
1. Open Home at the top and scroll continuously to the footer.
2. Confirm the “From discovery to management” section and every lower section reveals as it enters view.
3. Repeat on About and at least two dashboard pages.
4. Confirm the public navbar stays visible while scrolling.
5. Confirm reduced-motion behavior remains accessible.
6. Confirm payout records can still be viewed by the owner and authorized staff, while direct browser writes are rejected.

### 5. Important
Phase 50 is based on Phase 49 and retains the Phase 49 security/motion changes plus the Phase 47/48 security and short-stay migrations.
