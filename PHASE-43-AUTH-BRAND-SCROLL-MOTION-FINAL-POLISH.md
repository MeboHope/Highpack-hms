# Phase 43 — Auth Brand + Restored Premium Scroll Motion

- Restored the HighPark scroll-reveal interaction: sections fade/slide gently into view and cards/stat cards use a restrained scale-in “pop”.
- Restored clean authentication branding with no framed logo tile or border; extended logo wording remains high-contrast on light and dark auth surfaces.
- Standardized button corners to a moderate 0.5rem radius.
- Standardized primary/accent buttons around the HighPark navy `#0d2342` and gold `#c9972e` palette; dark-surface secondary CTAs use gold outlines rather than plain white fills.
- No backend, database, authentication logic, role security, or business functionality changed.
- Honors `prefers-reduced-motion` and reveals all content if IntersectionObserver is unavailable.
