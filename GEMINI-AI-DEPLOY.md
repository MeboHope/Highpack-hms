# HighPark AI chatbot deployment

The chatbot keeps the Gemini API key server-side. Do **not** put the Gemini key in VITE_* variables or in browser code.

## 1. Set the Gemini secret in Supabase

In the Supabase project dashboard, open Edge Functions / Secrets and create:

- `GEMINI_API_KEY` = your Google Gemini API key
- `GEMINI_CHAT_MODEL` = `gemini-2.5-flash` (optional; this is the default)

The key must be an Edge Function secret. Putting a Gemini key in an ordinary public database/settings row does not make it available to `Deno.env.get('GEMINI_API_KEY')`.

CLI alternative:

```bash
supabase secrets set GEMINI_API_KEY=YOUR_KEY
supabase secrets set GEMINI_CHAT_MODEL=gemini-2.5-flash
```

## 2. Deploy the function

From the project root:

```bash
supabase functions deploy property-ai-chat
```

The included `supabase/config.toml` marks this particular function as `verify_jwt = false` because the public website chatbot must work for customers who have not signed in. The function only reads verified/public property information and keeps the Gemini key server-side.

## 3. Verify the secret exists

```bash
supabase secrets list
```

Do not paste the actual key into source files, Git, the frontend `.env`, or chat.

## 4. Verify the frontend

The frontend calls:

```text
supabase.functions.invoke('property-ai-chat', ...)
```

After deployment, open a verified property, open **Ask HighPark AI**, and ask a question about that property. The assistant should answer using the verified listing context.

If Gemini rejects the request, the function now returns a useful configuration/provider error instead of silently returning the generic "temporarily unavailable" message.
