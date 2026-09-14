# Phase 35 — Admin Property Verification Hardening

## Purpose
Strengthen the production workflow around property verification without changing the working customer/owner messaging system.

## Changes
- Added explicit property verification metadata: notes, verified/rejected timestamps and reviewer IDs.
- Added `admin_review_property()` SECURITY DEFINER RPC for Admin-only verification decisions.
- Admin Property Registry now uses a Review action and review modal instead of direct status mutation.
- Review modal shows asset class, property type, location-pin presence, map-link presence and photo count.
- Decisions supported: Verified, Rejected, Suspended.
- Review notes are stored with the property and the existing property audit trigger records the update.
- Added verification indexes for larger portfolios.

## Public visibility
Existing public marketplace rules remain intact. Messaging was intentionally not modified.
