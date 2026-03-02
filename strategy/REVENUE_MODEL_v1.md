# REVENUE MODEL — v1 (INTERNAL)

> [!CAUTION]
> DOCUMENTO INTERNO CONFIDENCIAL. No compartir con clientes.

## 1) Modelo Modular Flexible (Base)
Este modelo permite cotizar de forma dinámica sin exponer precios fijos en la web.

### 🎧 DJ Base Rate
- **Tarifa:** $100 / hora
- **Mínimo:** 4 horas ($400 base)
- **Editable:** Sí (ajustable según demanda o perfil del DJ)

### 💡 Add-ons (Modulares)
| Componente | Tarifa Estimada | Nota |
| :--- | :--- | :--- |
| **Basic Lights** | $[X] | Iluminación de pista básica |
| **Premium Lights** | $[X] | Robóticas + Fachada decorativa |
| **Insurance** | $[X] | COI para Venues específicos |
| **Extended Sound** | $[X] | Subwoofers / Segundo set de audio |
| **Extra Hour** | $100 | Tarifa por hora adicional |
| **Travel (Keys)** | $[X] | Desplazamiento fuera de Miami-Dade |

---

## 2) Lógica de Cotización (Workflow)
1. **Captura:** Lead entra vía Web/DM.
2. **Evaluación:** Aplicar rúbrica de clasificación (Wedding vs Corporate).
3. **Cálculo Interno:**
   - DJ Base ($400+)
   - + Add-ons seleccionados
   - + Travel Fee
   - + Margen Objetivo (25-60%)
4. **Envío de Propuesta:** El cliente recibe el precio final consolidado.

---

## 3) Objetivos de Margen (Targets)
- **B2B (Venue Semanal):** Fomentar volumen, margen 25-30%.
- **B2C (Eventos Únicos):** Maximizar valor, margen 50-60%.

---

## 4) Hoja de Cálculos / Invoice Model
Esquema de datos 1:1 con la plantilla oficial de Invoice proporcionada.

### Encabezado Superior (Identificación)
- **Invoice No.**
- **Customer ID**
- **Bill To:** (Datos de facturación del cliente)
- **Ship To:** (Dirección del evento)

### Metadata de Operación (Row 1)
| Campo | Función |
| :--- | :--- |
| **Date** | Fecha de emisión del invoice |
| **Order No.** | Número de orden de servicio interno |
| **Sales Rep** | Responsable comercial / DJ asignado |
| **FOB** | Término de entrega (Suelen ser las siglas del punto de salida) |
| **Ship Via** | Método de transporte del equipo |
| **Terms** | Condiciones de pago (Net 30 / Due on Receipt) |
| **Tax ID** | Identificación fiscal del cliente |

### Detalle de Items (Table Columns)
| Campo | Tipo | Función |
| :--- | :--- | :--- |
| **Equip** | Text | Ej: "Signature Audio Pack" / "MC/Host" |
| **Model** | Text | Especificación técnica (RCF EVOX / Pioneer SRT) |
| **Date** | Date | Fecha exacta del servicio |
| **Tracking Number** | Text | Para seguimiento de envíos de equipo si aplica |
| **Tax** | Number | Impuesto aplicado por item (si aplica) |
| **Unit** | Number | Precio unitario por servicio/equipo |
| **Total** | Calculated | Unit x Quantity |

### Resumen Financiero
- **Subtotal:** Suma neta de todos los items.
- **Tax:** Impuesto total calculado.
- **Shipping:** (Travel Fee calculado en el Modelo Modular).
- **Balance Due:** Total final a pagar por el cliente.
