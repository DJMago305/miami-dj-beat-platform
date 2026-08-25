# CRM NOTION SETUP — v1 (Lead Manager)

## 🎯 Objetivo: Centralización y Control
Este documento define la estructura para el CRM en Notion que recibirá los leads de `web/index.html` vía Formspree.

---

## 1) Esquema de la Base de Datos (Notion)
Crea una base de datos de tipo "Table" con las siguientes columnas exactas:

| Columna | Tipo | Función |
| :--- | :--- | :--- |
| **Nombre** | Title | Nombre del evento o cliente principal |
| **Email** | Email | Correo electrónico capturado |
| **Teléfono** | Phone | Teléfono de contacto |
| **Tipo de evento** | Select | Wedding / Corporate / Venue / Private |
| **Fecha** | Date | Fecha del evento |
| **Ubicación** | Text | Dirección o zona (Miami / Keys / etc.) |
| **Presupuesto est.** | Number | Presupuesto declarado por el cliente |
| **Estado** | Select | New / Contacted / Quote Sent / Closed / Lost |
| **Valor cotizado** | Number | Monto enviado en la propuesta final |
| **Valor cerrado** | Number | Monto final del contrato firmado |
| **Notas** | Sub-item/Text | Detalles específicos, requerimientos técnicos |

---

## 2) Lógica de Automatización (Formspree -> Notion)
Para que los leads lleguen automáticamente sin intervención manual:

1.  **Acceder a Formspree:** Ir a la configuración del formulario `mqakvjge`.
2.  **Integraciones:** Seleccionar "Notion".
3.  **Mapeo de Campos:**
    *   `event_type` -> Event Type
    *   `event_date` -> Date
    *   `location` -> Location
    *   `budget` -> Budget
4.  **Status Inicial:** Configurar para que cada entrada nueva llegue con el estado `New`.

---

## 3) Dashboard de Control (Vistas Recomendadas)
1.  **Pipeline (Board View):** Agrupado por `Status` para ver dónde se atascan los clientes.
2.  **Calendario (Calendar View):** Basado en `Date` para ver la ocupación real del equipo.
3.  **Conversión (Table View):** Filtrar por `Done` para medir el Revenue real vs Objetivo.

---

## 4) Reglas de Higiene
- Cada vez que se clasifique un lead como **Premium**, marcar con la etiqueta `Llamada inmediata`.
- Si un lead no cambia de estado en 48h, Notion (o una tarea manual) debe disparar el recordatorio de seguimiento del **Sales Protocol**.
