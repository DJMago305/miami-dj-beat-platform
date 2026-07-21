# TICKET-V2-LEGAL-CENTER-LC-5-TEMPLATE-ASSET-INTEGRATION-001

## LC-5 — Legal Template Asset Integration and Authorized Download

| Campo | Valor |
|-------|-------|
| Estado | **PENDIENTE DE VALIDACIÓN VISUAL PO** |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD baseline | `0b86f170ed1531fa788234844502ddcbfec2f2ca` |
| HEAD post-implementación | `0b86f170ed1531fa788234844502ddcbfec2f2ca` (sin commit) |
| Fecha implementación | 2026-07-20 |
| Parent | LC-4A UI Shell · Commit 3 W-9 assets · DC-3 Provider |

---

## 1. Objetivo

Conectar el catálogo de assets legales existente con el Legal Center UI para permitir **descarga autorizada** del W-9 corporativo (`SPC-001` / `TV-SPC-001-1`) cuando el portal y la política de acceso lo permiten.

Flujo implementado:

```
Legal Template Asset Catalog
  → legal-template-asset-access.ts (policy)
  → legal-template-asset-resolver.ts (resolveLegalTemplateAssetUrl)
  → legal-template-asset-download-mapper.ts (mapTemplateAssetToDownloadAction)
  → legal-center-shell-mapper.ts (portal view model)
  → legal-document-card.ts (authorized download link)
```

Runtime asset:

`shared/services/legal/assets/templates/tax/SPC-001/TV-SPC-001-1/fw9-corporate.pdf`

URL única vía `legal-template-asset-urls.ts` (Vite `?url`).

---

## 2. Baseline de arranque

| Check | Resultado |
|-------|-----------|
| Rama | `plan/v2-phase-4-api-client` |
| HEAD | `0b86f170ed1531fa788234844502ddcbfec2f2ca` |
| Working tree pre-cambio | limpio |
| `npm run typecheck` | PASS |
| Suite legal pre-LC-5 | PASS (841 tests totales) |
| Portales localhost HTTP | 200 (staff / seller / artist / client) |

---

## 3. Alcance

### Implementado

- Tipo `LegalDocumentDownloadAction` (`available` | `coming_soon` | `forbidden`) en `legal-shell-types.ts`.
- Reemplazo de `downloadAvailable: boolean` por `downloadAction` en `LegalDocumentCardViewModel`.
- Mapper `legal-template-asset-download-mapper.ts` — traduce resolución de assets a acciones UI.
- `legal-center-shell-mapper.ts` — pasa `portal` al resolver; W-9 Tax Center usa `SPC-001` / `TV-SPC-001-1` con label `Download W-9`; library rows usan mapper por `templateCode`.
- `legal-document-card.ts` — renderiza `<a>` con `target="_blank"`, `rel="noopener noreferrer"`, `download` filename cuando `available`; `coming_soon` sin href; `forbidden` sin fila de descarga.
- Estilos mínimos LC-4A para enlace descargable vs texto pasivo “Coming soon”.
- Tests unitarios, integración y regresión LC-4A.

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `shared/services/legal/ui/legal-shell-types.ts` | `LegalDocumentDownloadAction`, `LEGAL_DOWNLOAD_COMING_SOON_ACTION` |
| `shared/services/legal/ui/legal-document-card.ts` | Render download action |
| `shared/services/legal/ui/legal-center-shell.css` | Estilos enlace / coming soon |
| `shared/services/legal/provider/legal-center-shell-mapper.ts` | Portal-aware asset mapping |
| `shared/services/legal/provider/index.ts` | Export download mapper |
| `tests/unit/legal-center-shell.test.ts` | Download link, forbidden, artist W-9 |
| `tests/integration/legal-portal-injection.test.ts` | LC-5 portal HTML assertions |

### Archivos creados

| Archivo | Propósito |
|---------|-----------|
| `shared/services/legal/provider/legal-template-asset-download-mapper.ts` | Asset → UI download action |
| `tests/unit/legal-template-asset-download-mapper.test.ts` | Mapper unit tests |

### Sin cambios (confirmado)

- `staff/legal/staff-legal-provider-wire.ts`
- `artist/legal/artist-legal-provider-wire.ts`
- `client/legal/client-legal-provider-wire.ts`
- Catálogo / resolver / access core en `assets/`
- Provider factory core, in-memory service, DC-1/DC-2

---

## 4. Exclusiones (fuera de alcance)

Uploads · reemplazo de documentos · formularios W-9 · firma electrónica/manuscrita · email · secure links · Supabase/RLS/Edge · auditoría persistente · LC-6/LC-7 · navegación · producción V1.

---

## 5. Arquitectura

