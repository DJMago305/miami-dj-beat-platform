# Plan de paso a producción · M1–M5

**Proyecto destino:** `hkuvuqupbxwkiykxvqdr` — se muestra como *djmago305@gmail.com's Project*.
Verificar la referencia en la URL antes de cada bloque. La etiqueta de la organización engaña.

**Estado de partida (2026-08-17):** producción no tiene **nada** de esta línea. El intento de M1 del 17 de agosto falló por un bug mío y revirtió limpio; no quedó ni una tabla ni una columna.

---

## Por qué producción no es ensayo

| | ensayo | producción |
|---|---|---|
| `dj_profiles` | 5 columnas, 8 filas | **110 columnas**, ~11 filas, datos reales |
| `client_profiles` | pocas columnas | **45 columnas** |
| RLS en perfiles | lo puse yo hoy | ya configurado, con políticas de staff |
| `fenix_can()` + `plan_entitlements` | sí | **sí, y en uso** |
| `user_login_devices` | la traje hoy | **viva: cada login escribe en ella** |
| Usuarios reales | 1 de prueba | los de verdad |

Tres de esos renglones son los que mandan en el riesgo.

---

## Lo que NO se ejecuta en producción

**`constitucion_alinear_rls_perfiles_ensayo.sql` — jamás.** Existe para darle a ensayo lo que producción ya tiene. Allí sobra y sus políticas son un subconjunto: no incluyen la rama de staff porque `is_staff()` no existe en ensayo. Aplicarlo sería sustituir lo bueno por lo incompleto.

**`constitucion_suite_aislamiento_rls.sql` y `constitucion_prueba_delegacion.sql` — tampoco.** Insertan concesiones de prueba, intentan `TRUNCATE` y crean datos. Son suites de ensayo.

**`constitucion_diseno_autoridad_unica.sql`** está entero comentado. No hace nada en ningún sitio.

---

## Orden, y por qué es ese

```
1 · M1   profile_id inmutable
2 · M2   audit_log + mdj_perfiles_de_usuario()
3 · M3   permission_grants
4 · M4   auditoría de dispositivos
5 · M5   fenix_puede()
```

Las dependencias son duras, no de conveniencia:
- **M2 necesita M1**: su registrador busca `profile_id` en las tablas de perfil.
- **M3 necesita M2**: sus políticas usan `mdj_perfiles_de_usuario()`, y sus disparadores escriben en `audit_log`.
- **M4 necesita M2**: comprueba `mdj_profile_de_usuario()` con una guardia explícita, y audita en `audit_log`.
- **M5 necesita M3 y la cimentación 2A**: compone `mdj_permiso_vigente()` con `fenix_can()`. Tiene guardias para las tres.

Cada archivo lleva su guardia. Si se aplican fuera de orden, paran con un mensaje que dice qué falta — como pasó con M4 en ensayo, que se detuvo sola antes de tocar nada.

---

## Los tres riesgos reales

### 1 · El disparador de M2 sobre `dj_profiles` — riesgo medio

M2 engancha `mdj_audit_perfil()` como `AFTER UPDATE` en las dos tablas de perfil. En producción eso significa que **cada vez que alguien guarda su perfil** se construye un `jsonb` de 110 columnas, se compara campo a campo y se escribe una fila en `audit_log`.

- **Volumen:** con ~11 perfiles y edición esporádica, despreciable.
- **Lo que sí importa:** si `mdj_auditar()` lanzara una excepción, **el guardado del perfil falla**. Es exactamente lo que ocurrió el 17 de agosto con el piloto que referenciaba `NEW.profile_id`. La versión actual no nombra ninguna columna a mano —lee del `jsonb`— pero la comprobación en producción es obligatoria y va en la verificación de abajo.
- **`updated_at` cambia en cada guardado**, así que siempre habrá algo que registrar. Es correcto, pero conviene saberlo: una entrada por guardado, no por cambio significativo.

### 2 · El disparador de M4 sobre `user_login_devices` — riesgo alto

**Esta tabla está viva.** `web/auth.js` llama a `mdj_record_login_device()` en **cada login con contraseña**. M4 le añade disparadores `AFTER INSERT / UPDATE / DELETE`.

Si algo de esa cadena falla, **se rompe el inicio de sesión de la plataforma**. Es el único punto del plan que puede dejar a la gente fuera.

Mitigaciones ya incorporadas:
- El disparador es `SECURITY DEFINER` y no depende del RLS del llamante.
- En el camino de `UPDATE` —el de cada login conocido, que solo toca `last_seen_at`— sale por `RETURN NEW` sin escribir nada. El coste por login es una comparación de texto.
- La huella no se registra, así que no hay conversión ni escritura pesada.

