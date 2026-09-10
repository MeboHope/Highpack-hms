# Phase 25 — Customer / Owner Messaging & Enquiries

Implemented a real persisted customer-to-property-owner enquiry workflow.

- Property-page Contact Owner / Enquire buttons now write to `messages`.
- Messages are linked to `property_id` and the property's `owner_id`.
- Added Owner `Messages & Enquiries` workspace with unread state, property context, conversation view and replies.
- Added a database trigger that creates an in-app notification for the receiving owner when a message is inserted.
- Existing message RLS remains the security boundary: senders/receivers can read their messages; receivers can mark received messages read.
- Added route `/owner/messages`.
- No changes to existing property, land, sale or short-stay schema are required beyond the message notification trigger migration.
