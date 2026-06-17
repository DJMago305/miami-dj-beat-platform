# TICKET-ROLE-REDIRECT-002 — Perfil muestra pantalla de cliente en vez de pantalla de artista

**Fecha de apertura:** 2026-06-16  
**Reportado por:** DJMago305 (CEO) — observado desde teléfono móvil  
**Tipo:** Bug crítico — error de identidad / routing  
**Estado:** ABIERTO — pendiente de investigación  
**Prioridad:** 🔴 CRÍTICO — afecta artistas subscritores reales  

---

## DESCRIPCIÓN DEL ERROR

Cuando un DJ/artista suscrito hace clic en la pestaña de **Perfil** desde el navegador móvil, en algunas ocasiones el sistema lo lleva a la **pantalla de cliente** (donde se vinculan eventos) en lugar de su pantalla de artista (`dj-profile.html` o `dj-dashboard.html`).

**Comportamiento esperado:** DJ autenticado con rol `performer` → `dj-dashboard.html` o `dj-profile.html`  
**Comportamiento observado:** DJ autenticado → pantalla de cliente (`client-portal.html` o `account-profile.html`)

---

## CONTEXTO TÉCNICO

### Sistema de clasificación de identidad
El sistema usa `mdjClassifyPlatformIdentity({ user, djRow, clientRow })` en `web/mdj-identity.js` para determinar el `principal`:
- `buyer` → pantalla de cliente
- `performer` → pantalla de artista
- `staff` → admin dashboard

### Hipótesis de causa raíz (ordenadas por probabilidad)

**1. Race condition en carga de sesión (móvil = más lento)**
En móvil la red es más lenta. Si el usuario toca "Perfil" antes de que `onAuthStateChanged` haya resuelto el `djRow` desde Supabase, el sistema puede clasificar al usuario como `buyer` (porque `djRow = null`) y redirigirlo a la pantalla de cliente.

**2. `app_metadata.role` vs fila en DB desincronizados**
El JWT puede tener un `role` desactualizado que no coincide con `dj_profiles.role`. El sistema de auth usa el JWT para decisiones rápidas de menú (`mdjResolveEffectiveUserRole`), pero si el JWT dice `user` y la DB dice `performer`, hay conflicto.

**3. `client_profiles` existente para el artista**
Si el artista también tiene una fila en `client_profiles` (porque se registró antes como cliente), la lógica de clasificación puede elegir el perfil incorrecto dependiendo del orden de resolución.

**4. Caché del browser en móvil**
El browser móvil puede servir una versión cacheada de la página/script que tomó una decisión de redirect incorrecta anteriormente.

---

## ARCHIVOS SOSPECHOSOS (no tocar sin alcance autorizado)

| Archivo | Por qué es sospechoso |
|---------|----------------------|
| `web/mdj-identity.js` | Contiene `mdjClassifyPlatformIdentity` — lógica de rol |
| `web/auth.js` | `onAuthStateChanged`, resolución de sesión, redirect logic |
| `web/mdj-shared-header.js` | Header con botón Perfil — determina URL destino |
| `web/dj-dashboard.html` | Auth gate del dashboard artista |
| `web/account-profile.html` | ¿Redirige al cliente o artista? |

---

## PASOS PARA REPRODUCIR

1. Tener cuenta DJ/artista suscrito
2. Abrir desde **teléfono móvil** (red móvil, no WiFi de oficina)
3. Entrar al sitio — esperar que cargue
4. Tocar la pestaña / botón de **Perfil** rápidamente (antes de que termine de cargar)
5. Observar si lleva a pantalla de cliente

---

## DIAGNÓSTICO CONFIRMADO (2026-06-16)

**Causa raíz exacta — línea 2982 de `web/mdj-shared-header.js`:**

```javascript
var isClient = sessionIsExplicitClient
  ? true
  : (p && djRowRole === 'client') ||
    (!p && hasClientRow && !jwtArtist) ||   // ← AQUÍ ESTÁ EL BUG
    (!p && metadataSaysClient && !jwtArtist);
```

**Por qué falla en móvil:**
1. `p` (`djRow` de `dj_profiles`) = `null` momentáneamente — la consulta Supabase tarda más en móvil
2. `hasClientRow` = `true` — el owner/artista tiene fila en `client_profiles` también
3. `jwtArtist` = `false` — el JWT no tiene `user_metadata.user_type = 'talent'` ni `app_metadata.role = 'artist'` explícito
4. La condición se cumple: `!null && true && !false` = `true` → `isClient = true`
5. El header construye la navegación de cliente y redirige

**El sistema clasifica al owner/artista como cliente** durante el breve momento en que `djRow` aún no ha cargado.

## OPCIONES DE FIX

### Opción A — Actualizar JWT del owner (solución a la raíz)
Asegurar que el JWT del owner tenga `user_metadata.user_type = 'owner'` o `app_metadata.role = 'owner'`.
Con eso `jwtArtist = true` incluso antes de que `djRow` cargue, y la condición del bug nunca se cumple.

**Requiere:** script de corrección en Supabase Auth (`update_user_metadata`) + re-login del usuario.

### Opción B — Guardar el rol en localStorage como caché (fast path)
Al resolver correctamente la identidad una vez, guardar el `principal` en `localStorage`.
En cargas siguientes, usar ese valor cacheado mientras `djRow` carga.

**Pros:** fix universal para todos los artistas sin tocar el JWT.  
**Contras:** hay que invalidar el caché al hacer logout.

### Opción C — No clasificar como cliente si `djRow` aún no cargó (parche defensivo)
Cambiar la condición para que no decida `isClient = true` hasta que `djRow` haya completado la consulta.

**Para autorizar investigación y fix:** `Autorizo TICKET-ROLE-REDIRECT-002`

---

## IMPACTO

- Artistas subscritores ven una pantalla que no es la suya → confusión y pérdida de confianza
- Posible acceso a datos de cliente en vez de datos de artista
- Ocurre en **dispositivos externos** (no en el Mac del admin) → difícil de reproducir en dev

---

## PLAN DE INVESTIGACIÓN (requiere autorización del Capitán)

1. Revisar `mdj-identity.js` — validar que espera a que `djRow` esté resuelto antes de clasificar
2. Revisar el botón "Perfil" en `mdj-shared-header.js` — verificar URL de destino según rol
3. Revisar auth gate de `dj-dashboard.html` — si falla el gate, ¿a dónde redirige?
4. Agregar logs de diagnóstico temporales para capturar el estado en el momento del redirect

**Para autorizar investigación:** `Autorizo TICKET-ROLE-REDIRECT-002`

---
ESTADO: DOCUMENTADO — RECOPILANDO INFORMACIÓN — ESPERANDO AUTORIZACIÓN PARA INVESTIGAR
