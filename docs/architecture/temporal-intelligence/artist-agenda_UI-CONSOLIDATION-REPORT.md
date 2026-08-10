# Reporte de análisis — Consolidación de UI del Calendario Operacional

**Ticket:** TICKET-V2-ARTIST-AGENDA-MATRIX-001
**Fecha:** 2026-08-10
**Autorización del owner:** sí (2026-08-10, "sí" a consolidar y eliminar las simplificadas)
**Regla aplicada:** *No remoción sin reporte* — este documento es el análisis técnico + visual previo.

---

## Qué se elimina

| Archivo | Líneas | Rol |
|---------|-------:|-----|
| `web/calendario-operacional.html` | 305 | Página **simplificada** del artista (paso 3): solo vista Mes, consent gate, contactos, recordatorios. |
| `web/calendario-operacional-owner.html` | 245 | Página **simplificada** del owner (paso 4): solo Mes, continuidad, notarización. |

## Qué las reemplaza

`web/calendario-operacional-inteligente.html` (802 líneas) — el **prototipo completo** ya probado:
- Vistas **Día / Semana / Mes / Año**.
- Switch **Artista ↔ Owner · Matrix** (las dos herramientas en una).
- Recordatorios, base de clientes, Continuidad, y **Notarización** (incl. flujo Manager IA → orden del owner).
- Toggle **día/noche** + **pantalla completa**.

En otras palabras: el archivo completo **contiene y supera** todo lo que hacían las dos simplificadas.

## Análisis técnico (¿es seguro?)

- **Referencias:** `grep` en todo el repo (`*.html/*.js/*.json`) → **ninguna** referencia externa a las dos páginas simplificadas. No están enlazadas en navegación, ni importadas, ni abiertas por otro archivo.
- **Dependencias compartidas:** ninguna. Son archivos standalone (CSS/JS inline, sin módulos compartidos).
- **Datos:** todas usan mock data; no hay persistencia ni backend afectado.
- **Reversibilidad:** ambas fueron commiteadas antes (`1b1271a`, `4ec2b99`); quedan en el historial de git y se pueden restaurar con `git checkout <sha> -- <archivo>`.

## Análisis visual (¿se pierde algo que el usuario vea?)

- Lo que mostraban (calendario mensual del artista/owner, consent gate, contactos, recordatorios, continuidad, notarización) **está presente y ampliado** en el prototipo completo.
- No se pierde ninguna funcionalidad ni vista para el usuario; al contrario, se ganan Día/Semana/Año, el switch de rol, día/noche y pantalla completa.

## Conclusión

Remoción **segura y sin impacto**: las dos páginas simplificadas quedan **obsoletas** al existir el prototipo completo, no están referenciadas, y son recuperables desde git. Se procede a eliminarlas para dejar una sola superficie canónica del calendario en `web/`.
