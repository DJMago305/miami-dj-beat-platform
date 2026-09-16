# Branding oficial — assets reutilizables

Carpeta de trabajo para el material de marca real (no inventar logos nuevos — usar solo lo que hay aquí).

- `djmago305/` — logo dorado "DM" + wordmark, ícono suelto, banner completo, fotos de perfil/cabina.
- `miamidjbeat/` — fénix dorado oficial (transparente y con letras), banner de facturación.
- `fotos-chroma/` — fotos con fondo verde/transparente (PNG) para composiciones futuras. Vacía por ahora — agregar aquí cuando se recorten nuevas.
- `intro-loader/` — video de marca (fénix + partículas) para tapar el blanco mientras carga una página pesada (dj-profile.html, orden del PO 2026-09-16). `miami-dj-beat-intro-enganche.mp4`: comprimido de 39MB (4K HEVC, 17.2s) a 5MB (720p H.264, 11.8s) -- se le recortaron los primeros 0.8s de negro puro (el clip original arrancaba en negro) y se aceleró 1.4x en total, para que no se sienta largo incluso si la conexión del visitante es lenta. Como todo `.mp4` en este proyecto, NO se sube a git (ver `.gitignore`) -- vive aquí solo para referencia local. Copia real en Supabase Storage, bucket `assets`, ruta `branding/intro-loader/miami-dj-beat-intro-enganche.mp4` -- cada vez que se reemplaza este archivo local hay que volver a subirlo ahí encima.
  `miami-dj-beat-intro-poster.jpg` -- frame fijo del video (el fogonazo dorado, ~t=4s del original) usado como `poster` del `<video>`: se pinta al instante (imagen liviana, ~75KB) sin depender de que el video termine de bajar/decodificar, así nunca se ve pantalla negra mientras el video arranca en conexiones lentas. Esta sí se sube a git normal (no es `.mp4`), vive en este mismo repo.

Archivos maestros de alta resolución están en `/Users/djmago/Documentos/Fotos Worck/` (fuente original del usuario) — copiar aquí solo lo que ya se usó/verificó, no todo el banco.
