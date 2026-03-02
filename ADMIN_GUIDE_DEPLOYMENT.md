# 🛠 Guía de Despliegue y Administración (Manager)

Esta guía detalla cómo mantener el sistema **MDJPRO 2027** actualizado, específicamente para subir nuevas versiones de la aplicación y cambiar contenido del sitio.

## 1. Hosting de Aplicaciones (.pkg / .exe)

Para que los DJs puedan descargar el software desde la página de [Descargas](file:///Users/djmago/Desktop/miami-dj-beat-platform/web/downloads.html), debes alojar los archivos en una ubicación segura.

### Opción Recomendada: Supabase Storage
1. Entra a tu panel de **Supabase**.
2. Ve a **Storage** -> **Create a New Bucket** llamado `apps` (público).
3. Sube el archivo `MDJPRO_Installer.pkg`.
4. Copia el **Public URL**.

### Actualizar el Link de Descarga
En el archivo `downloads.html`, busca la línea del botón de descarga y actualiza el `href`:
```html
<a href="TU_URL_DE_SUPABASE_AQUI" class="btn primary full">Descargar para macOS</a>
```

## 2. Gestión de Contenido (Próximamente vía Admin Panel)

Hasta que el `admin-dashboard.html` esté 100% funcional, puedes hacer cambios rápidos aquí:

### Cambiar Fotos de Publicidad (Venues)
- Las fotos están en la carpeta `/assets/`.
- Para cambiar la foto de un local (ej: Mojitos), simplemente reemplaza el archivo `mojitos_featured.png` por uno nuevo con el mismo nombre, o actualiza la ruta en `index.html`.

### Cambiar Precios de Alquiler
1. Abre `rentals.html`.
2. Busca la sección del equipo y actualiza el texto del precio (ej: `$150/día`).

## 3. Entrenamiento BeatBot
El asistente IA está programado en `mdj-assistant.js`. 
- Si quieres que aprenda algo nuevo, añade una entrada en el objeto `this.knowledge`.
- Ejemplo: `"promoción": "Este mes tenemos 20% de descuento en alquiler de Pioneer CDJs."`

---
> [!IMPORTANT]
> Mantén siempre una copia de seguridad de los instaladores anteriores antes de sobrescribirlos.
