# Constitución · Ficha técnica de MDJPRO

**Producto:** MDJPRO — *Magic DJ Pro*
**Titular:** Miami DJ Beat LLC · © 2024-2026
**Naturaleza:** aplicación **nativa de escritorio para macOS**, distribuida como instalador `.pkg`
**Estado del documento:** declaración constitucional. Fecha de asiento: 2026-08-18.

---

## 0. Por qué MDJPRO necesita ficha propia en la Constitución

Todo lo demás que gobierna esta Constitución vive en el navegador y en Supabase. **MDJPRO no.** Se descarga, se instala y se ejecuta en la máquina del DJ, fuera del navegador y fuera de nuestro control directo.

Eso rompe un supuesto implícito de los artículos existentes: que revocar el acceso equivale a invalidar una sesión. Aquí no. Una aplicación ya instalada sigue en el disco del usuario aunque deje de pagar, así que la autoridad tiene que viajar **hasta el hardware** y renovarse periódicamente. De ahí el tercer nivel de identidad que se declara abajo, y que **hoy no está recogido en ninguna otra parte de la Constitución**.

Este documento **no** describe el flujo de licenciamiento. Eso ya está escrito y vigente en [`mdjpro-licensing-architecture.md`](./mdjpro-licensing-architecture.md); duplicarlo crearía dos verdades. Aquí se asienta únicamente **quién es quién** y **por qué canal paga**.

---

## 1. Jerarquía oficial de identidades

La autoridad sobre MDJPRO se compone de **tres niveles encadenados**. Ninguno basta por sí solo, y el orden importa: cada nivel solo tiene sentido si el anterior se sostiene.

### Nivel 1 · Cuenta (Tenant)

**Qué es:** el perfil de usuario en Supabase, identificado por el **Auth UID**.

**Dónde vive:** `auth.users` → `public.dj_profiles` / `public.client_profiles`.

**Qué responde:** *¿quién eres en el ecosistema Miami DJ Beat?*

Es el nivel que decide el **derecho**: si esta cuenta tiene o no acceso a MDJPRO, y por cuál de los dos canales del §2. Se apoya en la columna `plan` y en la línea de autoridad `fenix_can()` / `fenix_puede()` de la cimentación 2A.

Enlaza con la identidad permanente `FENIX-XXXXXXXX` (M1), que es la que debe aparecer en cualquier rastro de auditoría — nunca el `user_id` crudo.

### Nivel 2 · Sesión web (Concurrencia)

**Qué es:** el dispositivo desde el que se navega la plataforma.

**Dónde vive:** `public.user_login_devices`, escrita en **cada inicio de sesión con contraseña** por `web/auth.js` a través del RPC `mdj_record_login_device`.

**Qué responde:** *¿desde dónde estás entrando a la web?*

Es el nivel de la **sesión**, no del derecho. Sirve para concurrencia, para alertas de acceso nuevo y para que el usuario pueda expulsar un dispositivo que no reconoce. Es también el puente por el que la web entrega la activación a la app: el archivo `.mdjhandoff` nace de una sesión web autenticada.

**No confundirlo con el Nivel 3.** Este identifica un *navegador*; el siguiente identifica una *máquina*.

### Nivel 3 · Hardware ID físico (el que MDJPRO añade)

**Qué es:** el **número de serie inmutable de la Mac**, leído del hardware.

**Cómo se obtiene:** vía **IOKit**, consultando `IOPlatformExpertDevice` y leyendo `kIOPlatformSerialNumberKey` — implementado en `LicenseManager.swift` (~línea 841 del proyecto nativo).

**Dónde se custodia:** en el **Llavero de macOS (Keychain)**, protegido por **biometría (Touch ID)**. La app no guarda credenciales en texto ni en preferencias.

**Dónde se registra del lado servidor:** `public.mdjpro_device_leases`, una concesión por máquina, con tope de asientos y caducidad.

**Qué responde:** *¿en qué máquina física se está ejecutando la aplicación?*

Es el nivel que hace **ejecutable** la revocación. Sin él, dejar de pagar no tendría consecuencia sobre una app ya instalada.

### Cómo se componen

```
Nivel 1  Cuenta (Auth UID)          →  ¿tiene derecho?      →  dj_profiles.plan / fenix_puede()
   │
   └─ Nivel 2  Sesión web            →  ¿desde qué navegador? →  user_login_devices
        │                                                        (emite el .mdjhandoff)
        └─ Nivel 3  Hardware ID       →  ¿en qué máquina?      →  mdjpro_device_leases
                                          (IOKit + Keychain)
```

**Regla constitucional:** el derecho se concede en el Nivel 1 y se **ejerce** en el Nivel 3. El Nivel 2 es el conducto por el que viaja, nunca la fuente. Una concesión de Nivel 3 no puede sobrevivir a la pérdida del derecho de Nivel 1 — de ahí el latido periódico (*heartbeat*) y el periodo de gracia offline: la app puede trabajar sin red un tiempo acotado, pero no indefinidamente.

**Privacidad — límite duro:** el número de serie identifica una **máquina física de una persona concreta**. Se trata con el mismo criterio que `device_fingerprint` en M4: **no se escribe en `audit_log`**. Lo que sí se audita es el hecho (dispositivo activado, revocado), nunca el identificador. La misma razón por la que M4 excluye la huella.

