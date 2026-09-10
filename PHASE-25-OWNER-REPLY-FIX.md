# Phase 25 Owner Reply Fix

This patch moves owner replies from a browser-side `messages` INSERT to the secure `send_owner_reply()` Supabase RPC.

Apply the migration with:

```powershell
supabase db push
```

Then run:

```powershell
npm run build
npm run lint
```

The RPC verifies the signed-in user is an owner/admin and that the recipient/property pair belongs to an existing conversation before inserting the reply.
