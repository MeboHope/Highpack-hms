# Phase 48 — Customer Short-Stay Booking + Living Motion

## Short-stay client journey
- Public verified short-stay listings are retrieved through a safe public RPC.
- Property details now expose **Book This Stay** when direct booking is enabled.
- Clients select check-in, check-out, guest count and optional special requests.
- Pricing is calculated from nightly rate, cleaning fee and configured service fee.
- A transactional server-side RPC validates listing status, verified property status, stay length, guest capacity and overlapping bookings before creating a pending booking.
- Booking requests are visible in **My Short Stays** at `/stays`.
- If direct booking is disabled, the client is routed to the normal enquiry/contact workflow instead of receiving a misleading booking control.
- No browser-side code marks payment successful.

## Living website motion
- Replaced the narrow card-only scroll reveal behavior with a universal motion layer covering sections, cards, headings, copy, images, buttons, links, form controls, badges, list items and table rows across public and portal pages.
- Objects enter the viewport with opacity, vertical movement and a restrained scale transition.
- Staggered delays create a guided visual rhythm.
- Hover/focus/press micro-interactions make controls and content feel responsive.
- Route changes receive a light page-arrival transition.
- `prefers-reduced-motion` is respected.
- A safety fallback ensures motion can never permanently hide content.
