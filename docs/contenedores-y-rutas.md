# Contenedores y rutas — mapa OFICIAL (2026-09-21)

Los contenedores reutilizables son **3 y son diferentes a propósito**: **Artista · Staff (incl. owner) · Cliente**. Cada uno tiene su menú, su diseño y sus páginas. **Nunca se comparte un menú entre portales ni se abre a un perfil en la página de otro rol.** (Origen: alerta roja del PO, 2026-09-21, cuando un CLIENTE apareció dentro de la hoja del ARTISTA.)

## Páginas de cada contenedor
| Contenedor | Páginas | Muralla (guarda de rol) |
|---|---|---|
| **Artista / Staff / Owner** | `account-settings.html` (ajustes), `dj-dashboard.html` (estación), `staff.html`, `staff-admin.html`, `staff-agenda.html`, `staff-order.html`, `account-profile.html` (redirige a `account-settings.html`) | `role-guard.js data-role="dj"` (permite artist, owner, admin, manager, seller). `account-settings.html` declara además `data-client-home="./client-account.html"` y **nace oculta** (`data-mdj-guard`) hasta que la guarda decide. |
| **Cliente** | `client-account.html` (ajustes), `client-portal.html` (portal), `client-billing.html` | `role-guard.js data-role="client"` en `client-account` y `client-billing`; `client-portal.js` expulsa a owner/staff **y a artistas** a su casa. |

## Reglas
1. Ningún archivo del contenedor CLIENTE enlaza ni navega a una página del contenedor ARTISTA/STAFF (salvo los redireccionamientos que **expulsan** al rol equivocado).
2. Todo destino se decide por **ROL**, nunca por un parámetro que escribe cualquiera (`?redirect=`). El login corrige el destino con `containerAwareTarget(redirect, user)`.
3. **Rol desconocido = CLIENTE** (mínimo privilegio), nunca artista. Un cliente **no tiene** fila en `dj_profiles`: «sin fila» no significa artista.
4. La guarda es una muralla de **interfaz**; la seguridad real de los datos es RLS / `is_staff*()` en Postgres.

## Causas encontradas del cruce (todas corregidas)
1. `account-settings.html` **no cargaba ninguna guarda de rol** (lo veía cualquier usuario con sesión) y conservaba código antiguo que también servía a clientes.
2. `login.html` obedecía `?redirect=` sin mirar el rol; el CONFIG de un invitado apunta a `login.html?redirect=account-settings` → un cliente que iniciaba sesión ahí caía en la hoja del artista.
3. `auth.js` (`mdjLoginSafeFallbackUrl`): el rol **desconocido** caía en `account-settings.html`.
4. `header-smart-search.js`: trataba «sin fila en dj_profiles» como artista y mandaba al **cliente** a `account-settings.html` / `dj-dashboard.html` / `dj-profile.html`.
5. Enlaces directos de páginas del cliente a la hoja del artista: `client-portal.html` («Dirección de facturación y evento»), `client-account.html` («Abrir Ticket de Soporte» → `account-settings.html?panel=notifications`), `account-billing.js` (botón de `client-billing.html`).
6. `client-portal.js` expulsaba a owner/staff pero **no al artista** (un artista veía el portal del cliente vacío).

## Qué se cambió
- `account-settings.html`: nace oculta + carga `role-guard.js` (tras `auth.js`).
- `role-guard.js`: `data-client-home` (destino propio del cliente al ser denegado), `_revelar()` al permitir, `location.replace` al denegar.
- `login.html`: `containerAwareTarget`. `auth.js`: rol desconocido → `client-portal.html`. `header-smart-search.js`: rol por fila → JWT → cliente; `settings` del cliente → `client-account.html`.
- `client-portal.html` y `account-billing.js`: enlaces → `client-account.html`. `client-account.html`: «Abrir Ticket de Soporte» → contacto público (`index.html#contact`), neutral para todos los roles.
- `client-portal.js`: expulsa también a artista/dj/talent.

## Cómo verificar (y no volver a cruzar)
```
node scripts/verificar-contenedores.mjs
```
Sale con código 1 si reaparece un hueco grave. Revisa: C1-C5 (enlaces y murallas), C6 (nadie decide permisos con `user_type`, que escribe el propio usuario; solo vía `mdjUserTypeLegacy`) y C7 (base de datos: con `SUPABASE_DB_URL` + `psql` ejecuta `public.mdj_auditar_roles()`; sin eso avisa «BD no verificada»; también se puede correr esa función a mano en el SQL editor — `supabase/scripts/20260921_auditoria_roles_bd.sql`). Probado **en rojo**: contra `origin/main` (código anterior) da **9 fallos graves**; con este cambio, **0**. Correrlo antes de cada PR que toque rutas, menús, login o guardas.

## Cruces que existen POR DISEÑO (avisos del verificador; requieren decisión del PO)
- ~~`dj-dashboard.html` «Ver Portal»~~ — RETIRADO 2026-09-21 (el artista no puede abrir el portal del cliente). Sigue en `staff-agenda.html` (staff sí puede: modo manager) y en `weather-lab.html` (página de laboratorio, sin revisar).
- `staff-admin.html` abre `client-portal.html?lead=…` para revisar la orden de un cliente (vista de staff).
- Enlaces `#mainNav-config-link` que apuntan a `client-account.html` en las páginas de artista/staff son el **valor por defecto de invitado** que `mdjb-shared-header.js` reescribe según el rol al cargar.

## Restos antiguos conocidos (náufragos, sin quitar todavía)
- `account-settings.html` conserva rutas de guardado para clientes (`handleClientSettingsSubmit` / `client_profiles`) de cuando los contenedores no estaban separados. Con la muralla ya no las alcanza un cliente; quitarlas exige comprobar que los artistas no las usan.
