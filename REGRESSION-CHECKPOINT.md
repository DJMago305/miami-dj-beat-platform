# Punto crítico de regresión — Miami DJ Beat

**Fecha de referencia:** 2026-04-11  
**Commit de despliegue:** `18ae9a9` (rama `main`, push a `origin` → Vercel)

Si algo falla **después** de este punto, revisar primero estas áreas antes de refactor grande.

---

## 1. Referidos y monetización

| Riesgo | Qué comprobar |
|--------|----------------|
| DJ no cobra bono / cliente no ve descuento | `web/monetization.js` — política: **$30** primera compra cliente, **$20** al DJ si compra elegible **> USD 500** (no es %). Claves: `mdb_referral_dj_id`, `mdj_active_affiliate_dj`, flags `mdb_referral_first_order_done`, `mdb_client_referral_discount_used`. |
| Registro sin `source_ref` | `web/auth.js` — `mdjGetReferralDjId()` debe leer URL **y** `localStorage`. Registro solo con `login.html?signup=free` **sin** `?ref=` en URL debe seguir heredando ref si el usuario pasó por `index.html?ref=` o botón **WEB** del perfil. |
| WEB desde perfil | `web/dj-profile.html` — `gotoAffiliateWeb()` debe escribir `mdb_referral_dj_id` + `index.html?ref=` (encodeURIComponent). |
| Checkout texto incorrecto | `web/index.html` — bloque del carrito que arma `checkout-payload` usa `MDB_MONETIZATION` (cargar `monetization.js` **antes** del listener si se mueve el orden de scripts). |

**Backend:** Stripe/Edge debe reflejar la misma política; migración comentada: `web/sql/migrations/13_referral_policy_flat_2026.sql`. Vercel **no** aplica SQL en Supabase automáticamente.

**Aplicar SQL y funciones en orden:** ver **`SUPABASE-RUNBOOK.md`** en la raíz del repo.

---

## 2. Suscripción gratis (headers)

- Botones `#header-subscribe-free-btn` / `#header-subscribe-free-mobile` + `mdj-shared-header.js`: con **sesión** se ocultan; sin sesión visibles.
- Si “desaparecen” mal: orden de carga `supabase` → `mdj-shared-header.js`.

---

## 3. Perfil público — foto inset vs barra social

- `web/dj-profile.html` — `.dj-hero-inset` va **arriba a la derecha** (`right: …`, no `left` grande). Si la barra fija (`mdj-social-sticky-bar`) vuelve a tapar la foto, subir `right` (no mover todo el bloque al lado izquierdo del hero).

---

## 4. Archivos bloqueados (`.cursorrules`)

`web/index.html`, `styles.css`, varias páginas “LOCKED”: no reestructurar DOM ni navegación por defecto; solo bloques puntuales acordados.

---

## 5. Verificación rápida post-deploy

1. Abrir `index.html?ref=<uuid_válido>` → `localStorage` contiene `mdb_referral_dj_id`.  
2. Ir a `login.html?signup=free` **sin** `ref` en URL → registro debe seguir pudiendo resolver ref desde storage (probar en ventana privada con paso intermedio).  
3. Perfil DJ → **WEB** → home con `?ref=` → mismo comportamiento.  
4. Hero perfil: foto pequeña no solapada por columna social en desktop.

---

## 6. Rollback orientativo

- Código: `git revert` o `git checkout 18ae9a9 -- <archivo>` según alcance.  
- Vercel: redeploy del commit anterior desde el dashboard si hace falta.

---

*Documento generado para continuidad del equipo; actualizar fecha/commit si hay un nuevo “punto seguro” posterior.*
