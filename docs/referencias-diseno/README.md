# Referencias de diseño — Miami DJ Beat (BANCO DE DISEÑO)

## CUÁNDO CONSULTAR ESTA CARPETA (nota del PO, 2026-09-21)
- **Cuando una orden del PO lleve emojis o íconos** (crear un botón, una fila, un aviso, una pantalla nueva, corregir un símbolo): buscar AQUÍ el que ya usamos.
- **NO se agregan emojis ni íconos por iniciativa propia.** Solo se ponen si el PO lo pide. Una auditoría de íconos se limita a informar diferencias; cambiarlos requiere que el PO lo pida.

**Regla del PO (permanente):**
1. Cuando se pida «crea XXXX», se **lee esta carpeta primero** y se usa el diseño que ya está aquí (emoji, ícono, color, tipografía, tamaño). Todo debe ser **igual en todas las páginas y cuentas**. Si no hay precedente, **se pregunta**; nunca se inventa ni se sustituye por algo «parecido».
2. Cuando el PO **aprueba o cambia** un diseño (por ejemplo un emoji), **se actualiza esta carpeta** en el mismo momento: pieza nueva o nota, con fecha.

## ALCANCE de la consistencia (PO 2026-09-21, corregido con firmeza)
La consistencia pedida es **SOLO de emojis e íconos**: el mismo símbolo para el mismo concepto en todas las páginas. **NO** se igualan tipografía, tamaños, menús, contenedores ni diseño entre perfiles: los contenedores reutilizables son **3 y son DIFERENTES a propósito** (Artista · Staff · Cliente), cada uno con su menú y su diseño. Nunca se comparte un menú entre portales ni se lleva el diseño de uno a otro.
Cada perfil se revisa **en SU contenedor real** (el cliente en `client-account.html` / `client-portal.html`; artista, staff y owner en `account-settings.html` y su estación). Nunca se abre a un perfil dentro de la página de otro rol.

## Referencia visual de CONFIGURACIÓN DE CUENTA (todas las cuentas: cliente, artista, staff)
Referencia maestra: **`Configuracion De Cuentas Parte 1.png`** (nombre del PO, con la ortografía corregida a su pedido; es la ventana completa de ChatGPT Ajustes con *Cuenta → Trabajar con aplicaciones*). Los íconos de configuración de cuenta salen de ahí, **los mismos en todas las cuentas**. Ya están cortados uno por uno en [`piezas/iconos/`](piezas/iconos/):

| Concepto | Pieza |
|---|---|
| Correo electrónico | `icono--cuenta--correo-electronico.png` |
| Teléfono | `icono--cuenta--numero-de-telefono.png` |
| Suscripción | `icono--cuenta--suscripcion.png` |
| Mejorar el plan (destacado, azul) | `icono--cuenta--mejorar-el-plan-enlace-azul.png` |
| Personalización | `icono--cuenta--personalizacion.png` |
| Memoria | `icono--cuenta--memoria.png` |
| Notificaciones | `icono--cuenta--notificaciones.png` |
| Complementos | `icono--cuenta--complementos.png` |
| Controles de datos | `icono--cuenta--controles-de-datos.png` |
| Chats archivados | `icono--cuenta--chats-archivados.png` |
| Seguridad e inicio de sesión | `icono--cuenta--seguridad-e-inicio-de-sesion.png` |
| Idioma | `icono--aplicacion--idioma-de-la-aplicacion.png` |
| Barra del menú | `icono--aplicacion--mostrar-en-la-barra-del-menu.png` |
| Color de acento | `icono--aplicacion--color-de-acento.png` |
| Ortografía | `icono--aplicacion--corregir-ortografia-automaticamente.png` |
| Enlaces | `icono--aplicacion--abrir-los-enlaces-de-chatgpt-en-la-aplicacion-de-escritorio.png` |
| Actualizaciones | `icono--aplicacion--comprobar-actualizaciones.png` |
| Ayuda / términos / privacidad / informar error | `icono--acerca-de--*.png` |
| Cerrar sesión (rojo) | `icono--cerrar-sesion--cerrar-sesion-rojo.png` |
Estilo: **línea fina, trazo redondeado, monocromo negro/blanco según tema**; el único color es el azul de «Mejorar el plan» y el rojo de «Cerrar sesión». Filas: icono a la izquierda, texto, valor/interruptor/flecha a la derecha, separadores finos, tarjetas de fondo gris muy claro con esquinas redondeadas.

