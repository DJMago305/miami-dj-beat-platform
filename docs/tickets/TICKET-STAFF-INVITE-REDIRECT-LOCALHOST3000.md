# TICKET-STAFF-INVITE-REDIRECT-LOCALHOST3000 — Link de invitación de staff apunta a localhost:3000

**Fecha de apertura:** 2026-09-29
**Reportado por:** Gerardo A. Valle (PO), probando en vivo el flujo real de "Crear Perfiles"
**Tipo:** Bug potencial — configuración de redirect en invitación de cuenta
**Estado:** ✅ RESUELTO — 2026-09-29
**Prioridad:** 🟡 Media — no bloquea crear la cuenta, sí bloquea que el nuevo usuario pueda activarla

---

## DESCRIPCIÓN

Al crear una cuenta de Vendedor (rol `seller`) desde `staff.html` → "Crear Perfiles" (Owner-only, dispara el edge function `create-platform-account`), el link de activación generado por Supabase Auth trae:

```
https://hkuvuqupbxwkiykxvqdr.supabase.co/auth/v1/verify?token=...&type=invite&redirect_to=http://localhost:3000
```

`redirect_to=http://localhost:3000` no es un servidor real corriendo — el dev server local del proyecto vive en el puerto **8000** (`localhost:8000`, único puerto autorizado, ver `.claude/launch.json`), no en 3000. Si el nuevo usuario (en este caso Wendy, cuenta `wendy.miamidjbeat@gmail.com`) hace clic en ese link tal cual, probablemente no cargue nada útil.

Caso de prueba usado: creación de la cuenta fue en `localhost:8000/staff.html`, PROD Supabase (`hkuvuqupbxwkiykxvqdr`).

---

## PREGUNTA A INVESTIGAR

¿`redirect_to` está **hardcodeado** a `http://localhost:3000` en el edge function `supabase/functions/create-platform-account/index.ts` (en cuyo caso también rompería las invitaciones reales en producción, no solo en pruebas locales), o se calcula dinámicamente a partir de `window.location.origin`/una env var y el valor de `localhost:3000` es solo un resto de pruebas de otro desarrollador/entorno?

Si está hardcodeado: **es un bug real que bloquea la activación de cualquier cuenta nueva de staff/cliente/artista en producción**, no solo un artefacto de pruebas locales — hay que confirmarlo antes de mandarle un link real a Wendy o a cualquier otra persona.

---

## ARCHIVOS SOSPECHOSOS (no tocar sin alcance autorizado)

| Archivo | Por qué es sospechoso |
|---------|----------------------|
| `supabase/functions/create-platform-account/index.ts` | Genera el `action_link` vía `admin.generateLink`; ahí se define `redirect_to` |
| Variables de entorno del edge function (`SITE_URL` o similar) | Posible origen del valor incorrecto |

---

## IMPACTO

- No bloquea la creación de la cuenta en sí (el registro en `dj_profiles` sí se hizo correctamente)
- Si el `redirect_to` está mal en producción, **ningún** nuevo staff/cliente/artista podría terminar de activar su cuenta con el link que reciben — impacto alto si se confirma que no es solo de pruebas

## PLAN DE INVESTIGACIÓN (requiere autorización del Capitán)

1. Abrir `create-platform-account/index.ts` y ubicar la llamada a `admin.generateLink` — ver si `redirect_to` viene de un literal `"http://localhost:3000"` o de una variable
2. Si viene de variable de entorno, verificar su valor real en Supabase (prod) — ¿está seteada a localhost por error, o falta configurarla y cae a un default equivocado?
3. Probar creando una cuenta desde el sitio real (no localhost) y ver si el link generado también trae `localhost:3000` o el dominio correcto

**Para autorizar investigación:** `Autorizo TICKET-STAFF-INVITE-REDIRECT-LOCALHOST3000`

---

## CAUSA RAÍZ CONFIRMADA (2026-09-29)

No era el código (`SITE_URL` en el edge function ya tenía el default correcto, `https://miamidjbeat.com`). Eran **dos configuraciones de Supabase Auth mal puestas, independientes del código**:

1. **Authentication → URL Configuration → Site URL** estaba en `http://localhost:3000` (debía ser `https://miamidjbeat.com`).
2. **Authentication → URL Configuration → Redirect URLs** estaba **completamente vacía** — sin ninguna URL permitida ahí, Supabase Auth ignora el `redirectTo` que pide `generateLink()` y siempre cae al Site URL de arriba, sin importar lo que la función pida.

**Fix aplicado:**
- Site URL → `https://miamidjbeat.com`
- Redirect URLs → se agregó `https://miamidjbeat.com/**` (comodín, cubre cualquier ruta del sitio)
- De paso se redesplegó el edge function `create-platform-account` (v9→v10) para forzar que tomara el secreto `SITE_URL` actualizado, aunque al final esa no era la causa real — el secreto del edge function ya estaba bien desde el primer intento.

**Verificado en vivo:** se borró y recreó la cuenta de prueba (`wendy.miamidjbeat@gmail.com`, rol seller) tres veces durante el diagnóstico. El tercer link generado ya trae `redirect_to=https://miamidjbeat.com/auth.html?invited=1&type=seller` — correcto.

**Nota para el futuro:** si otro flujo de invitación/recuperación de contraseña también falla con un link a `localhost`, revisar primero esta misma pantalla de Auth (Site URL + Redirect URLs) antes de tocar código — es la causa más probable, no el edge function.

---
ESTADO: ✅ RESUELTO — verificado en producción con cuenta real (wendy.miamidjbeat@gmail.com)
