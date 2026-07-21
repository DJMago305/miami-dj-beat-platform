# TICKET-V2-LEGAL-CENTER-UI-SHELL-001

## Estado

**LC-4 — LEGAL CENTER UI SHELL — IMPLEMENTACIÓN TÉCNICA COMPLETA**

**PENDIENTE DE VALIDACIÓN VISUAL DEL PRODUCT OWNER · SIN COMMIT · SIN PUSH**

| Campo | Valor |
|-------|-------|
| Fase | **LC-4-UI** — Legal Center UI Shell |
| Parent | DC-3 Provider Factory · DC-2 In-Memory · DC-1 Contracts |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD base | `e98a7a9` (+ DC-3 uncommitted + LC-4) |
| Fecha | 2026-07-20 |

---

## 1. Baseline

| Métrica | Pre-LC-4 | Post-LC-4 |
|---------|----------|-----------|
| typecheck | PASS | **PASS** |
| Test files | 63 (con DC-3 local) | **64** |
| Tests | 824 | **834** |

---

## 2. Objetivo

Shell visual y estructural reutilizable para Legal Center en **Staff · Artist · Client**, read-only, in-memory, sin backend real.

Reemplaza el lab preview `<dl>` (DC-3) por componentes desacoplados listos para LGX/LGC.

---

## 3. Componentes UI (LCS-001…005)

| Componente | Archivo |
|------------|---------|
| `LegalCenterShell` | `ui/legal-center-shell.ts` |
| `LegalSection` | `ui/legal-section.ts` |
| `LegalDocumentCard` | `ui/legal-document-card.ts` |
| `LegalStatusBadge` | `ui/legal-status-badge.ts` |
| `EmptyLegalState` | `ui/empty-legal-state.ts` |

Tipos: `ui/legal-shell-types.ts` · estilos: `ui/legal-center-shell.css`

---

## 4. Categorías soportadas (futuro)

`contracts` · `agreements` · `w9` · `tax_documents` · `privacy_policies` · `releases` · `nda` · `vendor_documents` · `artist_documents`

---

## 5. Estados de documento (card)

`draft` · `pending` · `sent` · `viewed` · `signed` · `expired` · `rejected`

Propiedades card: `id` · `title` · `type` · `status` · `createdAt` · `updatedAt` · `requiresSignature` · `downloadAvailable`

---

## 6. Mapper (runtime → UI)

`provider/legal-center-shell-mapper.ts`:

| Builder | Portal | Fixture |
|---------|--------|---------|
| `buildStaffLegalCenterShellViewModel` | staff | roster + sample `LP-ART-GREEN-001` (owner/manager) |
| `buildArtistLegalCenterShellViewModel` | artist | `LP-ART-GREEN-001` |
| `buildClientLegalCenterShellViewModel` | client | `LP-CLI-001` |

Sin lógica de negocio en componentes UI.

---

## 7. Inyección portales

Wires actualizados: `renderLegalCenterShell()` en lugar de `renderPreview()`.

`main.ts` importa `legal-center-shell.css` · append al dashboard grid.

---

## 8. Matriz de seguridad (heredada DC-3)

| Rol | Shell behavior |
|-----|----------------|
| Staff seller | sin sección Tax/W-9 sample |
| Client | sin categoría `w9` |
| Artist | Tax & W-9 section separada |

---

## 9. Tests

| Archivo | Tests |
|---------|-------|
| `tests/unit/legal-center-shell.test.ts` | 10 |
| `tests/integration/legal-portal-injection.test.ts` | 4 (actualizado) |

Suite completa: **64 files · 834 tests PASS**

---

## 10. Localhost

| URL | HTTP |
|-----|------|
| http://localhost:5173/staff/ | 200 |
| http://localhost:5173/artist/ | 200 |
| http://localhost:5173/client/ | 200 |

PO debe validar visualmente glass shell + secciones + badges.

---

## 11. Fuera de alcance LC-4

PDF · firma · Supabase · uploads · email · rutas `/staff/legal/` · nav global · mockups Figma finales.

---

## 12. Próximo paso

**LC-5-UI** — tabs LGC-001…007 · routing lab dedicado · o **LC-4-PDF** (discovery original PDF engine) en ticket separado.

**SIN COMMIT · DETENIDO.**