**Aun así, M4 va al final y se verifica con un login real antes de dar el día por bueno.**

### 3 · Los `REVOKE` — riesgo bajo, pero verificable

M2 y M3 revocan sobre `audit_log` y `permission_grants`, que **son tablas nuevas**: nada las lee todavía. Sin efecto sobre lo existente.

M4 revoca sobre `user_login_devices`, que sí está viva. Lo que concede es un **superconjunto** de lo actual (`SELECT, INSERT, UPDATE, DELETE` frente a `SELECT, INSERT, UPDATE` de la migración base más el `DELETE` de la ampliación), y solo retira `TRUNCATE`, que ninguna pantalla usa. Y quita a `anon`, que nunca debió tenerlo.

---

## Verificación en producción, migración a migración

Todo lo de aquí es de **solo lectura** salvo donde se diga.

**Tras M1**
```sql
SELECT 'dj_profiles' AS tabla, count(*) AS total,
       count(*) - count(profile_id) AS sin_id FROM public.dj_profiles
UNION ALL
SELECT 'client_profiles', count(*), count(*) - count(profile_id)
  FROM public.client_profiles;
```
`sin_id = 0` en las dos. Y el sello, que **debe dar error rojo**:
```sql
UPDATE public.dj_profiles SET profile_id = 'FENIX-AAAAAAAA' WHERE profile_id IS NOT NULL;
```

**Tras M2 — la prueba que importa, y esta sí escribe**

Editar un perfil real y comprobar que no se rompe. Sobre una columna inocua:
```sql
UPDATE public.dj_profiles SET updated_at = now()
 WHERE profile_id = (SELECT profile_id FROM public.dj_profiles ORDER BY profile_id LIMIT 1);

SELECT accion, recurso_profile_id, despues
  FROM public.audit_log ORDER BY id DESC LIMIT 1;
```
Si eso falla, **M2 se revierte inmediatamente** (la reversión está al pie del archivo) y no se sigue.

Y la censura contra las columnas reales, que en producción por fin tiene qué censurar:
```sql
SELECT public.mdj_audit_censurar(
  '{"card_last4":"4242","address":"Calle Falsa 123","birth_date":"1990-01-01",
    "role":"dj","referral_code":"MDJB-77"}'::jsonb);
```
Esperado: `card_last4`, `address` y `birth_date` como `[no registrado]`; `role` y `referral_code` legibles.

**Tras M3**
```sql
SELECT count(*) AS grants FROM public.permission_grants;
```
`0` — tabla nueva y vacía. No se siembran concesiones de prueba en producción.

**Tras M4 — y esta no es SQL**

1. Cerrar sesión en la plataforma.
2. **Iniciar sesión con contraseña.** Es el paso que de verdad prueba M4.
3. Comprobar el rastro:
```sql
SELECT accion, recurso_profile_id, despues->>'dispositivo_plataforma' AS plataforma
  FROM public.audit_log WHERE accion LIKE 'dispositivo.%'
 ORDER BY id DESC LIMIT 3;
```
Si el login falla, **revertir M4 en el acto**: sus cuatro `DROP TRIGGER` están al pie del archivo y no borran ni la tabla ni los dispositivos.

**Tras M5**
```sql
SELECT public.fenix_puede(
         (SELECT user_id FROM public.dj_profiles WHERE role = 'owner' LIMIT 1),
         'financial.execute') AS owner_en_persona;
```
`true`. M5 no cambia el comportamiento de nada hasta que alguien la llame: es aditiva pura.

---

## Lo que este plan deja abierto a propósito

**Nadie llama a `fenix_puede()` todavía.** Las Edge Functions siguen llamando a `fenix_can()`. Migrar los llamadores es un trabajo aparte, de frontend y funciones, y no debe mezclarse con el paso de esquema. Hasta que ocurra, M5 está desplegada pero dormida — y eso es lo correcto.

**La suite de aislamiento no se repite en producción.** Requiere sesiones simuladas y datos de prueba. Producción tiene sus propias políticas de perfil, distintas y más completas que las de ensayo, así que **el aislamiento en producción es una verificación pendiente y separada**, no algo que este plan certifique.

**Las tres columnas muertas** (`known_devices`, `security_preference`, `two_factor_enabled`) no se tocan. Informe entregado, decisión del PO.

---

## Recomendación de ejecución

Una sesión, las cinco seguidas, con verificación entre cada una y **el login real como puerta final**. Si algo falla en M1, M2 o M3, se revierte esa y se para: las tres son aditivas y su reversión no destruye datos de negocio.

M4 es la que puede afectar a gente que esté usando la plataforma. Conviene aplicarla cuando puedas comprobar un login de inmediato.