| Capa | Responsabilidad |
|------|-----------------|
| `assets/` | Catálogo, acceso, resolver, URLs |
| `provider/legal-template-asset-download-mapper.ts` | Composición: resolver → download action |
| `provider/legal-center-shell-mapper.ts` | View model Legal Center |
| `ui/` | Renderizado puro (sin permisos ni catálogo) |
| Portal wires / `main.ts` | Montaje solamente |

**Reglas cumplidas:** sin URL hardcoded del PDF en UI/wires/mains; UI no importa catálogo ni decide permisos; client recibe `forbidden` en mapper (no solo ocultación visual).

---

## 6. Matriz Staff / Artist / Client

| Portal / rol | Tax & W-9 Center | W-9 visible | Download W-9 | URL en DOM |
|--------------|------------------|-------------|--------------|------------|
| Staff owner / manager | Sí | Sí | Sí (`available`) | Sí (runtime URL) |
| Staff seller | No | No | No | No |
| Artist | Sí (sección legal) | Sí | Sí (`available`) | Sí (runtime URL) |
| Client | No | No | No | No — sin SPC-001, TV-SPC-001-1, fw9-corporate.pdf, ni URL |

Templates sin asset runtime → `coming_soon` (sin href).

---

## 7. Pruebas añadidas / actualizadas

| Archivo | Tests | Cobertura LC-5 |
|---------|-------|----------------|
| `legal-template-asset-download-mapper.test.ts` | 4 | staff/artist available, client forbidden, planned coming soon |
| `legal-template-assets.test.ts` | 7 | Sin cambio — resolver/access regresión |
| `legal-portal-adapters.test.ts` | 13 | Sin cambio |
| `legal-center-shell.test.ts` | 12 | Link href, rel, forbidden, artist W-9 card |
| `legal-portal-injection.test.ts` | 8 | Staff/artist HTML con link; client/seller sin leak |

### Resultados QA técnica (2026-07-20)

| Comando | Resultado |
|---------|-----------|
| `npm run typecheck` | **PASS** |
| Suite legal específica (5 archivos) | **44 tests PASS** |
| `npm test -- --run` | **66 files · 851 tests PASS** |
| `git diff --check` | **PASS** (sin conflict markers) |

---

## 8. Localhost

| URL | HTTP | Notas PO |
|-----|------|----------|
| http://localhost:5173/staff/ | 200 | Tax & W-9 Center + Download W-9 → PDF 200 |
| http://localhost:5173/staff/?previewRole=seller | 200 | Sin Tax & W-9; sin URL fiscal |
| http://localhost:5173/artist/ | 200 | W-9 + Download W-9 → PDF 200 |
| http://localhost:5173/client/ | 200 | Sin W-9; sin Tax & W-9 Center |
| PDF runtime (`curl -I`) | **200** | `Content-Type: application/pdf` |

Vite dev: `cd MiamiDJBeat-MigracionV2 && npm run dev`

---

## 9. Instrucciones validación visual PO

1. **Staff owner** — `/staff/`: confirmar sección Tax & W-9 Center, tarjeta W-9, acción **Download W-9** interactiva; clic abre/descarga PDF; metadata y badge intactos; sin errores Console/Network.
2. **Staff seller** — `/staff/?previewRole=seller`: confirmar **no** aparece Tax & W-9 Center ni enlace fiscal.
3. **Artist** — `/artist/`: W-9 con Download W-9 funcional; PDF HTTP 200.
4. **Client** — `/client/`: sin W-9, sin Tax & W-9 Center; inspeccionar DOM — no debe existir URL del PDF ni identificadores SPC-001 / TV-SPC-001-1 / fw9-corporate.pdf.
5. **Regresión LC-4A**: layout full-width, metadata compacta, contratos planned siguen “Coming soon” (no botón).

---

## 10. Riesgos / deuda

| Riesgo | Mitigación |
|--------|------------|
| Atributo `download` en cross-origin futuro | Hoy same-origin Vite; en prod verificar mismo origen o confiar en `target="_blank"` |
| SPA: curl solo valida entry HTML 200 | DOM cubierto por tests de integración + validación PO manual |
| Library rows con template sin asset | Mapper devuelve coming soon — sin href vacío |

---

## 11. Pendientes

- [ ] Aprobación visual Product Owner
- [ ] Commit autorizado por Capitán (post-PO)
- [ ] LC-6 / LC-7 — explícitamente fuera de scope

---

## 12. Git

| Acción | Estado |
|--------|--------|
| Commit | **NO** |
| Push | **NO** |
| Merge | **NO** |
| PR | **NO** |
| Deploy | **NO** |

---

## 13. Estado final

**PENDIENTE DE VALIDACIÓN VISUAL PO**

No marcar FINALIZADO sin aprobación explícita del Product Owner.
