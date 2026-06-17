# TICKET-CASHFLOW-005 — Cash Flow tab: revisión de cableado y configuración

**Fecha de apertura:** 2026-06-16  
**Reportado por:** DJMago305 (CEO)  
**Tipo:** Revisión / posible bug de configuración  
**Estado:** ABIERTO — pendiente de inspección  
**Prioridad:** 🟡 MEDIA — funcional visualmente pero sin confirmar datos reales  

---

## OBSERVACIÓN DEL CAPITÁN

> "La pestaña Cash Flow está bien, lo que no estoy seguro si está bien configurada o cableada."

La pestaña **Cash Flow** existe y se ve correctamente en el dashboard del artista, pero no se ha verificado que:
- Los datos que muestra sean reales y actualizados
- Los queries a Supabase estén correctamente conectados
- Los totales reflejen pagos/ingresos reales del artista

---

## ALCANCE DE LA REVISIÓN

Cuando se autorice:
1. Leer el panel Cash Flow en `web/dj-dashboard.html`
2. Identificar qué tablas/RPCs consulta
3. Verificar que los queries existen y tienen datos
4. Confirmar que RLS permite al artista ver sus propios datos
5. Probar con datos reales de una cuenta de artista

**Archivos a inspeccionar:** `web/dj-dashboard.html` (solo sección Cash Flow)

**Para autorizar:** `Autorizo TICKET-CASHFLOW-005`

---
ESTADO: DOCUMENTADO — BAJA URGENCIA RELATIVA A TICKETS ACTIVOS (#002, #003, #004)
