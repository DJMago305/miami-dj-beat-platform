# 🚀 Deploy: `notify-new-lead` Edge Function

## Variables de Entorno Requeridas

Agrega estos secrets en tu proyecto Supabase:
**Dashboard → Settings → Edge Functions → Secret Management**

| Variable | Valor |
|---|---|
| `RESEND_API_KEY` | Tu API key de [resend.com](https://resend.com) |
| `MANAGER_EMAIL` | Tu email de manager (ej: `you@gmail.com`) |
| `FROM_EMAIL` | Email verificado en Resend (ej: `Miami DJ Beat <no-reply@miamidjbeat.com>`) |
| `DASHBOARD_URL` | URL de tu dashboard (ej: `https://miamidjbeat.vercel.app/admin-dashboard.html`) |

> ⚠️ `FROM_EMAIL` debe ser un dominio verificado en Resend o usa `onboarding@resend.dev` para pruebas.

## Deploy

```bash
# Desde la raíz del proyecto
supabase functions deploy notify-new-lead --no-verify-jwt
```

## Flujo

```
Cliente llena formulario → form-handler.js → Supabase leads table
                                           ↘ notify-new-lead (Edge Function)
                                                ↘ Resend API → Email al Manager
```

## Prueba Local

```bash
supabase functions serve notify-new-lead

curl -X POST http://localhost:54321/functions/v1/notify-new-lead \
  -H "Content-Type: application/json" \
  -d '{
    "lead_id": "test-001",
    "event_type": "Quinceañera",
    "event_date": "2026-05-15",
    "location": "Coral Gables, Miami",
    "email": "cliente@example.com",
    "phone": "305-555-0100",
    "budget": "$2,500",
    "referred_by": "Instagram"
  }'
```