---

## 2. Matriz de cobro: los dos canales

MDJPRO se paga por **dos vías que conceden lo mismo** y que el sistema debe poder distinguir. La distinción vive en la columna `plan_source` de `mdjpro_license_keys` y se unifica en la puerta `mdjpro_effective_license_gate`.

| | **Canal 1 · Renta independiente** | **Canal 2 · Membresía Artista Pro** |
|---|---|---|
| Quién | Cualquier DJ, sin ser miembro | Artista con membresía Miami DJ Beat activa |
| Precio | **19,99 USD/mes** (y variante anual) | Incluido en la membresía |
| `product_line` en Stripe | `mdjpro_app` | `mdj_artist_pro` |
| Parámetro de checkout | `app_monthly` / `app_annual` | `monthly` / `semestral` / `annual` |
| `plan_source` | `mdjpro_standalone` | `miamidjbeat_pro` |
| Precio en Stripe | secreto `STRIPE_PRICE_APP_MONTHLY` / `_ANNUAL` | secretos de la línea artista |
| **Estado real** | ⚠️ **incompleto** — ver §2.1 | ✅ **vivo en producción** |

Existe además `plan_source = 'manual'`, reservado a concesiones administrativas (cortesías, founder, soporte). No es un canal comercial y no debe usarse para sortear el cobro.

### 2.1 · Estado honesto del Canal 1

El canal independiente **no está terminado**, y conviene que la Constitución lo diga en vez de dar por hecho que funciona:

- `create-checkout` **sí** sabe crear la suscripción (`app_monthly` / `app_annual` → `product_line: mdjpro_app`).
- El webhook **sí** llama a `mdjpro_issue_license` tras el cobro.
- Pero `mdjpro_issue_license` solo contempla `miamidjbeat_pro` y `manual`. **Cualquier otro `plan_source` cae en la rama final y devuelve `unsupported_plan_source`** (migración `20260608100000`, líneas ~186-201).

**Consecuencia práctica:** un cliente independiente podría pagar y **no recibir su clave**. El valor `mdjpro_standalone` existe en el enum, pero la función que emite la licencia lo rechaza.

**Lo que falta es acotado:** añadir su rama en el `ELSIF` de `mdjpro_issue_license` (decidiendo de qué suscripción de Stripe cuelga, ya que no habrá `dj_profiles.subscription_id` de artista detrás), y confirmar que el secreto `STRIPE_PRICE_APP_MONTHLY` esté configurado. **No es un subsistema por construir: es una rama por cerrar.**

### 2.2 · Desconexión por impago

Ya está vigente y en los dos sentidos, gobernado por `stripe-webhook`:

| Evento de Stripe | Efecto |
|---|---|
| `invoice.payment_failed` | `mdjpro_apply_subscription_lapse(p_uid, p_mode: 'pause')` |
| `customer.subscription.deleted` | `mdjpro_apply_subscription_lapse(p_uid, p_mode: 'revoke')` + plan a `LITE` |
| pago recuperado | `mdjpro_apply_subscription_restored(p_uid)` |

En el cliente, el efecto se materializa en el gate único `canUsePremiumFeatures` de `LicenseManager`, que es lo que cierra el **Library Wizard** y las herramientas Premium del Tag Master.

**Nota de diseño que la Constitución debe preservar:** la desconexión es **gradual, no instantánea**. Primero `pause` (recuperable), luego `revoke`. Y existe una gracia offline. Es deliberado: un DJ **en medio de un evento** no puede quedarse sin herramienta porque una tarjeta falló esa noche. La ejecución del cobro no debe poder arruinar un evento en curso.

---

## 3. Requisitos que la ficha declara

- **macOS 12+** (14 Sonoma recomendado).
- **Solo Apple Silicon** (M1-M4). Macs Intel **no soportadas** — es el filtro más restrictivo del producto y condiciona a quién se le puede vender.
- 8 GB RAM mínimo; 16 GB para librerías > 50 000 pistas. **SSD requerido.**
- Integración: Serato DJ Pro (nativa), Rekordbox (XML Bridge), VirtualDJ (virtual folders).

---

## 4. Qué NO cubre este documento

- **El flujo de licenciamiento, activación y heartbeat** → [`mdjpro-licensing-architecture.md`](./mdjpro-licensing-architecture.md).
- **La línea de autoridad `fenix_puede()`** → [`fenix-2A-authority-blueprint.md`](./fenix-2A-authority-blueprint.md) y el plan M1-M5.
- **El manual de usuario** → `web/manuals/MDJPRO_Manual/<lang>/index.html` (v1.0.0-PRO, 17 capítulos, 6 idiomas).

---

## 5. Asiento pendiente en la línea M1-M5

La Constitución cataloga hoy **dos** mecanismos de identidad de dispositivo: `user_login_devices` (vivo) y las columnas muertas `known_devices` / `security_preference`.

**El Hardware ID de MDJPRO es un tercero, y no está recogido.** Cualquier artículo futuro sobre dispositivos que se redacte sin contemplarlo quedará incompleto, porque describirá solo la mitad navegador del ecosistema.
