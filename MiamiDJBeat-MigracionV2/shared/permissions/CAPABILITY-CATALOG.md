# CAPABILITY-CATALOG.md

**TICKET-V2-SHARED-CORE-004 — Permissions Specification**

**Módulo:** MOD-003 · Catálogo oficial de capabilities  
**Versión:** 1.0  
**Total capabilities:** **51**

Formato: `domain.resource.action[.scope]` · Portal(s) · Red zone si aplica

---

## orders.*

| Capability | Descripción | Portales | Red |
|------------|-------------|----------|-----|
| `orders.read.own` | Leer órdenes propias (buyer) | client | |
| `orders.read.assigned` | Leer órdenes asignadas (artist) | artist | |
| `orders.read` | Leer órdenes operativas | staff | |
| `orders.write` | Crear/editar órdenes | staff | ✅ |
| `orders.assign` | Asignar talento / artista | staff | ✅ |
| `orders.cancel` | Cancelar orden | staff | ✅ |

---

## payments.*

| Capability | Descripción | Portales | Red |
|------------|-------------|----------|-----|
| `payments.read.own` | Estado pagos buyer | client | |
| `payments.read` | Ver pagos operativos | staff | ✅ |
| `payments.write` | Registrar/cobrar | staff | ✅ |
| `payments.refund` | Reembolsos | staff | ✅ |

---

## crm.*

| Capability | Descripción | Portales | Red |
|------------|-------------|----------|-----|
| `crm.read` | Leer CRM | staff | ✅ |
| `crm.write` | Editar CRM | staff | ✅ |
| `crm.delete` | Eliminar registros CRM | staff | ✅ |

---

## jobs.*

| Capability | Descripción | Portales | Red |
|------------|-------------|----------|-----|
| `jobs.read` | Ver oportunidades | artist, staff | |
| `jobs.apply` | Aplicar a job (artist) | artist | |
| `jobs.publish` | Publicar oportunidad | staff | ✅ |
| `jobs.assign` | Asignar job | staff | ✅ |

---

## artist.*

| Capability | Descripción | Portales | Red |
|------------|-------------|----------|-----|
| `artist.profile.read.public` | Ver perfil público | client, artist | |
| `artist.profile.edit.own` | Editar perfil propio | artist | |
| `artist.calendar.read.own` | Ver agenda propia | artist | |
| `artist.calendar.edit.own` | Editar agenda propia | artist | |
| `artist.cashflow.read.own` | Cash Flow propio | artist | |
| `artist.tools.use` | DJ Tools | artist | |
| `artist.academy.access` | Academia artista | artist | |
| `artist.sft.use` | SoundForTips™ (PRO+ flag) | artist | |
| `artist.media.upload.own` | Subir media perfil | artist | |
| `artist.analytics.read.own` | Analytics propio | artist | |

---

## client.*

| Capability | Descripción | Portales | Red |
|------------|-------------|----------|-----|
| `client.profile.edit.own` | Editar perfil cliente | client | |
| `client.shop.browse` | Ver catálogo | client, guest | |
| `client.shop.checkout` | Checkout | client | |
| `client.vip.benefits` | Beneficios VIP | client | |
| `client.documents.read.own` | Documentos propios | client | |
| `client.notifications.read.own` | Notificaciones | client | |

---

## staff.*

| Capability | Descripción | Portales | Red |
|------------|-------------|----------|-----|
| `staff.dashboard.access` | Acceso shell staff | staff | |
| `staff.leads.read` | Leer leads | staff | ✅ |
| `staff.leads.write` | Editar leads | staff | ✅ |
| `staff.invoices.read` | Leer facturas | staff | ✅ |
| `staff.invoices.write` | Escribir facturas | staff | ✅ |
| `staff.production.read` | Producción read | staff | ✅ |
| `staff.production.write` | Producción write | staff | ✅ |
| `staff.matching.run` | Matching talento | staff | ✅ |
| `staff.reports.read` | Reportes | staff | |
| `staff.users.read` | Ver usuarios staff | staff | ✅ |
| `staff.users.write` | Gestionar usuarios | staff | ✅ |
| `staff.roles.read` | Ver roles | staff | ✅ |
| `staff.audit.read` | Audit log | staff | ✅ |
| `staff.manage` | Gestión operativa plena | staff | ✅ |

---

## system.*

| Capability | Descripción | Portales | Red |
|------------|-------------|----------|-----|
| `system.admin` | Admin sistema (owner-weighted) | staff | ✅ |
| `system.featureflags.override` | Override flags (future) | staff | ✅ |

---

## guest.*

| Capability | Descripción | Portales | Red |
|------------|-------------|----------|-----|
| `guest.browse.public` | Browse público | client | |

---

## notifications.*

| Capability | Descripción | Portales | Red |
|------------|-------------|----------|-----|
| `notifications.read.own` | Alias agregado cross-portal | client, artist, staff | |

---

## Registro de nuevas capabilities

1. Entrada en este catálogo  
2. Filas en ROLE-MATRIX.md  
3. Portal restriction check en PERMISSIONS-SPEC  
4. ADR si red zone o cross-portal nuevo  

Sin registro → **deny** en runtime.

---

*CAPABILITY-CATALOG v1.0 — 51 capabilities — TICKET-V2-SHARED-CORE-004*
