# Phase 32 — Messaging Ambiguity Repair

Repairs the customer property enquiry and customer reply RPCs without changing the messages table, RLS rules, or conversation behavior.

## Deploy

```powershell
supabase link --project-ref xhcsanlaslsilqnfanrk
supabase db push
```

Then test both: send a new property enquiry and reply to an existing owner conversation.
