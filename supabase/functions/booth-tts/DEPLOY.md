# booth-tts — ElevenLabs TTS (The AI Booth)

## Secrets (Supabase Dashboard → Edge Functions → Secrets, or CLI)

```bash
supabase secrets set ELEVENLABS_API_KEY=xi_api_key_...
supabase secrets set ELEVENLABS_VOICE_ID=voice_id_from_elevenlabs_dashboard
# optional:
supabase secrets set ELEVENLABS_MODEL_ID=eleven_multilingual_v2
```

Pick a **voice** in [ElevenLabs → Voices](https://elevenlabs.io/app/voice-library) (deep / professional). Copy the **Voice ID**.

## Deploy

```bash
supabase functions deploy booth-tts
```

`verify_jwt = false` for this function is set in **`supabase/config.toml`** (`[functions.booth-tts]`) so the Booth page can call `POST` with the **anon** key + `Authorization: Bearer` (no user login). If you deploy without this config, pass `--no-verify-jwt` explicitly.

Test with:

```bash
curl -i -X POST "$SUPABASE_URL/functions/v1/booth-tts" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text":"Bienvenido a Miami DJ Beat."}'
```

Expect `200` and `Content-Type: audio/mpeg`.

## Cost / abuse

- Char limit enforced in function (`MAX_CHARS`).
- Add rate limiting (e.g. Upstash, Cloudflare) before production traffic.
