# REGLAS ESTRICTAS DE OPERACIÓN Y GOBERNANZA (NO IGNORAR NUNCA)

1. CERO PRs AUTOMÁTICOS:
- Está terminantemente prohibido abrir Pull Requests (PRs) o hacer merge a `main` por tu cuenta.
- Todo trabajo se hace en una rama local (`feature/...`).
- Cuando termines un cambio, levanta/mantén el servidor local, avisa al usuario y DETENTE. Solo abrirás PR cuando el usuario diga explícitamente "aprobado" o "me gusta así".

2. PROHIBIDO BORRAR O ALTERAR SIN PERMISO:
- NUNCA elimines, ocultes o "optimices" elementos visuales (como partículas, mallas, conductos, shaders o logos corporativos) sin autorización expresa.
- Contexto de negocio: Las partículas en 3D representan el flujo de clientes y la red de Miami DJ Beat; no son adornos gráficos.
- Si crees que algo sobra o debe cambiarse, PREGUNTA primero.

3. RESPETO AL ENTORNO:
- Limítate a hacer exactamente lo que se te pide en el ticket. No toques archivos, estilos ni lógicas ajenas a la instrucción principal.

4. REGLA DE CONTEXTO REAL (QA):
- Queda estrictamente prohibido probar, capturar o validar como evidencia vistas hijas o parciales (ej. `elixis-console.html`, cualquier componente embebido) abiertas de forma directa e independiente en el navegador.
- Toda prueba de interfaz debe ejecutarse obligatoriamente dentro de su contenedor oficial (ej. `staff.html?vista=...`), con el header maestro y la sesión real cargados.
- Antes de dar por buena cualquier tarea de UI, confirmar que el contenedor real (`#mainHeader` / `#staff-topnav` según corresponda) está presente en el DOM y visible.
- Si por necesidad técnica hace falta mirar algo aislado para depurar más rápido, decirlo explícitamente ANTES de mostrar cualquier captura — nunca presentarlo como el estado real sin esa advertencia.

5. ESTADO MAESTRO COMPARTIDO:
- Todo hilo secundario debe leer `docs/ESTADO_MAESTRO.md` al iniciar y actualizar su estado antes de cerrar sesión.

6. MATRIZ DE JURISDICCIONES:
- Cada hilo secundario solo tiene permiso de edición sobre los archivos de su dominio asignado en `docs/JURISDICCIONES.md`. Si una tarea excede su jurisdicción, debe rechazarla y remitir al hilo maestro.

7. AUDITORÍA VISUAL OBLIGATORIA ANTES DE COMMIT / MERGE / PRODUCCIÓN:
- Ningún cambio se comitea, se fusiona ni se envía a producción sin que el humano (el PO) haya visto y confirmado el cambio positivo primero.
- La tarea del Hilo Maestro es supervisar, ANTES de cualquier commit/merge, si el hilo especialista está cumpliendo lo que promete — no relayar su reporte como hecho, no aceptar su propia medición como prueba suficiente, sino verificarlo de forma independiente.
- Aun con esa supervisión hecha, la confirmación técnica del Hilo Maestro NO sustituye la confirmación visual directa del PO — son dos pasos, no uno.
- Declarar un trabajo como "resuelto" o "listo" antes de la confirmación del PO es una falta grave — no solo un error técnico, sino de conducta.
- Aplica a todo hilo, sin excepción: quien audite/apruebe antes de tiempo responde por ello.

8. CONFINAMIENTO DE WORKTREES Y AMBIENTE DE TRABAJO (2026-08-25):
- Origen: 11 worktrees terminaron abandonados directamente en `~/Desktop`, mezclados con proyectos ajenos al repo — auditoría forense completa el 2026-08-25.
- PROHIBIDO crear worktrees de git sueltos en el escritorio. Deben vivir en `.worktrees/` (dentro del repo, ignorado) o en el scratchpad temporal del propio agente — nunca como carpeta hermana de `miami-dj-beat-platform/`.
- PROHIBIDO `git add -A` / `git add .` a secas. Agregar archivos nominalmente (`git add web/archivo.js`) — así se detectan `node_modules/`, `.env` o proyectos ajenos ANTES de que entren al historial, no después.
- Toda rama nueva nace de un `main` recién actualizado:
  ```
  git checkout main && git pull origin main
  git checkout -b feature/nombre-del-ticket
  ```
  Ramificar desde una rama de trabajo vieja (no desde `main` limpio) es cómo el dataset de "One Hit Wonder" terminó viajando dentro de un PR de limpieza de escritorio sin revisión propia.
- Antes de abrir cualquier PR, correr `git diff origin/main --stat` y confirmar que solo aparecen archivos de esa tarea.
- Estructura canónica de destino (no inventar rutas nuevas para lo mismo):
  - Documentación de gobernanza/planes/contratos → `docs/` (`docs/constitucion-*`, `docs/incidentes/`, `docs/archivo-historico/`).
  - Imágenes/media de artistas → `web/assets/artists/<nombre-artista>/`.
  - Scripts SQL de Supabase → `supabase/scripts/`, con fecha o prefijo descriptivo en el nombre.
