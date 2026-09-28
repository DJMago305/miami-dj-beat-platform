# URGENTE — Bajar costos extra: Supabase (egress) + Vercel (por confirmar)

**Fecha:** 2026-09-27
**Pedido por el PO:** "hay que revisar cómo bajamos esos costos de gastos extras por encima de lo que podemos, hay que hacer un análisis y vamos a ver los de vercel también, paso a paso, déjalo como tarea urgente los dos casos."
**Estado:** ANÁLISIS EN CURSO — nada implementado todavía.

## Caso 1 — Supabase: egress por encima de cuota

- Correo real de Supabase (`noreply@supabase.com`, 2026-09-21, cuenta djmago305@gmail.com): la organización `djmago305@gmail.com's Org` (ID `iahezzmlyawacdvhyrop`) superó la cuota de **egress cacheado** de su plan.
- Confirmado vía API (`get_organization`): plan **Pro**, proyecto `hkuvuqupbxwkiykxvqdr` en estado `ACTIVE_HEALTHY` (no suspendido, no hay corte activo hoy).
- **Fecha límite real: 22 de octubre de 2026** — después de esa fecha empieza a aplicar la Política de Uso Justo si el consumo sigue igual de alto. Antes de esa fecha es período de gracia gratis.
- Objetivo explícito del correo de Supabase: bajar el egress cacheado por debajo de **275 GB**.
- Hipótesis de trabajo (a confirmar con el análisis): los videos de hero de las 28 páginas de servicio se sirven directo desde Supabase Storage (`hkuvuqupbxwkiykxvqdr.supabase.co/storage/v1/object/public/assets/...`), varios en modo playlist/rotación con autoplay+loop — esto podría ser el mayor consumidor de egress del proyecto.
- **Pendiente de este análisis (en curso):** cuántos videos únicos hay, cuánto pesan, si hay cache-control real delante de las URLs de Storage (los headers de `vercel.json` NO aplican a `supabase.co`, solo a lo servido desde el dominio de Vercel), y si hay otro consumidor grande de egress fuera de los videos.

## Caso 2 — Vercel: costos por confirmar

- El PO reportó antes un cargo real de `VERCEL INC. -$22.11` (ver entrada de ESTADO_MAESTRO del 2026-09-27, "Consulta del PO sobre cargos bancarios") — costo legítimo de hosting, no fraude, pero sin desglose todavía de qué lo compone (bandwidth, build minutes, function invocations).
- Nota ya documentada ese mismo día: más PRs/ramas fragmentadas en una sesión = más despliegues = más minutos de build consumidos. Puede ser parte de la causa.
- **Bloqueado:** no se pudo revisar el dashboard de uso/facturación de Vercel porque la sesión de Chrome de este hilo no tiene la cuenta de Vercel logueada (se intentó entrar a `vercel.com/dashboard`, redirigió a login). Se necesita que el PO inicie sesión en esa pestaña, o dar acceso de otra forma, para ver el desglose real de uso.

## Próximos pasos

1. Terminar el análisis cuantitativo del Caso 1 (en curso vía agente de exploración del código).
2. Con el PO logueado en Vercel (o con otro método de acceso), revisar Settings → Usage/Billing del proyecto `web` (`prj_HiMB1S2s94mwlyoQiW8CHtcA4DpF`, team `team_VbkrzHWzFxDgNtAWuT92GElN`) para el desglose real de Caso 2.
3. Proponer opciones concretas para bajar el egress de Supabase (ej. CDN/cache delante de Storage, comprimir/reducir tamaño de videos, quitar loop/autoplay en páginas de bajo tráfico) — presentar antes de aplicar nada, por la regla de auditoría visual/confirmación del PO.
4. Nada se aplica sin aprobación explícita del PO (regla de gobernanza estándar del repo).
