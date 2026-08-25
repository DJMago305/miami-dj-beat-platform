# 📧 Guía de Automatización: Notificaciones de Leads

Para que recibas un correo cada vez que un cliente te contacte, debemos usar una **Supabase Edge Function**. Aquí tienes el código y los pasos.

## 1. El Código de la Función (`index.ts`)
Copia este código en una nueva Edge Function llamada `notify-lead` en tu panel de Supabase.

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const RESEND_API_KEY = "TU_API_KEY_DE_RESEND" // Regístrate en resend.com (gratis)

serve(async (req) => {
  const { record } = await req.json()

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'MDJPRO Leads <onboarding@resend.dev>',
      to: ['tu-email@tu-dominio.com'], // CAMBIA ESTO A TU EMAIL
      subject: `🚀 Nuevo Lead: ${record.event_type} en ${record.location}`,
      html: `
        <h2>¡Tienes un nuevo interesado!</h2>
        <p><strong>Evento:</strong> ${record.event_type}</p>
        <p><strong>Fecha:</strong> ${record.event_date}</p>
        <p><strong>Ubicación:</strong> ${record.location}</p>
        <p><strong>Email:</strong> ${record.email}</p>
        <p><strong>Teléfono:</strong> ${record.phone}</p>
        <p><strong>Presupuesto:</strong> ${record.budget}</p>
        <hr>
        <a href="https://tu-proyecto.supabase.co/admin-dashboard.html">Ver en Panel de Manager</a>
      `,
    }),
  })

  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } })
})
```

## 2. Configurar el Trigger (Base de Datos)
Para que la función se ejecute sola, ve a **Database -> Webhooks** en Supabase y crea uno:
- **Name**: `on_new_lead`
- **Table**: `leads`
- **Events**: `INSERT`
- **Hook Type**: `Supabase Edge Function`
- **Function**: Selecciona `notify-lead`

## 3. Beneficios
- **Velocidad**: Sabrás de un cliente en segundos, no horas.
- **Seguridad**: Los datos viajan por los servidores de Supabase sin exponerse en la web.
- **Escalabilidad**: Puedes añadir alertas por SMS (Twilio) o WhatsApp en el futuro.

---
> [!TIP]
> Te recomiendo usar **Resend.com** para el envío de emails ya que es muy fácil de configurar con Supabase.
