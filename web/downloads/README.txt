MDJPRO macOS installer — publicación
=====================================

Para que la descarga muestre la CAJITA AMARILLA (.pkg) como Serato:

OPCIÓN A — Producción (Supabase Storage)
1. Dashboard → Storage → New bucket: installers (Public)
2. Subir el archivo exportado desde Xcode, por ejemplo:
   MDJPRO_Installer.pkg
3. URL pública debe quedar:
   .../storage/v1/object/public/installers/MDJPRO_Installer.pkg
4. Actualizar web/supabase-config.js → MDB_INSTALLER_MAC_PKG_URL si cambia el nombre.

OPCIÓN B — Local (127.0.0.1:8080)
1. Copiar el .pkg aquí:
   web/installers/MDJPRO_Installer.pkg
2. Hard refresh en downloads.html y descargar.

NOTA: MDJPRO-Install.mdjhandoff es solo activación Pro (JSON pequeño).
      NO es el instalador. El icono amarillo solo aplica al .pkg.
