# Phase 21 — Animated Analytics

## What changed
- Trend charts animate their line drawing and reveal the area fill.
- Trend points appear with a subtle stagger.
- Comparison bars expand smoothly with a small stagger between rows and series.
- Donut segments sweep into view with restrained timing.
- `prefers-reduced-motion` disables chart animation while preserving the final chart state.
- No new dependencies were added.

## UX principle
Animations run once when the chart renders. They are intentionally subtle and do not loop, so analytics remain professional and operational rather than decorative.

## Validation
Run in the project root:

```bash
npm ci
npm run build
npm run lint
npm run dev
```
