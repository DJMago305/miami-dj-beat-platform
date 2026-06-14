# TICKET-007: Sincronización de Categorías de Talento (Jobs vs Rentals)

## 🎯 Objetivo Principal
Alinear las tarjetas de selección de roles en la página de aplicación de talento (`web/jobs.html`) para que coincidan exactamente con las categorías oficiales de venta (`web/rentals.html`) y la nueva arquitectura del CRM.

## 🧠 Contexto y Problema
Actualmente, cuando un talento aplica en `jobs.html`, las opciones que selecciona no se corresponden 1 a 1 con las categorías que la plataforma vende. Esto obliga al CRM a "adivinar" la categoría del usuario leyendo palabras clave en su biografía o especialidad (ej. buscando la palabra "bartender"). 

Al sincronizar `jobs.html` con `rentals.html`, el sistema guardará la categoría exacta desde el momento del registro, haciendo que la base de datos sea 100% precisa y escalable.

## 📋 Categorías Oficiales a Implementar en `jobs.html`
Las tarjetas del carrusel en `jobs.html` deben actualizarse para reflejar esta lista exacta:
1. **DJ** (Mezcla · club · evento)
2. **Hora Loca Experience** (Paquetes, personajes, robots LED)
3. **Músicos en Vivo** (Saxo, percusión, voz, bandas)
4. **Captura y Visuales** (Foto, video, VJ, drone, booth 360)
5. **MC y Presentadores** (Maestro de ceremonias, animadores)
6. **Staff** (Bartender, meseros, chef)
7. **Payasos** (Show infantil, circo, Santa)

## 🛠️ Tareas Realizadas
- [x] **Auditoría de `jobs.html`:** Revisar el carrusel actual (`#mdj-jobs-v3-carousel`) y ver qué tarjetas existen y cuáles faltan.
  - **Hallazgo:** Existían 15 tarjetas dispersas (DJ, MC, CANTANTE, LIVE_BAND, PERCUSIONISTA, SAXOFONISTA, VIOLINISTA, PAYASO, HORA_LOCA, BARTENDER, MESERO, MANAGER_ARTISTICO, PRODUCTOR_MUSICAL, INFLUENCER_PROMOTOR, FOTO_BOOTH_360).
- [x] **Actualización de UI:** Modificar el HTML de las tarjetas para que los títulos, subtítulos y valores de los `checkbox` coincidan con las categorías oficiales.
  - **Acción:** Se reemplazaron las 15 tarjetas viejas por las 7 oficiales en `web/jobs.html`.
- [x] **Lógica de Envío:** Asegurar que el formulario de registro capture correctamente estos nuevos valores y los guarde en Supabase (en la columna `roles` o `artist_specialty`).
  - **Acción:** Se actualizaron los atributos `value` de los inputs (ej. `value="Hora Loca"`, `value="Visuales"`) para que viajen directamente a la base de datos de manera limpia. Además, se ajustó el Regex en `admin-dashboard.html` para capturar "visuales".
- [x] **Imágenes/Assets:** Asignar una imagen de fondo (`role-photo-bg`) adecuada para cada nueva tarjeta utilizando los assets existentes de la plataforma.
  - **Acción:** Se auditaron y reciclaron las imágenes existentes en `web/assets/Jobs/` (DJ.jpg, HORA_LOCA.jpg, LIVE_BAND.jpg, FOTO_BOOTH_360.png, MC.jpg, BARTENDER.jpg, PAYASO.jpg).

## ✅ Conclusión y Estado
**TICKET COMPLETADO Y AUDITADO.**
Se confirma que **ninguna categoría quedó por fuera**. Las 7 categorías maestras del ecosistema Miami DJ Beat (DJ, Hora Loca, Músicos, Visuales, MC, Staff, Payasos) están ahora perfectamente mapeadas desde el punto de entrada de talento (`jobs.html`) hasta el Directorio Global CRM (`admin-dashboard.html`) y el portal de ventas (`rentals.html`).
