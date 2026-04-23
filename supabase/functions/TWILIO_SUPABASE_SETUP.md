# Twilio + Supabase — paso a paso (SMS)

Guía para que **`send-sft-client-sms`** (SOUNDFORTIPS) y **`notify-dj-sms`** (recordatorios a DJ) funcionen. Los valores **nunca** van en git: solo en **Twilio Console** y en **secretos de Supabase**.

---

## Parte 0 — Confirmemos qué ya tienes (sí / no)

Marca mentalmente cada punto. Si algo falla, anota **en qué número** paraste.

### En Twilio (navegador)

1. ¿Entras a **https://console.twilio.com** y ves arriba el nombre de la cuenta (ej. **Miami DJ Beat LLC**)? → **Sí** = cuenta creada.
2. En la página principal, ¿aparece **Account Info** con **Account SID** (empieza por `AC`)? → **Sí** = ya tienes el primer dato.
3. ¿Hay un botón **Show** junto al **Auth Token**? → **Sí** = el segundo dato existe; solo falta copiarlo cuando toque (no hace falta enseñarlo a nadie).
4. ¿Ves **My Twilio phone number** con un `+1…`? → **Sí** = ese es el **remitente** (From) para `TWILIO_PHONE_NUMBER` mientras uses ese número.

Si el banner dice **Trial**, es normal: la cuenta existe; solo habrá límites (p. ej. SMS a números verificados) hasta que termines **Upgrade** y pagos si Twilio lo pide.

### En Supabase (otra pestaña del navegador)

1. Entra a **supabase.com** → tu proyecto (el de Miami DJ Beat).
2. Menú **Project Settings** (rueda dentada) → **Edge Functions** → **Secrets** (a veces “Manage secrets”).
3. ¿Existen **tres** secretos con **estos nombres exactos**?

   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`

   - **Sí, los tres** → el enlace Twilio → Supabase ya está hecho; solo falta **redeploy** de funciones (Parte D) si cambiaste algo.
   - **No o falta alguno** → sigue la **Parte C** de abajo (pegar valores desde Twilio).

### Comprobar desde tu Mac (opcional)

Si usas Supabase CLI y ya hiciste `supabase link`:

```bash
supabase secrets list
```

Deberías ver al menos los nombres `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (los valores **no** se muestran).

---

## Parte A — Entrar a Twilio

1. Abre **https://console.twilio.com** (mejor en ventana **privada/incógnito**).
2. Si usas **VPN**, desactívala para esta prueba.
3. Si no entras: **Forgot password** con el email de la cuenta **Miami DJ Beat LLC**.
4. Si sigue fallando: borra **cookies** solo de `twilio.com` o prueba otro navegador.
5. Si Twilio bloqueó la cuenta: en la ayuda oficial usa **“Need help from Twilio now?”** para ticket **sin** login.

**Resultado esperado:** ves el **Twilio Console** (dashboard) con tu cuenta.

---

## Parte B — Copiar las 3 credenciales

### B1. Account SID y Auth Token

1. En la consola, arriba a la derecha o menú de cuenta → **Account** / **API keys & tokens** (el nombre exacto puede variar).
2. Copia el **Account SID** (empieza por `AC…`).
3. Copia el **Auth Token**.  
   - Si no lo muestran: **Regenerate** → copia el nuevo **una sola vez** (el anterior deja de valer). Actualiza también Supabase si ya lo tenías guardado.

### B2. Número remitente (From)

1. Menú **Phone Numbers** → **Manage** → **Active numbers**.
2. Elige un número con **SMS** habilitado para tu caso de uso.
3. Cópialo en formato **E.164**: si es Miami típico será `+1` + 10 dígitos, ejemplo: `+13055551234` (sin espacios).

**Resultado esperado:** tres textos listos: `AC…`, token largo, `+1…`.

---

## Parte C — Pegar secretos en Supabase

1. Entra a **Supabase** → tu proyecto (el mismo que usa la web Miami DJ Beat).
2. Ve a **Project Settings** (engranaje) → **Edge Functions** → **Secrets**  
   *(o “Manage secrets” dentro de la sección Edge Functions, según la versión de la UI).*
