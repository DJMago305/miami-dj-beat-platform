# TICKET — Rol genérico "dj" en identity.user_roles + perfiles pendientes de aprobar
Creado 2026-09-27 a pedido del PO, tras revisar los 7 DJs con `seo_publish_status='pending'`.

## 1. Hallazgo estructural: `identity.user_roles` no distingue tipos de talento
`dj_profiles` se usa como tabla única para DJs, bartenders, orquestas/músicos en vivo y aparentemente hasta clientes — la única señal de "qué tipo de talento es" vive en un campo de texto libre (`artist_specialty`/`roles`), llenado por la propia persona al registrarse, sin verificación. A nivel de identidad/RBAC real (`identity.user_roles`), **todos comparten el mismo rol genérico `{dj}`**, confirmado con estas 5 cuentas:

| Cuenta | Lo que realmente es (confirmado por el PO) | `artist_specialty` | `identity.user_roles` |
|---|---|---|---|
| DJ Ary | DJ real | `DJ` | `{dj}` |
| JULITO DJ PMM | DJ real | `dj` | `{dj}` |
| Jean Paul (Vergara) | Bartender | `bartender` | `{dj}` |
| AHI NA MA (Yury Cabrera) | Orquesta Latina / Músicos en Vivo | `MÚSICOS EN VIVO` | `{dj}` |
| Aron Rosso | **Cliente**, no talento | `NULL` | `{dj}` |

El caso de Aron Rosso es el más serio: es un cliente de la plataforma y sin embargo tiene el mismo rol `dj` que un DJ real — el sistema no tuvo ninguna forma de impedirlo, porque el rol no depende de una verificación, solo de que la cuenta pasó por el flujo de registro de "talento" en algún momento.

**Por qué importa:** cualquier lógica que confíe en `identity.user_roles = 'dj'` para decidir "esta persona es un DJ/talento legítimo" (permisos, paneles, automatizaciones futuras) heredaría este mismo problema — no es solo cosmético en el buscador público, es la fuente de verdad de identidad de todo el sitio.

**Sin construir por orden del PO** — «documéntalo en un ticket, no construyas aún». Posibles direcciones (sin decidir): (a) roles más específicos en `identity.user_roles` (`dj`, `bartender`, `musico`, etc.); (b) una revisión manual/periódica de cuentas con rol `dj` cuyo `artist_specialty` no calce con ninguna categoría de talento conocida; (c) un paso de verificación al registrarse como talento.

## 2. Los 7 "pendientes" — resueltos uno por uno con el PO (2026-09-27)

| DJ | Decisión del PO | Acción tomada |
|---|---|---|
| DJ Ary | Es DJ real | **Aprobado** (`seo_publish_status='approved'`) — pero sigue sin aparecer en `find-dj.html`: no tiene bio (solo foto). Falta cargarle biografía. |
| JULITO DJ PMM | Es DJ real | **Aprobado** — mismo caso: sin bio, no aparece todavía. |
| Jean Paul (Vergara) | Es bartender, no DJ | Sin tocar — no es candidato a `find-dj.html` (categoría distinta); si se aprueba algún día sería para un listado de bartenders/staff, no de DJs. |
| AHI NA MA (Yury Cabrera) | Es orquesta Latina / Músicos en Vivo, categoría distinta | Sin tocar — mismo caso que Jean Paul. |
| Aron Rosso | Es cliente, no talento | Sin tocar `seo_publish_status` — el problema real es el rol `dj` que no debería tener (sección 1). No se le aprobó nada. |
| Jaziel (Jay Vilarino) | El PO no lo reconoce — investigado | Registro real vía email/contraseña (no Google), correo y teléfono confirmados, 10 sept 2026, un solo ingreso, perfil incompleto (sin foto ni bio) — no hay evidencia de fraude, solo alguien que se registró y nunca volvió. Sin tocar. |
| Gerardo A Valle (cuenta del propio PO) | Cuenta de staff/admin, distinta de su perfil DJMago305 ya aprobado | No es un DJ pendiente real — se excluye siempre por diseño (`dj_slug === "owner"` en `isEligibleForPublicSearch`). |

## 3. Backfill de `categoria` en los 6 perfiles reales (2026-09-27, tras PR #514)
El PR #514 solo cablea `categoria` para registros NUEVOS a partir de hoy — no tocaba los perfiles que ya existían. Con las categorías reales ya confirmadas por el PO en este ticket, se escribió directo en producción (dato, no código — sin PR):

| Cuenta | `categoria` escrita |
|---|---|
| DJ Ary | `dj` |
| JULITO DJ PMM | `dj` |
| DJYuyo | `dj` |
| DJSolitario | `dj` |
| Jean Paul | `bartender` |
| AHI NA MA | `orquesta` |

