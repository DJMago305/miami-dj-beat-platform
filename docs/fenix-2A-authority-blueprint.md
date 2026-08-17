# FÉNIX / Miami DJ Beat — Blueprint 2A: Autoridad Única

> Documento de referencia (no ejecuta nada). Rige de la fase 2A hasta la 7.
> Principio: **FÉNIX** = infraestructura + fuente de inteligencia. **ELIXIR** = la voz que
> comunica, prepara y *solicita* acciones. El **usuario** conserva soberanía (identidad,
> datos, conexiones, dinero, permisos). **Miami Beat** conserva control (seguridad,
> límites económicos, planes, disponibilidad, anti-abuso).
> Meta simultánea: **SEGURIDAD + PRIVACIDAD + CONTROL HUMANO + AUTOMATIZACIÓN + ESCALABILIDAD + RENTABILIDAD.**

---

## 0. Los 5 conceptos, separados (nunca mezclar)

| Concepto | Fuente de verdad | Ejemplo |
|---|---|---|
| **1. Identidad** | Supabase Auth + `dj_profiles.user_id` (UUID sellado) | quién es |
| **2. Rol** | `dj_profiles.role` (+ `is_staff()`) | artist / manager / seller / admin / owner |
| **3. Plan** | `dj_profiles.plan/plan_type` + Stripe | free / pro / super |
| **4. Permisos / Consentimientos** | `fenix_consents` (+ OAuth scope del proveedor) | calendar.read = sí, marketing.use_calendar_dates = no |
| **5. Autoridad de ejecución IA** | `fenix_can()` + nivel read/prepare/execute | preparar sí, ejecutar no |

> `artist` ≠ Pro. `manager` ≠ tocar finanzas. OAuth `calendar.read` ≠ que FÉNIX cree eventos.

---

## 1. Modelo de Autoridad Única — `fenix_can()`

**Una sola función compone TODO** (deny-by-default). Se llama desde Edge Functions (y opcionalmente RLS):

```
fenix_can(user, action, resource, context) → allow | deny
   compone:  ROL + PLAN + ENTITLEMENT + CONSENTIMIENTO + OAuth scope + CUOTA + nivel de ejecución
```

- **RLS se queda** como backstop de datos (ya es deny-by-default en la DB). `fenix_can()` unifica la decisión de *app* y compone las capas que la RLS no conoce (plan, consentimiento, cuota).
- El **frontend** solo tiene un espejo *solo-lectura* para pintar UI; **nunca se confía en él**.
- Ningún módulo inventa su propia autoridad. Perfil, CRM, contratos, pagos, SoundForTips, promociones, Gmail, Calendar → **todos consultan `fenix_can()`**.

### Tres niveles de autoridad IA
| Nivel | Qué hace | Gate |
|---|---|---|
| **1 · READ** | FÉNIX consulta datos autorizados. No modifica. | `fenix_can(*, '*.read')` |
| **2 · PREPARE** | ELIXIR redacta correos/campañas/contratos/eventos. **Requiere aprobación humana.** | `fenix_can(*, '*.prepare')` + HITL |
| **3 · EXECUTE** | FÉNIX ejecuta acciones **previamente autorizadas**, con alcance y límites. | `fenix_can(*, '*.execute')` + aprobación explícita |

> **Nunca** `READ = WRITE` ni `WRITE = EXECUTE`. ⚠️ **Hallazgo forense:** hoy la autoridad IA vive en el *prompt* de ELIXIR (guía), no en un gate — el Bloque 2 real debe pasar por `fenix_can()`, no por el texto.

---

## 2. Modelo de Planes / Entitlements

- **No codificar contra el string "PRO".** Consultar siempre `plan_entitlements` (plan → funciones).
- Modificar un plan **no** modifica roles.
- `FREE` conserva lo esencial (perfil, identidad, bio, foto, funciones públicas, IA limitada) → botón "Actualizar a Pro".
- `PRO` = mayor capacidad IA, ELIXIR avanzado, conexiones, automatizaciones, Gmail/Calendar, campañas.
- `SUPER` = preparado en arquitectura (mayor capacidad, modelos superiores, agentes complejos); no se activa comercialmente aún.

Columnas de `plan_entitlements`: `ai_tier · monthly_ai_capacity · gmail_read/compose/send · calendar_read/write · campaign_prepare · automation_level`.

---

## 3. Modelo de Consumo / Costos

- **Ledger** `ai_usage_events`: input/output tokens, modelo, tool_calls, costo estimado, por usuario/día/mes/modelo/plan.
- **Cost Governor central** — cadena obligatoria antes de cada operación de IA:
  ```
  REQUEST → AUTH → AUTHORITY(fenix_can) → CONSENT → PLAN → ENTITLEMENT → QUOTA → COST GOVERNOR → MODEL ROUTER → TOOL EXEC → USAGE LOG
  ```