3. Añade **exactamente** estos nombres (mayúsculas y guiones bajos):

   | Nombre del secreto | Valor |
   |--------------------|--------|
   | `TWILIO_ACCOUNT_SID` | tu `AC…` |
   | `TWILIO_AUTH_TOKEN` | tu token |
   | `TWILIO_PHONE_NUMBER` | tu `+1…` |

4. Guarda. No hace falta comillas en el dashboard.

**Alternativa CLI** (desde tu Mac, con `supabase link` ya hecho):

```bash
supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx TWILIO_PHONE_NUMBER=+1xxxxxxxxxx
```

*(Sustituye por tus valores reales; no compartas esa línea en público.)*

---

## Parte C2 — Borrar los tres y crearlos de cero (sin “valores viejos”)

Hazlo cuando quieras **cero duda** de que lo que hay en Supabase coincide con Twilio hoy.

### Antes de borrar (importante)

1. Abre **Twilio Console** en otra pestaña.
2. Anota o copia a un **bloc de notas local** (solo en tu PC): **Account SID**, **Auth Token** (Show), y el **número +1…** que usarás como remitente.
3. Opcional pero muy limpio: en Twilio, **Regenerate** del **Auth Token** → copia el token **nuevo** (el anterior muere). Así cualquier copia vieja en Supabase deja de ser válida de todas formas.

### Borrar en Supabase (Dashboard)

1. **Project Settings** → **Edge Functions** → **Secrets**.
2. Para cada uno: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` → menú **⋯** / **Delete** (o “Remove”) y confirma.
3. Comprueba que **ya no** aparezcan en la lista.

### Crear de nuevo (mismos nombres, valores nuevos)

1. **Add new secret** tres veces (o el flujo que use tu UI).
2. Nombres **exactos** (copiar/pegar para no equivocarte):

   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`

3. Pega los valores actuales de Twilio (los del bloc de notas).
4. Guarda cada uno.

### Borrar con CLI (alternativa)

Con el proyecto enlazado (`supabase link`):

```bash
supabase secrets unset TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_PHONE_NUMBER
```

Si tu versión de CLI no acepta varios nombres en una línea, ejecuta **tres** `unset`, uno por secreto. Luego:

```bash
supabase secrets set TWILIO_ACCOUNT_SID=AC... TWILIO_AUTH_TOKEN=... TWILIO_PHONE_NUMBER=+1...
```

### Después de recrearlos

Siempre ejecuta la **Parte D** (deploy de `send-sft-client-sms` y `notify-dj-sms`).

**Nota:** entre borrar y volver a crear, cualquier SMS fallará unos minutos; hazlo en una sola sesión.

---

## Parte D — Desplegar las funciones

En la carpeta del proyecto (con Supabase CLI instalado y logueado):

```bash
supabase functions deploy send-sft-client-sms
supabase functions deploy notify-dj-sms
```

Si solo cambiaste secretos y **no** el código, igual conviene redeploy para asegurar que el runtime ve los valores nuevos.

---

## Parte E — Cuenta Trial y EE. UU.

1. **Trial:** solo puedes enviar SMS a números que hayas dado de alta en Twilio como **Verified Caller IDs** (verifica el móvil de prueba).
2. **Producción:** Twilio puede pedir **A2P 10DLC** (registro de marca/campaña) para SMS desde números +1; complétalo en la consola si te lo piden.
3. El número en `TWILIO_PHONE_NUMBER` debe ser el mismo **From** que Twilio acepta para ese tipo de mensaje.

---

## Parte F — Probar

1. Inicia sesión en la web como **DJ** (flujo SOUNDFORTIPS).
2. Dispara la acción que llama a **`send-sft-client-sms`** (aceptar/denegar o el flujo que uses).
3. Si en red (F12 → Network) la respuesta es **500** con `Server configuration incomplete`, falta algún secreto o el nombre no coincide **exactamente** con la tabla de la Parte C.

---

## Extra: `notify-dj-sms` y cron

Esa función valida un header **`CRON_EDGE_AUTH_SECRET`** (no es el JWT del DJ). Solo aplica a llamadas **automatizadas** desde tu backend/cron. Para SFT desde el navegador del DJ, lo importante es la Parte C + **`send-sft-client-sms`**.