Verificado: 7 de 9 perfiles reales (sin contar al dueño) ya tienen `categoria` (los 6 de arriba + DJMago305, que ya la tenía). **Aron Rosso y Jaziel quedan sin categoría, a propósito** — el primero es cliente (sección 1), el segundo nunca completó su perfil.

## 4. Aron Rosso — CORREGIDO DE RAÍZ (2026-09-27), no solo documentado
El PO señaló que ya lo había dicho «mil veces»: es cliente, no talento. La sección 1 solo lo había documentado sin actuar — corregido ahora de verdad, migrado al patrón real que ya usan otras 2 cuentas de cliente (Wendy E Ayala, Tiago Rosso):
1. Verificado cero referencias en 11 tablas dependientes antes de tocar nada.
2. **Creada** su fila en `client_profiles` (nombre, email, teléfono, ciudad — migrados desde `dj_profiles`, nada se perdió).
3. **Corregido** `identity.users.account_type`: `artist` → `client` (había un trigger `enforce_role_coherence()` que exige este orden: primero `account_type`, después el rol).
4. **Corregido** `identity.user_roles.role`: `dj` → `client`.
5. **Borrada** su fila de `dj_profiles` — ya no existe como talento en ningún lado.

Verificado el resultado final: `dj_profiles`=0, `client_profiles`=1, rol=`client`, tipo de cuenta=`client`. El hallazgo estructural de la sección 1 (rol genérico `dj`) sigue documentado sin construir para el resto de cuentas — este fue un arreglo puntual de un caso real, no la solución general.

## Cómo aplicar
1. DJ Ary y JULITO DJ PMM: aparecerán en `find-dj.html` en cuanto se les cargue una biografía — no requiere ninguna otra migración ni aprobación adicional, la compuerta ya está lista.
2. ~~El hallazgo del rol genérico (sección 1) queda documentado, sin construir, hasta que el PO decida una dirección.~~ **RESUELTO 2026-09-28** — ver sección 5.
3. Jean Paul y AHI NA MA no van en `find-dj.html` por diseño — no son DJs; si el PO quiere un listado separado para bartenders/staff u orquestas, es un ticket aparte, no pedido hoy.

## 5. Rol genérico `dj` — RESUELTO (2026-09-28), dirección elegida: roles específicos
El PO eligió la dirección (a) de la sección 1: roles más específicos en `identity.user_roles`, reutilizando lo que ya existía en el enum cuando alcanzaba.

**Auditoría de impacto ANTES de aplicar** (con datos reales, no supuesto): nada en el frontend ni en las Edge Functions lee `identity.user_roles` directamente hoy — la navegación/permisos reales del sitio dependen de `dj_profiles.role` (columna distinta, sin relación automática) y de `auth.jwt() → app_metadata.role` (para las 3 políticas RLS de escritura en `dj_profiles`/`artist_rates`, que ya valen `'artist'` para las 2 cuentas tocadas, no `'dj'`). Conclusión: el cambio es seguro, cero regresión de comportamiento hoy — corrige la fuente de verdad para lógica futura, que es exactamente el problema que documentó la sección 1.

**Cambios aplicados a PRODUCCIÓN:**
- `identity.app_role` (enum): agregado `'bartender'` — ningún valor existente (`dj`/`performer`/`producer`) representaba con precisión a un bartender; migraciones `20260928160000_identity_role_bartender_enum.sql` + `20260928161000_identity_roles_talent_type_backfill.sql`.
- `identity.role_allowed()`: `account_type='artist'` ahora acepta `bartender` además de `dj`/`performer`/`producer`.
- **Jean Paul (Vergara)**: `identity.user_roles.role` → `bartender` (coincide con `categoria='bartender'`, ya escrita en la sección 3).
- **AHI NA MA (Yury Cabrera)**: `identity.user_roles.role` → `performer` (coincide con `categoria='orquesta'`; el enum ya tenía este valor sin usar, 0 cuentas).
- El resto de cuentas con `role='dj'` (DJ Ary, DJMago305, DJSolitario, DJYuyo, JULITO DJ PMM, Jaziel) **son DJs reales o perfiles incompletos sin evidencia para reclasificar** — quedan en `dj` sin tocar, a propósito.
- `dj_profiles.role` (columna activa, distinta) **no se tocó** — fuera de alcance de este ticket, decisión aparte si algún día hace falta.

Verificado de forma independiente tras aplicar: los 9 perfiles reales muestran exactamente el rol esperado en `identity.user_roles`, sin cambios fuera de las 2 filas exactas (guardas dobles `user_id` + `stage_name` en las migraciones).

**Pendiente real, sin construir**: Jaziel sigue sin `artist_specialty`/`categoria` — perfil incompleto, sin evidencia para clasificarlo, queda en `dj` por defecto. Si algún día se decide activar la dirección (c) del ticket (verificación al registrarse), sería la forma de cerrar este hueco de raíz para cuentas futuras.
