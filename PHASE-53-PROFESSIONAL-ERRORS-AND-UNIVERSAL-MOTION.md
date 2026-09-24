# Phase 53 — Professional Authentication Errors + Universal Page Motion

## Authentication UX
- Expected secure-login errors are read from the Edge Function response body when Supabase reports a non-2xx response.
- Wrong OTP displays the actual user-facing message: `The verification code is incorrect.`
- Expired OTP and excessive attempts retain their dedicated, actionable messages.
- Network/transport failures fall back to a safe, friendly message rather than exposing `Edge Function returned a non-2xx status code`.
- The secure-login Edge Function no longer returns raw email-provider error text to browsers; detailed provider failures remain server-side logs.
- The working Phase 51 OTP verification flow is otherwise unchanged.

## Motion UX
- Existing universal IntersectionObserver reveal remains active across public, Admin, Owner and Tenant page content.
- Phase 53 adds a short page-arrival transition and tunes scroll reveals to a softer 24px desktop / 18px mobile movement.
- No perpetual animation is introduced.
- `prefers-reduced-motion` disables route and scroll motion while keeping content fully visible.
- Header remains excluded from scroll choreography so navigation stays stable.
