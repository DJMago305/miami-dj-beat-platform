# Miami DJ Beat — proyecto activo

- **`web/`** — sitio público (HTML, CSS, JS, imágenes). En Vercel el directorio raíz del proyecto suele ser **`web`**.
- **`web/supabase-config.js`** — URL del proyecto, anon key, buckets Storage y helpers `mdbSupabaseFunctionUrl()` / `mdbSupabaseOrigin()` (sin duplicar hosts en el resto del código).
- **`web/.vercelignore`** — excluye vídeos (`.mp4`, etc.) del paquete que sube `vercel deploy`. En el navegador las rutas `./assets/...` se resuelven al bucket público `assets` en Supabase (`MDB_ASSETS_URL` / `resolveMdAssetPublicUrl`). Los reels de venues están bajo `assets/eventos-venues-patrocinadores/reels/`; `MDB_EVENTOS_VENUES_URL` vacío evita apuntar a otro bucket sin esos archivos.
- **`supabase/`** — backend en la nube (funciones, migraciones SQL).
- **`SUPABASE-RUNBOOK.md`** — pasos para aplicar migraciones SQL y Edge Functions en Supabase (Vercel no lo hace solo).
- **`REGRESSION-CHECKPOINT.md`** — punto de control ante regresiones tras deploys grandes.

Material archivado (documentos viejos, respaldos, scripts de inyección, SQL sueltos de referencia, carpetas de agente) está en el Escritorio: **`MiamiDJBeat-archivo-fuera-produccion`**, con un **`LEEME.txt`** que lo explica.
