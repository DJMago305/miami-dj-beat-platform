# TICKET-V2-LEGAL-PROVIDER-FACTORY-PORTAL-INJECTION-001

## Estado

**DC-3 — IMPLEMENTACIÓN TÉCNICA COMPLETA**

**PENDIENTE DE VALIDACIÓN VISUAL DEL PRODUCT OWNER**

| Campo | Valor |
|-------|-------|
| Fase | **DC-3** — Legal Provider Factory + Portal Injection |
| Parent | DC-2 `e98a7a9` · DC-1 `3636185` |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD inicial | `e98a7a954735617ef51efdfe4a5daebe22ca31aa` |
| Fecha QA | 2026-07-20 |
| Modo | Lab V2 · read-only · in-memory · sin commit autorizado |

---

## 1. Baseline real

| Métrica | Pre-DC-3 | Post-DC-3 (QA) |
|---------|----------|----------------|
| HEAD | `e98a7a9` | `e98a7a9` (sin commit) |
| typecheck | PASS | **PASS** |
| Test files | 60 | **63** |
| Tests | 803 | **824** |
| working tree | limpio | **modificado (untracked/staged pendiente PO)** |

Auditoría inicial: rama · HEAD · working tree limpio — **OK**.

---

## 2. Archivos creados

| Archivo | Módulo |
|---------|--------|
| `shared/services/legal/provider/legal-provider-mode.ts` | LPI-001 mode |
| `shared/services/legal/provider/legal-provider-factory.ts` | LPI-001 factory |
| `shared/services/legal/provider/legal-portal-view-models.ts` | LPI-005 view models |
| `shared/services/legal/provider/legal-portal-adapters.ts` | LPI-002–004 adapters |
| `shared/services/legal/provider/legal-lab-preview-render.ts` | Lab preview DOM |
| `shared/services/legal/provider/index.ts` | barrel |
| `staff/legal/staff-legal-provider-wire.ts` | LPI-006 staff injection |
| `artist/legal/artist-legal-provider-wire.ts` | LPI-006 artist injection |
| `client/legal/client-legal-provider-wire.ts` | LPI-006 client injection |
| `tests/unit/legal-provider-factory.test.ts` | factory tests |
| `tests/unit/legal-portal-adapters.test.ts` | adapter/security tests |
| `tests/integration/legal-portal-injection.test.ts` | composition root tests |
| `docs/V2/TICKETS/TICKET-V2-LEGAL-PROVIDER-FACTORY-PORTAL-INJECTION-001.md` | ticket |

## 3. Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `staff/main.ts` | `resolveStaffLegalPortalBundle()` + preview append |
| `artist/main.ts` | `resolveArtistLegalPortalBundle()` + preview append |
| `client/main.ts` | `resolveClientLegalPortalBundle()` + preview append |

**DC-1 / DC-2:** sin cambios.

---

## 4. Factory

`resolveLegalProvider({ mode })` / alias `createLegalProvider`:

- Modo implementado: **`IN_MEMORY`**
- Modos no implementados: `SUPABASE` · `REMOTE` · `PRODUCTION` → `LegalProviderFactoryError`
- Retorna `LegalProviderContext`: ports read-only + helpers de proyección **sin exponer store**
- Sin singleton global · sin red · sin fallback silencioso

---

## 5. Provider mode

```ts
DEFAULT_LEGAL_PROVIDER_MODE = 'IN_MEMORY'
```

---

## 6. Adaptadores por portal

| Adapter | Fixture default | Rol |
|---------|-----------------|-----|
| `buildStaffLegalCenterViewModel` | roster fixtures | owner / manager / seller |
| `buildArtistLegalProfileViewModel` | `LP-ART-GREEN-001` | artist self-only |
| `buildClientLegalDocumentsViewModel` | `LP-CLI-001` | client self-only |

Staff role mapping: `?previewRole=owner|manager|seller` → `staff_owner|staff_manager|staff_seller`.

---

## 7. View models

| Type | Campos clave |
|------|--------------|
| `StaffLegalCenterViewModel` | profile/GREEN/YELLOW/RED counts · pending signatures · missing W-9 · introductions |
| `ArtistLegalProfileViewModel` | status · signed docs · W-9 status · compliance · introductions · pending |
| `ClientLegalDocumentsViewModel` | contracts · signed · pending · downloadable artifacts |

Estados: `loading` · `ready` · `empty` · `not_found` · `forbidden` · `error`.

---

## 8. Inyección en composition roots

```
main.ts
  → resolve*LegalPortalBundle()
  → resolveLegalProvider({ mode: 'IN_MEMORY' })
  → build*ViewModel() / renderPreview()
  → append lab preview section to dashboard grid
```

Los `main.ts` **no** importan `createInMemoryLegalService()` ni `shared/services/legal/in-memory/`.

---

## 9. Matriz de seguridad

| Regla | Test |
|-------|------|
| Seller sin W-9 | adapter test #6 |
| Client sin TaxProfile | adapter tests #10–11 |
| Artist self-only | adapter tests #7–8 |
| W-9 fuera de library | adapter W-9 test |
| View models sin claves prohibidas | adapter test #15 |
| Store no expuesto | factory + injection tests |
| Fixtures no mutados | adapter test #16 |

---

## 10. Tests

| Archivo | Tests |
|---------|-------|
| `legal-provider-factory.test.ts` | 4 |
| `legal-portal-adapters.test.ts` | 13 |
| `legal-portal-injection.test.ts` | 4 |
| **Total DC-3** | **21** |

Cobertura ticket: factory IN_MEMORY · modo desconocido · staff owner/manager/seller · artist/client isolation · not_found · forbidden keys · no store in main · fixture immutability.

---

## 11. Typecheck

`npm run typecheck` → **exit 0**

---

## 12. Suite completa

`npm run test` → **63 files · 824 tests PASS** (~17.6s)

Warning: `npm warn Unknown env config "devdir"` (pre-existente).

---

## 13. Validación localhost

| URL | HTTP |
|-----|------|
| http://localhost:5173/staff/ | **200** |
| http://localhost:5173/artist/ | **200** |
| http://localhost:5173/client/ | **200** |

Vite lab server activo en `:5173`.

---

## 14. Console / Network (agente)

- **Network:** sin llamadas legales a Supabase/API — provider 100% in-memory.
- **Console:** validación visual PO pendiente; agente no sustituye revisión humana del browser.

---

## 15. Evidencia pendiente PO

Revisar en browser:

1. **Staff** — sección `Legal Center Lab Preview` con counts GREEN/YELLOW/RED; probar `?previewRole=seller` → sin W-9 status line.
2. **Artist** — sección `My Legal Profile · Lab Preview` con GREEN + W-9 approved.
3. **Client** — sección `My Documents · Lab Preview` con contracts/signed counts; sin fiscal.

**Sin aprobación visual PO → ESTADO = PENDIENTE DE VALIDACIÓN PO**

---

## 16. Limitaciones

- Preview DOM mínimo (no mockups LGX completos).
- Artist/Client usan fixtures fijos lab (GREEN artist · GREEN client).
- Staff seller compliance es resumen conceptual.
- External signer no integrado en portales normales (by design).

---

## 17. Fuera de alcance

SQL · Supabase · Postgres · Edge · email · PDF · firma · persistencia · auth nueva · producción V1 · commit · push · merge · PR · deploy.

---

## 18. Próximo paso sugerido

**LC-3 / UX-4** — Legal Center shell visual (mockups LGX) consumiendo `resolve*LegalPortalBundle()` tras aprobación PO de preview lab.

---

**SIN COMMIT · SIN PUSH · DETENIDO.**
