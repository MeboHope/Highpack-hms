# Phase 23 final deployment

## 1. Link this local project to the correct Supabase project

From the project root:

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

The project ref is the Reference ID shown in Supabase Dashboard > Project Settings > General, or the identifier in your Supabase project URL.

## 2. Apply database migrations

```powershell
supabase db push
```

This applies the public catalogue/location migration and the rest of the migrations that are not yet applied.

## 3. Deploy the public map resolver

```powershell
supabase functions deploy resolve-map-url
```

This resolves Google Maps share/short URLs that do not expose coordinates directly.

## 4. Configure Gemini and deploy the chatbot

```powershell
supabase secrets set GEMINI_API_KEY=YOUR_GEMINI_API_KEY
supabase secrets set GEMINI_CHAT_MODEL=gemini-2.5-flash
supabase functions deploy property-ai-chat
```

Do not put the Gemini key in a VITE_ variable or browser source.

## 5. Verify

```powershell
npm ci
npm run build
npm run lint
npm run dev
```
