# TICKET-DJTOOLS-006 — DJ Tools: flash 1s + compra standalone MDJPRO no funciona

**Fecha de apertura:** 2026-06-16  
**Reportado por:** DJMago305 (CEO) — observado en cuenta real DJYuyo  
**Tipo:** Bug visual (flash) + bug de negocio (venta bloqueada)  
**Estado:** ABIERTO  
**Prioridad:** 🔴 CRÍTICO — pérdida de ventas de app standalone  

---

## SCREENSHOT DE EVIDENCIA

Cuenta: **DJYuyo** (artista LITE real, no admin)  
URL: `miamidjbeat.com` — producción  
Página: `dj-tools.html`

![DJ Tools gate DJYuyo](../../.cursor/projects/Users-djmago-Desktop-miami-dj-beat-platform/assets/IMG_1057-b2556611-571d-4bff-b098-130484da566e.png)

---

## BUG 1 — Flash visual de 1 segundo antes del gate PRO

**Descripción:** Al entrar a DJ Tools, durante ~1 segundo se ve contenido que no debería (probablemente el contenido completo de herramientas PRO) antes de que el auth gate resuelva y muestre el lock screen.

**Causa probable:** Mismo patrón que TICKET-NAV-ARTIST-003 — contenido visible en HTML estático antes de que JavaScript evalúe el rol del usuario.

**Impacto:** Artistas LITE ven por un instante contenido PRO que no deberían ver.

---

## BUG 2 — App MDJPRO standalone no se puede comprar/descargar

**Descripción:** La app MDJPRO tiene dos modelos de acceso:
1. Incluida en el plan PRO de la plataforma
2. **Venta standalone** — el artista paga solo por la app sin necesidad de ser PRO

El gate actual solo muestra "Ver planes en Jobs" (que redirige a `jobs.html` sin checkout — ver TICKET-PRO-CHECKOUT-004). **No hay opción de comprar solo la app.**

**Impacto:** Artistas que solo quieren la app standalone no pueden comprarla. Venta perdida.

---

## BUG 3 (relacionado) — "Ver planes en Jobs" no dispara checkout

El botón en el gate de DJ Tools es el mismo problema documentado en TICKET-PRO-CHECKOUT-004:
- Href: `./jobs.html?plan=PRO`
- No dispara Stripe checkout
- El artista llega a `jobs.html` sin flujo de pago activo

---

## ACLARACIÓN DEL CAPITÁN (2026-06-16)

> "Si doy clip nuevamente en Tools estando en Tools mete el pantalazo — hay filtración pero no consistencia. Teniendo en cuenta que debería aparecer la app para si el DJ solo quiere pagar el uso de MDJPRO independiente a la suscripción PRO, no debería bloquear. Además la suscripción PRO está bloqueada."

**El flash ocurre CADA VEZ que entra a DJ Tools** — no es solo al cargar, se dispara al re-entrar también. Es una filtración de contenido PRO consistente antes del gate.

**El gate actual bloquea TODO de forma incorrecta.** Debería tener dos caminos separados:

```
DJ Tools gate — lógica correcta:
├── ¿Es PRO?  →  acceso completo a todas las herramientas
├── ¿Es LITE? →  mostrar DOS opciones:
│   ├── [Comprar MDJPRO App standalone] ← FALTA COMPLETAMENTE
│   └── [Upgrade a PRO] ← existe pero checkout roto (TICKET-004)
```

## CONTEXTO DE NEGOCIO

| Producto | Precio | Estado actual |
|----------|--------|---------------|
| Artista LITE | Gratis | ✅ Funciona |
| Artista PRO (plataforma) | Mensual/Anual | ❌ Checkout roto → TICKET-PRO-CHECKOUT-004 |
| MDJPRO App standalone | Pago único / independiente | ❌ Ni siquiera aparece la opción |

**Las dos rutas de monetización de artistas están bloqueadas. Un artista LITE no tiene ninguna forma de pagar nada desde la plataforma ahora mismo.**

---

## ARCHIVOS A INSPECCIONAR

- `web/dj-tools.html` — gate PRO, botón "Ver planes en Jobs", opción standalone
- `web/js/downloads.js` — lógica de descarga MDJPRO

**Para autorizar inspección:** `Autorizo TICKET-DJTOOLS-006`

---
ESTADO: DOCUMENTADO — ESPERANDO AUTORIZACIÓN
