# Phase 44 — Restored Rounded UI + Universal Scroll Reveal

This phase restores the established HighPark Consult visual language after the overly-square UI pass.

## Visual changes
- Restores moderate rounded corners on buttons, fields, cards and statistics.
- Keeps public navigation and footer open and borderless.
- Keeps the existing photographic homepage hero.
- Fixes leading search/icon spacing so icons never overlap typed or placeholder text.
- Restores a clean authentication logo presentation with no frame/ring.
- Adds a dynamic-content-aware scroll reveal observer across public, owner, tenant, admin and other workspace pages.
- Sections gently fade/slide upward; cards/statistics receive a restrained scale/pop entrance and stagger.
- No perpetual bounce or continuous motion.
- Respects prefers-reduced-motion.
- Keeps mobile/tablet/desktop responsive behavior and 44px touch targets.

## Backend
No Supabase migrations, Edge Functions, database policies or business logic were changed.