- **Model Router** (server-side): tarea simple → modelo económico; tarea compleja → capacidad superior *si plan+cuota lo permiten*. Ningún frontend elige el modelo caro.
- **3 modos:** FULL (dentro de cuota) · SAVER (~80-90%: modelos económicos, menos contexto) · ESSENCIAL (cuota agotada: **no bloquear la cuenta**; perfil/config/seguridad/esencial siguen; IA costosa en pausa). Mensaje comercial, nunca "TOKEN LIMIT EXCEEDED".
- **Protección económica de Miami Beat:** `user_quota · user_cost_budget · daily/monthly_limits · platform_budget` + **circuit breakers** (loop/bug/abuso/explosión de tool calls → detener antes de perder dinero). Los límites internos **no** los puede desactivar el usuario.
- **Rentabilidad:** telemetría para calcular `REVENUE − AI cost − infra − pago − storage = margen`. **No** hardcodear cuotas definitivas sin datos reales.
- **Add-ons:** arquitectura preparada para vender capacidad adicional sin cambiar de plan (no activar aún).

---

## 4. Modelo OAuth (base para Gmail/Calendar/Contacts)

- **Authorization Code + PKCE.** `client_secret` + refresh tokens **solo server-side** (Supabase secrets + Edge Functions). ELIXIR **nunca** recibe tokens crudos.
- Flujo: `frontend → oauth-start → consentimiento Google → oauth-callback (valida state/PKCE, canjea code) → guarda cifrado`.
- Tabla `oauth_connections` (por usuario/proveedor, tokens cifrados, RLS estricta).
- **Scopes mínimos e incrementales:** Gmail `readonly → compose → send`; Calendar `readonly → events`. Se escala solo cuando la función lo requiere.
- **Dos capas que deben coincidir:** `OAuth scope válido` **+** `Consentimiento FÉNIX válido` **+** `Plan válido` **+** `Cuota disponible` **+** `Autoridad suficiente` → recién entonces la operación ocurre.
- Refresh/expiración/revocación server-side; revocación de Google detectada en el próximo refresh fallido.

---

## 5. Auditoría + Deny-by-default

- `audit_events`: actor · action · resource · owner · result · verification_method · timestamp. Registra cambios de permisos/conexiones/financiero/seguridad/aprobaciones/ejecuciones/plan/automatizaciones.
- **DENY-BY-DEFAULT** en todo: sin permiso demostrable, permiso expirado, OAuth revocado, plan sin la función, HITL sin aprobación, o cuota agotada → **NO EJECUTAR** (o degradar al modo permitido).
- **Verificación de cambios sensibles** (`verification_codes`, hash + un solo uso + expira + intentos): password, email, teléfono, banco, payout, permisos críticos, borrado de cuenta, transferencia de propiedad, automatizaciones financieras. Preparado para EMAIL/SMS hoy → TOTP/authenticator/passkeys/security keys después.

---

## 6. /configuración = la bóveda del perfil

Centro privado por usuario, aislamiento estricto (un usuario nunca modifica lo de otro sin autorización). Alberga: identidad legal/artística, bio/foto/hero (split **PRIVATE vs PUBLIC**), email/teléfono/dirección, idioma/zona, contraseña/seguridad, **plan/suscripción/pagos/payout/facturación**, conexiones externas, permisos, automatizaciones, privacidad, sesiones/dispositivos, **accesos delegados** (manager con permisos acotados ≠ propiedad), historial de seguridad. **Profile ID = solo lectura** (sellado, sin botón de edición). Sección nueva **"Plan e Inteligencia"** (plan/estado/renovación/uso/capacidad/modo + botones según estado).

---

## 7. Orden de implementación (fijo)

**Cimentación primero (A→K):** Authority → Roles → Ownership → Permissions → Consent → Plans → Entitlements → AI quotas → Cost Governor → Audit → /configuración.
**Después (L→T):** OAuth → Gmail → Calendar → Contacts → Artist Profile → Managers → CRM → Payments/Payouts → Automations.

> El **perfil de artista** consume esta arquitectura; **no crea otra.** No refactor grande del perfil hasta que la Autoridad Única esté consolidada.

---

## Estado (2026-08-16) — de este diagnóstico
- **SQL aditivo listo** (`supabase/scripts/fenix_authority_2A.sql`): 6 tablas (`plan_entitlements`, `fenix_consents`, `oauth_connections`, `ai_usage_events`, `audit_events`, `verification_codes`) + `fenix_can()`. Idempotente, RLS estricta, deny-by-default, tokens cifrados por Edge Function. **El PO lo revisa y lo corre** (🧪 PRUEBA → 🔴 PROD). Claude no toca la DB.
- **Pendiente de aprobación del PO:** correr el SQL, esqueletos de Edge Functions (`oauth-*`, `ai-governor`), refactor de `elixis-chat` para pasar por governor+log, frontend aditivo (Profile ID solo-lectura + "Plan e Inteligencia"), Google Cloud OAuth app (owner-side).