## Emojis aprobados
| Emoji | Significado | Pieza | Aprobado |
|---|---|---|---|
| **🔄** | restaurar · reiniciar · repetir · **evento movido** | `piezas/emojis/emoji--restaurar-reiniciar-repetir-evento-movido--flechas-circulares-azules.png` | PO 2026-09-21 |
Ver la lista completa y los **rechazados** en [`notas/iconos-y-emojis.md`](notas/iconos-y-emojis.md).

## Notas de diseño (medidas del código)
[`notas/colores.md`](notas/colores.md) · [`notas/tipografia.md`](notas/tipografia.md) · [`notas/botones-y-componentes.md`](notas/botones-y-componentes.md) · [`notas/iconos-y-emojis.md`](notas/iconos-y-emojis.md)

## Las capturas originales (`NN-app--pantalla--detalle.png`)
| # | Archivo | Qué muestra |
|---|---|---|
| 01 | `01-chatgpt-ajustes--cuenta--filas-con-icono` | Sección Cuenta: 11 filas con ícono |
| 02 | `02-chatgpt-ajustes--personalizacion--selectores-e-interruptor` | Selectores (flechas ▲▼) e interruptor azul |
| 03 | `03-chatgpt-ajustes--personalizacion--menu-desplegable-abierto` | Menú desplegable con descripción y palomita |
| 04 | `04-chatgpt-ajustes--aplicacion` | Idioma, barra de menú, color de acento, interruptores |
| 05 | `05-chatgpt-ajustes--barra-de-chat` | Posición, restablecer, atajo de teclado |
| 06 | `06-chatgpt-ajustes--trabajar-con-aplicaciones` | 7 filas con ícono e interruptores |
| 07 | `07-chatgpt-ajustes--voz-sugerencias-acerca-de-cerrar-sesion` | Voz, Sugerencias, Acerca de, Cerrar sesión (rojo) |
| 08–15 | `NN-macos-ajustes--…` | Ajustes de macOS: Sonido, Notificaciones, Tiempo en pantalla, Pantalla bloqueada, Privacidad y seguridad (2), Usuarios y grupos, Cuentas de Internet |
| 16 | `16-chatgpt-ajustes--ventana-completa-B-…` | Ventana completa, mitad inferior |
| — | **`Configuracion De Cuentas Parte 1`** | **Ventana completa, mitad superior (Cuenta → Trabajar con aplicaciones). ESTÁNDAR de cuenta.** (antes «17-…-A-…») |
| 18 | `18-macos-ajustes--icloud` | iCloud+ (barra lateral + tarjetas) |

## Piezas independientes (`piezas/`) — cortadas de las tiras, cada una con nombre
| Carpeta | Piezas | Contenido |
|---|---|---|
| `piezas/iconos/` | 37 | íconos de línea de cada fila de ChatGPT Ajustes |
| `piezas/filas/` | 43 | fila completa (ícono + texto + control) |
| `piezas/tarjetas/` | 18 | tarjeta completa de cada sección y título de sección |
| `piezas/controles/` | 7 | interruptor activado/apagado, selector ▲▼, atajo de teclado, chevron, menú desplegable, punto de color |
| `piezas/macos-barra-lateral/` | 50 | 25 íconos de colores de Ajustes de macOS + su fila |
| `piezas/emojis/` | 1 | emojis aprobados por el PO |
**Convención de nombres:** `tipo--sección--concepto.png`, todo en minúsculas, sin tildes, guiones. Ej.: `icono--cuenta--correo-electronico.png`.
**Pendiente de cortar** (bajo demanda): tarjetas y filas de las pantallas de macOS (08–15, 18) y de la ventana completa.

## Cómo mantenerlo
- Si el PO corrige un diseño: agregar el correcto **y** el rechazado (con fecha) en las notas.
- Si se descubre un patrón en el código: anotarlo con su archivo de origen.
- No renombrar un archivo que el PO ya renombró, salvo que él lo pida (2026-09-21 pidió corregir la ortografía de `Configuracion De Cuentas Parte 1.png`).
