# TICKET-PRO-CHECKOUT-004 — Botón "Upgrade PRO" no dispara checkout — pérdida directa de ingresos

**Fecha de apertura:** 2026-06-16  
**Reportado por:** DJMago305 (CEO) — observado desde teléfono móvil  
**Tipo:** Bug crítico de negocio — flujo de suscripción roto  
**Estado:** ABIERTO — pendiente de autorización para ejecutar fix  
**Prioridad:** 🔴 CRÍTICO — impacto directo en ingresos / conversión PRO  

---

## DESCRIPCIÓN DEL ERROR

Cuando un artista LITE quiere suscribirse al plan PRO desde **Configuraciones** (`account-settings.html`):

1. Hace clic en "Activar PRO" o "Upgrade →"
2. El browser lo lleva a `jobs.html?plan=PRO`
3. **No ocurre ningún checkout** — llega a la página de empleos sin flujo de pago activo
4. El artista no puede suscribirse

**Comportamiento esperado:** Click en "Upgrade PRO" → Stripe Checkout abre → artista paga → plan actualizado a PRO  
**Comportamiento observado:** Click → `jobs.html` sin checkout → sin venta

---

## CAUSA RAÍZ CONFIRMADA (diagnóstico sin tocar código)

### Los botones en `account-settings.html` son links simples a `jobs.html`

**Línea 1905:**
```html
<a id="btn-activate-pro" href="./jobs.html?plan=PRO" class="reward-redeem">Activar PRO</a>
```

**Línea 2056:**
```html
<a id="billing-upgrade-btn" href="./jobs.html?plan=PRO" class="acct-edit">Upgrade →</a>
```

Ambos son `<a href>` simples — no llaman a ningún Edge Function, no abren Stripe.

### El checkout Stripe SÍ existe en `jobs.html`

`jobs.html` tiene lógica de `create-checkout` (líneas 3842, 4841) pero está dentro de handlers de eventos específicos — **no se auto-dispara** al recibir `?plan=PRO` como parámetro URL.

### Resultado

El artista llega a `jobs.html` como si fuera a buscar trabajo, sin ningún modal de suscripción activo. Cero conversión.

---

## IMPACTO DE NEGOCIO

| Métrica | Impacto |
|---------|---------|
| Conversión PRO | **0%** desde `account-settings.html` |
| Artistas LITE que quieren subir | Bloqueados completamente |
| Ingresos perdidos | Cada artista que intentó y no pudo = venta perdida |

---

## OPCIONES DE FIX

### Opción A — Botones con onclick que llamen al checkout (RECOMENDADA)
Reemplazar los `<a href="./jobs.html?plan=PRO">` por botones con `onclick` que llamen directamente al Edge Function `create-checkout` desde `account-settings.html`.

```javascript
// Ejemplo de lo que haría el botón:
async function startProCheckout() {
  const session = await supabase.auth.getSession();
  const res = await fetch(mdbSupabaseFunctionUrl('create-checkout'), {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + session.data.session.access_token },
    body: JSON.stringify({ plan: 'pro_monthly', successUrl: location.href + '?upgraded=1' })
  });
  const { url } = await res.json();
  window.location.href = url;
}
```

**Pros:** flujo directo, sin salir de Settings  
**Cons:** necesita conocer los price IDs de Stripe del plan PRO  

### Opción B — `jobs.html?plan=PRO` auto-dispara el modal de checkout
Agregar lógica en `jobs.html` para detectar `?plan=PRO` en la URL y abrir el checkout automáticamente.

**Pros:** reutiliza código existente  
**Cons:** el artista sale de Settings y va a `jobs.html` (UX subóptima)  

---

## INFORMACIÓN NECESARIA ANTES DE EJECUTAR

- [ ] ¿Cuáles son los Stripe Price IDs para plan PRO mensual y anual?
- [ ] ¿Está el Edge Function `create-checkout` deployado y activo en producción?
- [ ] ¿Qué URL de `successUrl` debe usarse después del pago?

---

## ARCHIVOS A TOCAR (Opción A)

- `web/account-settings.html` — reemplazar 2 links por botones con checkout logic

**Para autorizar:** `Autorizo TICKET-PRO-CHECKOUT-004 Opción A`  
o  
**Para autorizar:** `Autorizo TICKET-PRO-CHECKOUT-004 Opción B`

---

## AFECTACIÓN ADICIONAL — SoundForTips (2026-06-16)

El gate de **SoundForTips** en cuenta LITE tiene el mismo problema:
- Muestra gate bloqueado con "Ver planes"
- Al hacer clic → redirige a `shop.html` en vez de checkout PRO

**Todos los gates de upgrade en la plataforma apuntan a URLs incorrectas:**

| Gate | Botón | Destino actual | Destino correcto |
|------|-------|---------------|-----------------|
| Settings → Billing | Upgrade → | `jobs.html?plan=PRO` | Stripe checkout |
| Settings → Rewards | Activar PRO | `jobs.html?plan=PRO` | Stripe checkout |
| DJ Tools | Ver planes en Jobs | `jobs.html?plan=PRO` | Stripe checkout |
| SoundForTips | Ver planes | `shop.html` | Stripe checkout |

**El fix debe aplicarse en todos estos puntos al mismo tiempo.**

---
ESTADO: DIAGNÓSTICO COMPLETO — ESPERANDO PRICE IDs DE STRIPE Y AUTORIZACIÓN
