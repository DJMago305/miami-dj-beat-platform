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
