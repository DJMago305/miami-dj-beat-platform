# ROLE-MATRIX.md

**TICKET-V2-SHARED-CORE-004 — Permissions Specification**

**Módulo:** MOD-003 · Matriz rol → capability  
**Versión:** 1.0  
**Leyenda:** ✅ = capability otorgada · — = deny

Roles columnas: **G** Guest · **B** Buyer · **AL** Artist Lite · **AP** Artist Pro · **AE** Artist Elite · **S** Seller · **M** Manager · **A** Admin · **O** Owner

---

## orders.*

| Capability | G | B | AL | AP | AE | S | M | A | O |
|------------|---|---|----|----|----|----|----|----|----|
| `orders.read.own` | — | ✅ | — | — | — | — | — | — | — |
| `orders.read.assigned` | — | — | ✅ | ✅ | ✅ | — | — | — | — |
| `orders.read` | — | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| `orders.write` | — | — | — | — | — | — | ✅ | ✅ | ✅ |
| `orders.assign` | — | — | — | — | — | — | ✅ | ✅ | ✅ |
| `orders.cancel` | — | — | — | — | — | — | ✅ | ✅ | ✅ |

---

## payments.*

| Capability | G | B | AL | AP | AE | S | M | A | O |
|------------|---|---|----|----|----|----|----|----|----|
| `payments.read.own` | — | ✅ | — | — | — | — | — | — | — |
| `payments.read` | — | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| `payments.write` | — | — | — | — | — | — | ✅ | ✅ | ✅ |
| `payments.refund` | — | — | — | — | — | — | ✅ | ✅ | ✅ |

---

## crm.*

| Capability | G | B | AL | AP | AE | S | M | A | O |
|------------|---|---|----|----|----|----|----|----|----|
| `crm.read` | — | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| `crm.write` | — | — | — | — | — | — | ✅ | ✅ | ✅ |
| `crm.delete` | — | — | — | — | — | — | ✅ | ✅ | ✅ |

---

## jobs.*

| Capability | G | B | AL | AP | AE | S | M | A | O |
|------------|---|---|----|----|----|----|----|----|----|
| `jobs.read` | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `jobs.apply` | — | — | ✅ | ✅ | ✅ | — | — | — | — |
| `jobs.publish` | — | — | — | — | — | — | ✅ | ✅ | ✅ |
| `jobs.assign` | — | — | — | — | — | — | ✅ | ✅ | ✅ |

---

## artist.*

| Capability | G | B | AL | AP | AE | S | M | A | O |
|------------|---|---|----|----|----|----|----|----|----|
| `artist.profile.read.public` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `artist.profile.edit.own` | — | — | ✅ | ✅ | ✅ | — | — | — | — |
| `artist.calendar.read.own` | — | — | ✅ | ✅ | ✅ | — | — | — | — |
| `artist.calendar.edit.own` | — | — | ✅ | ✅ | ✅ | — | — | — | — |
| `artist.cashflow.read.own` | — | — | ✅ | ✅ | ✅ | — | — | — | — |
| `artist.tools.use` | — | — | ✅ | ✅ | ✅ | — | — | — | — |
| `artist.academy.access` | — | — | ✅ | ✅ | ✅ | — | — | — | — |
| `artist.sft.use` | — | — | — | ✅ | ✅ | — | — | — | — |
| `artist.media.upload.own` | — | — | ✅ | ✅ | ✅ | — | — | — | — |
| `artist.analytics.read.own` | — | — | — | ✅ | ✅ | — | — | — | — |

---

## client.*

| Capability | G | B | AL | AP | AE | S | M | A | O |
|------------|---|---|----|----|----|----|----|----|----|
| `client.profile.edit.own` | — | ✅ | — | — | — | — | — | — | — |
| `client.shop.browse` | ✅ | ✅ | — | — | — | — | — | — | — |
| `client.shop.checkout` | — | ✅ | — | — | — | — | — | — | — |
| `client.vip.benefits` | — | ✅* | — | — | — | — | — | — | — |
| `client.documents.read.own` | — | ✅ | — | — | — | — | — | — | — |
| `client.notifications.read.own` | — | ✅ | — | — | — | — | — | — | — |

*VIP: capability gated by snapshot flag `clientVip`, not role alone.

---

## staff.*

| Capability | G | B | AL | AP | AE | S | M | A | O |
|------------|---|---|----|----|----|----|----|----|----|
| `staff.dashboard.access` | — | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| `staff.leads.read` | — | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| `staff.leads.write` | — | — | — | — | — | — | ✅ | ✅ | ✅ |
| `staff.invoices.read` | — | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| `staff.invoices.write` | — | — | — | — | — | — | ✅ | ✅ | ✅ |
| `staff.production.read` | — | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| `staff.production.write` | — | — | — | — | — | — | ✅ | ✅ | ✅ |
| `staff.matching.run` | — | — | — | — | — | — | ✅ | ✅ | ✅ |
| `staff.reports.read` | — | — | — | — | — | ✅ | ✅ | ✅ | ✅ |
| `staff.users.read` | — | — | — | — | — | — | ✅ | ✅ | ✅ |
| `staff.users.write` | — | — | — | — | — | — | ✅ | ✅ | ✅ |
| `staff.roles.read` | — | — | — | — | — | — | ✅ | ✅ | ✅ |
| `staff.audit.read` | — | — | — | — | — | — | ✅ | ✅ | ✅ |
| `staff.manage` | — | — | — | — | — | — | ✅ | ✅ | ✅ |

---

## system.* · guest.* · notifications.*

| Capability | G | B | AL | AP | AE | S | M | A | O |
|------------|---|---|----|----|----|----|----|----|----|
| `system.admin` | — | — | — | — | — | — | — | ✅ | ✅ |
| `system.featureflags.override` | — | — | — | — | — | — | — | — | ✅ |
| `guest.browse.public` | ✅ | — | — | — | — | — | — | — | — |
| `notifications.read.own` | — | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## Inheritance summary

| Cadena | Regla |
|--------|-------|
| **Artist Lite → Pro → Elite** | Pro añade SFT + analytics; Elite = Pro + future elite caps |
| **Seller → Manager → Admin → Owner** | Management writes desde Manager; Seller read-heavy |
| **Buyer + VIP flag** | `client.vip.benefits` override snapshot, not role rename |

---

## Capability counts por rol (efectivas en matriz)

| Rol | Count aprox. |
|-----|--------------|
| Guest | 3 |
| Buyer | 12 |
| Artist Lite | 14 |
| Artist Pro | 22 |
| Artist Elite | 24 |
| Seller | 18 |
| Manager | 35 |
| Admin | 38 |
| Owner | 40 |

---

*ROLE-MATRIX v1.0 — TICKET-V2-SHARED-CORE-004*
