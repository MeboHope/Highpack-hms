# Phase 34 — Property publishing and short-stay control

## Purpose

This phase makes the public marketplace behave like a controlled production listing system without changing the working customer-owner messaging flow.

## Short-stay workflow

Short-stay listings use the existing `short_stay_listings.listing_status` lifecycle:

- **Draft** — internal preparation; not public.
- **Active** — eligible for the public marketplace when the parent property is verified.
- **Paused** — temporarily removed from the public marketplace while retained for operations.
- **Archived** — historical/inactive record; not public.

The Admin/Owner Short-Stay Operations screen now has an **Edit** action. Opening a draft lets an authorized user change its property, name, status, rates, stay rules, guest capacity and booking channels. Changing `Draft` to `Active` is therefore the explicit publish action for a short-stay listing.

## Public marketplace rule

The public universal catalog continues to require `properties.status = 'verified'`.

For properties whose operating model is `short_stay`, the catalog additionally requires at least one related short-stay listing with `listing_status = 'active'`.

Therefore:

| Property verification | Short-stay listing | Public website |
|---|---|---|
| Pending / rejected / suspended | Any | No |
| Verified | Draft | No |
| Verified | Paused | No |
| Verified | Archived | No |
| Verified | Active | Yes |

This keeps an internally verified property record separate from whether its hospitality offering is currently being marketed.

## Public marketplace labels

Public property cards now show a **Verified** badge because every record returned by the public catalog has passed the verified-property gate. Asset classification remains visible separately, e.g. **Built Property**, **Land**, or **Development Project**, alongside opportunity labels such as **For Sale** or **Short Stay**.

Asset-specific details remain governed by `getPropertyPresentation`, so land does not inherit residential bedrooms/bathrooms/parking/unit metrics.

## Messaging protection

No messaging tables, RPCs, notifications, customer-owner conversation UI, or message migrations were modified in this phase.
