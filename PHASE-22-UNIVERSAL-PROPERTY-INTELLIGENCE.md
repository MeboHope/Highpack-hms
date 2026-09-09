# Phase 22 — Universal Property Intelligence, Land Enquiry & AI Assistant

## What changed
- Property onboarding now adapts to the selected asset class and operating model.
- Land automatically uses a land-sale / enquiry-led workflow and never collects a reservation amount.
- Land assets do not expose house-style Units/Floors workflows in the owner portal.
- Land public listings are enquiry-led: no reservation-fee CTA and no online reservation modal.
- Public property pages provide land-specific due-diligence/enquiry guidance.
- Added a floating HighPark AI Assistant that can answer questions about the current property or the verified portfolio.
- AI uses the OpenAI Responses API from a Supabase Edge Function; the OpenAI key stays server-side.
- KRA settings now use an authoritative `admin_save_kra_etims_settings(jsonb)` RPC to avoid stale overloaded function signatures.

## Supabase deployment
```powershell
supabase db push --include-all
supabase functions deploy property-ai-chat --no-verify-jwt
```

## AI secret
Set the following Supabase Edge Function secret:
- `GEMINI_API_KEY` — required
- Optional: `GEMINI_CHAT_MODEL` — defaults to `gemini-2.5-flash`

Never put `GEMINI_API_KEY` in `VITE_*` variables or browser code.


## Gemini API provider
The public property chatbot uses the Google Gemini API through the `property-ai-chat` Edge Function. Set `GEMINI_API_KEY` as a Supabase Edge Function secret. Optionally set `GEMINI_CHAT_MODEL`; the default is `gemini-2.5-flash`. Never put the Gemini key in a `VITE_*` frontend variable.
