# TICKET-NAV-ARTIST-003 — Tab "Configuraciones" salta a sección de compras de cliente

**Fecha de apertura:** 2026-06-16  
**Reportado por:** DJMago305 (CEO) — observado desde teléfono móvil  
**Tipo:** Bug de navegación — anchor / scroll spy incorrecto  
**Estado:** ABIERTO — pendiente de investigación  
**Prioridad:** 🔴 CRÍTICO — visible para artistas subscritores reales  

---

## DESCRIPCIÓN DEL ERROR

Cuando un DJ/artista hace clic en la pestaña **"Configuraciones"** dentro de su perfil:

1. La página hace un **salto visual (pestanazo)** hacia la sección de **compras de cliente**
2. La **franja amarilla** (marca de ítem activo `::after`) queda sobre el tab de Configuraciones aunque visualmente está mostrando contenido de cliente

**Comportamiento esperado:** Click en "Configuraciones" → muestra panel de configuración del artista, franja amarilla sobre "Configuraciones"  
**Comportamiento observado:** Click → salto a sección de compras de cliente → franja amarilla en posición incorrecta

---

## ACLARACIÓN CRÍTICA (2026-06-16)

**No es scroll dentro de la página.** El CEO confirmó que es un **salto entre pestañas del navegador** — al tocar "Configuraciones" el navegador salta (o navega) a otra pestaña que muestra el portal/compras de cliente.

## HIPÓTESIS DE CAUSA RAÍZ (revisada)

### Hipótesis 1 — `href` del tab apunta a URL de cliente (CAUSA MÁS PROBABLE)
El link "Configuraciones" en `#owner-tabs` tiene un `href` que apunta a `client-portal.html`, `account-profile.html`, o una URL similar del portal de cliente, en lugar de la URL correcta de configuraciones del artista.

### Hipótesis 2 — `target="_blank"` abre pestaña nueva con URL de cliente
El tab tiene `target="_blank"` y la URL destino es del portal de cliente. El artista ve su pestaña actual + una nueva pestaña con contenido de cliente.

### Hipótesis 3 — Lógica JS de routing usa rol equivocado
Un `onclick` o handler JS en el tab detecta el rol del usuario y redirige, pero clasifica al artista como cliente (misma raíz que TICKET-ROLE-REDIRECT-002).

---

## RELACIÓN CON TICKET-ROLE-REDIRECT-002

Ambos tickets involucran al artista viendo contenido de cliente:
- **TICKET-ROLE-REDIRECT-002:** redirect completo a pantalla de cliente al tocar "Perfil"
- **TICKET-NAV-ARTIST-003:** salto visual a sección de cliente al tocar "Configuraciones"

Pueden tener la misma raíz (rol no resuelto) o causas independientes (anchor incorrecto). Investigar en paralelo.

---

## ARCHIVOS SOSPECHOSOS (no tocar sin alcance autorizado)

| Archivo | Por qué es sospechoso |
|---------|----------------------|
| `web/dj-profile.html` | Contiene `#owner-tabs` con los tabs del artista — revisar `href` de Configuraciones |
| `web/dj-dashboard.html` | Dashboard del artista — revisar si tiene tab Configuraciones con anchor |
| `web/styles.css` | Reglas `.active::after` del scroll spy / franja amarilla |
| `web/index.html` | Scroll spy `IntersectionObserver` (línea ~1849) |

---

## PASOS PARA REPRODUCIR

1. Estar autenticado como DJ/artista suscrito
2. Navegar al perfil artista (`dj-profile.html` o `dj-dashboard.html`)
3. Hacer clic en el tab **"Configuraciones"** en la franja de navegación del artista
4. Observar:
   - ¿Hay un salto visual hacia otra sección?
   - ¿Qué contenido aparece?
   - ¿Dónde queda la franja amarilla?

---

## INFORMACIÓN ADICIONAL NECESARIA

- [ ] ¿En qué página exacta está el tab "Configuraciones"? (`dj-profile.html` / `dj-dashboard.html` / otra)
- [ ] ¿El salto ocurre en desktop también, o solo en móvil?
- [ ] ¿El `href` del tab Configuraciones incluye un `#` anchor?

---

## DIAGNÓSTICO CONFIRMADO (2026-06-16)

### Causa raíz identificada — sin tocar código

El tab CONFIG en ambas páginas apunta a:
```
./account-settings.html?mdj_nav=profile
```

`account-settings.html` tiene **`#panel-account` con `class="active"` en el HTML estático** (línea 1341). Esto significa que al abrir la página, ese panel se muestra **inmediatamente** antes de que cualquier JavaScript corra.

Ese panel contiene contenido mixto de cuenta que para un artista puede parecer "pantalla de cliente" — billing, historial, MDJB ID, sección de comprador.

**Flujo del problema:**
1. Artista toca CONFIG en `#owner-tabs`
2. Browser navega a `account-settings.html?mdj_nav=profile`
3. HTML se pinta: `#panel-account` ya está `active` → **flash visual de contenido de cuenta/cliente**
4. JavaScript carga, detecta rol artista, ajusta la vista
5. El artista ya vio el flash — "pestanazo a compras de cliente"
6. Franja amarilla queda en CONFIG porque es la página activa

### Fix propuesto (mínimo, quirúrgico)
En `account-settings.html`: cambiar `#panel-account` de `class="acct-panel active"` a `class="acct-panel"` (sin `active`) y dejar que el JS establezca el panel correcto según rol. Agregar un estado de "cargando" para evitar flash.

**Riesgo:** bajo — solo afecta el panel inicial visible al cargar. El JS ya controla qué panel mostrar según rol.

## PLAN DE EJECUCIÓN (requiere autorización del Capitán)

Archivo único: `web/account-settings.html`
Cambio único: quitar `active` del HTML estático de `#panel-account` + agregar clase loading para evitar flash

**Para autorizar:** `Autorizo TICKET-NAV-ARTIST-003`

---
ESTADO: DIAGNÓSTICO COMPLETO — ESPERANDO AUTORIZACIÓN PARA EJECUTAR FIX
