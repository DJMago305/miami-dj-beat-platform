# TICKET-V2-LEGAL-UX-MOCKUPS-DISCOVERY-001

## Estado

**DISCOVERY LISTO PARA REVISIÓN DEL PRODUCT OWNER**

| Campo | Valor |
|-------|-------|
| Modo | Discovery + documentación UX — **sin implementación** |
| Fecha | 2026-07-20 |
| Prerequisitos | Legal Center · Signing Workflow · Contract Drafting · Design System MOD-008 |
| Dispositivos | Desktop · Tablet · Mobile |
| Autorización | Sin TS, HTML, CSS, SQL, API, Edge, runtime, commit, push, merge, PR, deploy |

### Disclaimer

Este ticket define **wireframes conceptuales, navegación, componentes UX y tokens visuales legales**. No produce Figma files ni código. Inspira en flujos de DocuSign, Adobe Sign, PandaDoc, banca y concesionarios **sin copiar** layouts ajenos. Identidad: **Miami DJ Beat — Dark · Gold · Premium · Glass** (MOD-007/008).

---

## Problema

Discovery funcional (LGC, LGS) está completo. Antes de LC-1 / SW-3 runtime, PO y diseño necesitan **experiencia visual unificada** probada en tres portales + firmante externo — navegación, estados, wizard, PDF, auditoría — en desktop, tablet y móvil.

---

## Relación con capas

```
LGC/LGS (funcional)  →  LGX (UX mockups)  →  UX-1 Wireframes  →  UX-4 Implementation
        ↑                        ↑
   LEGAL/README (A4 shell)   MOD-008 Design System tokens
```

| Ticket | Aporta a UX |
|--------|-------------|
| LEGAL-CENTER-001 | Secciones Staff / Artist / Client |
| SIGNING-WORKFLOW-001 | Wizard 10 pasos · Package view |
| CONTRACT-DRAFTING-001 | PDF shell A4 |
| DESIGN-SYSTEM-SPEC | Dark/gold grammar |

---

# ENTREGABLE 1 — Arquitectura UX

## 1.1 Módulos LGX

| ID | Módulo | Alcance |
|----|--------|---------|
| **LGX-001** | Staff Legal Center UX | Sidebar · 8 secciones · tablas · filtros |
| **LGX-002** | Artist Legal Center UX | MY LEGAL PROFILE · 7 tabs |
| **LGX-003** | Client Legal Center UX | MY DOCUMENTS · 4 tabs · sin fiscal |
| **LGX-004** | Signing Wizard UX | 10 pantallas · progreso · resume |
| **LGX-005** | W-9 Center UX | Zona segura aislada |
| **LGX-006** | Compliance UX | Matrices 4 tipos evento |
| **LGX-007** | Introduction Registry UX | Tarjetas · timeline · filtros |
| **LGX-008** | PDF Preview UX | A4 · header/footer MDJB |
| **LGX-009** | Audit Timeline UX | Event stream vertical |

## 1.2 Superficies UX

| Surface | Route (futuro) | Shell |
|---------|----------------|-------|
| Staff Legal | `/staff/legal/` | Full staff layout + sidebar |
| Staff Signing | `/staff/legal/signing/` | Sub-nav under LEGAL |
| Artist Legal | `/artist/legal/` | Artist strip + tabs |
| Client Legal | `/client/legal/` | Client portal header |
| External signer | `/sign/{token}` | Minimal MDJB — no portal nav |
| PDF modal | overlay any surface | LGX-008 |

## 1.3 Navegación global (Staff)

```
STAFF PORTAL
├── Dashboard (ops)
├── LEGAL  ← primary parent
│   ├── Legal Center (LGX-001) — default
│   └── Signing Center (link LGS)
├── CRM / Roster / …
```

Artist/Client: Legal entry via **header icon** (scale/gavel subtle) + badge count pending.

## 1.4 Breakpoints (align MOD-016)

| Breakpoint | Width | Layout strategy |
|------------|-------|-----------------|
| **Desktop** | ≥1024px | Sidebar + content; wizard split view |
| **Tablet** | 768–1023px | Collapsible sidebar; stacked wizard |
| **Mobile** | <768px | Bottom nav (Artist/Client); hamburger (Staff); full-screen wizard steps |

## 1.5 Design tokens — Legal UX extension

| Token | Value | Use |
|-------|-------|-----|
| `--mdj-legal-green` | `#2ECC71` on `#0D1F17` | GREEN status bg |
| `--mdj-legal-yellow` | `#F1C40F` on `#1F1A0D` | YELLOW warning |
| `--mdj-legal-red` | `#E74C3C` on `#1F0D0D` | RED block |
| `--mdj-legal-gold` | `#C9A227` | Accent rules, CTAs primary legal |
| `--mdj-legal-surface` | glass dark `rgba(12,12,18,0.85)` | Cards |
| `--mdj-legal-doc-bg` | `#FAFAFA` | PDF preview paper (light island in dark UI) |
| `--mdj-legal-w9-border` | double gold 2px | W-9 secure zone |
| Typography eyebrow | Cinzel | "LEGAL CENTER", section labels |
| Typography body | Source Serif / system sans | Document preview |
| Icon set | Line icons 24px | ✓ ⚠ ✗ scale document shield |

## 1.6 Component library (conceptual — MOD-009 future)

| Component | Used in |
|-----------|---------|
| `LegalStatusBanner` | All dashboards |
| `LegalStatusBadge` | GREEN/YELLOW/RED pill |
| `DocumentRow` | Libraries |
| `PackageProgressCard` | Package view + wizard |
| `SignatureCanvas` | Wizard step 6 |
| `InitialsCapture` | Wizard step 7 |
| `ClauseCheckbox` | Wizard step 8 |
| `AuditTimelineItem` | LGX-009 |
| `IntroductionCard` | LGX-007 |
| `ComplianceMatrixRow` | LGX-006 |
| `PdfViewerFrame` | LGX-008 |
| `SecureZonePanel` | LGX-005 |

## 1.7 UX principles (legal-specific)

| # | Principle |
|---|-----------|
| UX-L01 | **Clarity over density** — dealer/bank style: one primary CTA per screen |
| UX-L02 | **Progress always visible** — package N/M + wizard step bar |
| UX-L03 | **No surprise signatures** — full doc read step before sign |
| UX-L04 | **Fiscal isolation** — W-9 visually distinct zone |
| UX-L05 | **Recoverable sessions** — "Continue where you left off" banner |
| UX-L06 | **Accessible fallback** — typed signature always beside canvas |
| UX-L07 | **MDJB brand** — gold accent, dark glass; not generic blue e-sign clone |

---

# ENTREGABLE 2 — Staff Legal Center UX (LGX-001)

## 2.1 Layout desktop

```
┌──────────┬─────────────────────────────────────────────────────────────┐
│ STAFF    │  LEGAL CENTER                    [Search…] [+ Send Package] │
│ SIDEBAR  ├─────────────────────────────────────────────────────────────┤
│          │ Overview │ Pending │ W-9 │ Insurance │ Alerts │ …         │
│ …        ├─────────────────────────────────────────────────────────────┤
│ ► LEGAL  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐           │
│   Center │  │ 12      │ │ 8       │ │ 3       │ │ 5       │           │
│   Signing│  │ Pending │ │ Missing │ │ Expired │ │ Corp    │           │
│          │  │ Sign    │ │ W-9     │ │ Insur.  │ │ Block   │           │
│          │  └─────────┘ └─────────┘ └─────────┘ └─────────┘           │
│          │  COMPLIANCE ALERTS (table)                                    │
│          │  ┌──────────────────────────────────────────────────────┐   │
│          │  │ Artist      │ Status │ Issue           │ Action      │   │
│          │  │ DJMago305    │ RED    │ W-9 missing     │ [Remind]    │   │
│          │  └──────────────────────────────────────────────────────┘   │
└──────────┴─────────────────────────────────────────────────────────────┘
```

## 2.2 Sidebar sections (8)

| Section | Primary widget | Quick actions |
|---------|----------------|---------------|
| Overview | KPI cards + alert table | Send package · Export |
| Pending Signatures | Queue table | Counter-sign · Nudge |
| Missing W-9 | Roster filter RED tax | Send PKG-DJ-ROSTER |
| Expired Insurance | Date sort | Request COI |
| Compliance Alerts | YELLOW/RED list | Open profile |
| Corporate Restrictions | Matrix fail filter | View compliance |
| Introduction Registry | Card grid + search | Issue waiver |
| Audit Log | Timeline LGX-009 | Export CSV |

## 2.3 Table pattern

- Sticky header · row hover gold left border  
- Columns: Name · MDJB ID · Status badge · Issue · Last activity · Actions  
- Filters: status · role · date · event type  
- Bulk: select rows → Send reminder (manager+)

## 2.4 Tablet / mobile staff

- Sidebar → hamburger drawer  
- KPI cards 2×2 grid  
- Tables → card list with swipe actions  
- Primary FAB: **+ Send** (manager only)

---

# ENTREGABLE 3 — Artist Legal Center UX (LGX-002)

## 3.1 Branding header

```
┌─────────────────────────────────────────────────────────────────┐
│  MY LEGAL PROFILE          ● GREEN  Legal status complete       │
│  DJMago305 · MDJB-A-XXXX                                        │
└─────────────────────────────────────────────────────────────────┘
```

RED state: full-width red banner — "Complete requirements to accept bookings" — **[Resolve now]**

## 3.2 Tab navigation

Dashboard | Documents | History | Tax & W-9 | Compliance | Introductions | Downloads

Mobile: bottom nav — **Home · Docs · Tax · More** (History, Compliance, Introductions, Downloads under More)

## 3.3 Dashboard widgets

| Widget | Content |
|--------|---------|
| Status summary | Item checklist ✓/⚠/✗ |
| Pending package | PackageProgressCard — **[Continue signing]** |
| Expiring | Insurance 14 days — **[Update]** |
| Recent docs | Last 3 signed — quick download |

## 3.4 Documents tab

- Filter chips: All · Policies · Contracts · Special  
- DocumentRow list → tap opens PDF preview modal  
- Empty: illustration + "Documents appear after you sign"

## 3.5 Quick actions (sticky mobile)

**[Sign pending]** · **[Download all]** (excludes W-9 zip)

---

# ENTREGABLE 4 — Client Legal Center UX (LGX-003)

## 4.1 Scope boundary

**MY DOCUMENTS** — **NO** W-9 tab · **NO** Tax · **NO** internal fiscal · **NO** performer introductions

## 4.2 Tabs

Contracts | Authorizations | Signature History | Downloads

## 4.3 Contracts tab

- Group by event/order  
- Row: Event name · CTR-006 · Signed date · **[Open]** **[PDF]**  
- Pending: amber border — **[Sign to confirm booking]**

## 4.4 Authorizations tab

- SPC-005 media releases · signed/unsigned

## 4.5 Client dashboard (optional single-page mobile)

Stack: Active contract card → Policies accepted summary → History link

---

# ENTREGABLE 5 — Legal Status UX

## 5.1 Aggregate badges

| Status | Visual | Copy EN |
|--------|--------|---------|
| **GREEN** | Green dot + subtle green glow border | "Legal profile complete" |
| **YELLOW** | Amber triangle icon | "Action recommended — you can still operate" |
| **RED** | Red octagon/stop | "Action required — bookings/payouts restricted" |

## 5.2 Item rows

```
✓  Terms of Service v1.0        Accepted Jul 1, 2026
✓  Anti-Bypass Policy           Accepted Jul 1, 2026
⚠  Insurance (COI)               Expires in 14 days     [Update]
✗  W-9                          Not submitted          [Complete]
```

Icons: ✓ green check circle · ⚠ amber clock · ✗ red x circle

## 5.3 Restrictions panel (RED)

Expandable **"What's blocked"** list:
- ✗ Accept new jobs  
- ✗ Receive payouts  
- ✗ Appear in search  

## 5.4 Tooltip / help

Each item links **"Why is this required?"** → Compliance matrix context

---

# ENTREGABLE 6 — Signing Wizard UX (LGX-004)

## 6.1 Shell (all steps)

```
┌─────────────────────────────────────────────────────────────────┐
│ [MDJB logo]  Signing · PACKAGE-2026-001          Step 4 of 10  │
│ ████████░░░░░░░░░░░░░░░░░░░░  40%                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                     [ STEP CONTENT ]                            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [← Back]                              [Save & exit]  [Continue →] │
└─────────────────────────────────────────────────────────────────┘
```

External signer: same shell, no portal header — email shown step 2.

## 6.2 Step specifications

| Step | Title | Key UI |
|------|-------|--------|
| 1 Welcome | "Complete your documents" | Package code · doc count · expiry date · ESIGN brief |
| 2 Identity | "Confirm your identity" | Email re-type OR logged-in badge · disclosure accordion |
| 3 Package Summary | "What's included" | PackageProgressCard preview |
| 4 Document List | "Documents to complete" | Checklist ✓/○ per doc · tap to start |
| 5 Document Viewer | "Review" | LGX-008 PDF scroll · "I have read" unlock Continue |
| 6 Signature | "Sign" | Canvas + Type tabs · legal name prefill |
| 7 Initials | "Initial sections" | Per-section mini canvas (Anti-Bypass §6) |
| 8 Checkboxes | "Required agreements" | Unchecked clauses · none pre-checked |
| 9 Final Review | "Review and confirm" | Summary list editable links |
| 10 Completion | "You're done" | Success animation subtle · Download PDF · Return portal |

## 6.3 Navigation rules

- **Back** enabled except after step 9 confirm  
- **Save & exit** → resume banner on return  
- **Continue** disabled until step requirements met  
- Mobile: full-screen steps; progress bar top fixed  

## 6.4 Desktop enhancement

Steps 5–8: **split view** — document left 55% · sign panel right 45% (dealer F&I pattern)

## 6.5 Session resume banner

```
┌─────────────────────────────────────────────────────────────┐
│ ↩ You have an incomplete signing session (3/5 documents). │
│                                    [Continue signing]       │
└─────────────────────────────────────────────────────────────┘
```

---

# ENTREGABLE 7 — Signature Package UX

## 7.1 Package card

```
┌─────────────────────────────────────────────────────────────┐
│  PACKAGE-2026-001                          Expires Aug 3    │
│  ─────────────────────────────────────────────────────────  │
│  Progress   ████████████░░░░░░░░  3 / 5                     │
│                                                             │
│  ✓  Terms of Service (LGL-001)                              │
│  ✓  Privacy Policy (LGL-002)                                │
│  ✓  Anti-Bypass Policy (LGL-003)                            │
│  ⚠  DJ Partner Agreement (CTR-001)        [Continue]        │
│  ⚠  W-9 Package (SPC-001)                 [Start]           │
│                                                             │
│  [Continue package]                                           │
└─────────────────────────────────────────────────────────────┘
```

## 7.2 Status icons

✓ complete · ⚠ in progress · ○ not started · ✗ rejected/void

## 7.3 Staff package builder (preview in Signing Center)

Drag reorder · add doc from published templates · expiry picker · recipient preview

---

# ENTREGABLE 8 — W-9 Center UX (LGX-005)

## 8.1 Secure zone visual

- Full section wrapped in **double gold border** + lock icon  
- Background slightly darker than main legal surface  
- Banner: "Tax Information — Enhanced security"

## 8.2 States

| State | Visual | CTA |
|-------|--------|-----|
| ✓ Approved | Green shield badge | Download my W-9 |
| ⚠ Pending | Amber pulse dot | "Under review" |
| ⚠ Review required | Amber + message | Resubmit |
| ✗ Missing | Red | Complete W-9 package |

## 8.3 Content shown

- Masked TIN `***-**-1234` only  
- Last approved date · next review  
- **Never** show W-9 in Documents list sidebar highlight same as contracts

## 8.4 Mobile

Dedicated **Tax** bottom nav tab (Artist only) — not under generic Docs

## 8.5 Fiscal disclaimers

Static info block: "Miami DJ Beat LLC uses this information for 1099 reporting. We do not provide tax advice."

---

# ENTREGABLE 9 — Compliance UX (LGX-006)

## 9.1 Layout

Segment control: **Private · Restaurants · Corporate · Festivals**

```
CORPORATE EVENTS — Your readiness
──────────────────────────────────
✓  Event contract (CTR-006)              Complete
✓  Anti-Bypass accepted                  Complete
⚠  W-9 approved                          Pending review
✗  Insurance COI ($1M)                   Missing        [Upload]
✓  Business license                      Complete

Overall:  ⚠ YELLOW — Corporate events restricted until insurance filed
```

## 9.2 Matrix row states

✓ green · ⚠ amber optional pending · ✗ red blocking

## 9.3 Staff view

Heatmap table: performers × requirement columns · sort by fail count

---

# ENTREGABLE 10 — Introduction Registry UX (LGX-007)

## 10.1 Card design

```
┌─────────────────────────────────────────────────────────────┐
│  INT-2026-00421                              ● Active        │
├─────────────────────────────────────────────────────────────┤
│         Miami DJ Beat LLC                                    │
│              ↓ presents                                      │
│         Mojitos Calle 8  (restaurant)                        │
│              ↔                                               │
│         DJMago305                                            │
├─────────────────────────────────────────────────────────────┤
│  Introduced   Jul 21, 2026    Source   Event booking         │
│  Expires      Jul 21, 2028    Evidence ORDER-8842            │
│  [View policy LGL-003]  [Staff: Issue waiver]                │
└─────────────────────────────────────────────────────────────┘
```

## 10.2 Timeline view (staff)

Vertical timeline grouped by month · filter: active · expired · waived · disputed

## 10.3 Search

By client name · artist · order ID · date range

## 10.4 Artist view

Read-only cards · educational footer on anti-bypass

---

# ENTREGABLE 11 — Audit Timeline UX (LGX-009)

## 11.1 Timeline pattern

```
Jul 21, 2026
  ● 14:32  document.downloaded     CTR-006 · IP ***.***.***.** · Mobile
  ● 14:30  signature.applied       CTR-001 · drawn signature
  ● 14:28  package.opened          PACKAGE-2026-001
  ● 09:15  package.sent            email · staff@mdjb
Jul 20, 2026
  ● 16:00  package.created         staff user
```

## 11.2 Event icons

create · send · open · sign · reject · expire · supersede · download · resend · revoke

## 11.3 Detail drawer

Click event → side drawer: full metadata · link to document · staff only: raw audit id

## 11.4 User vs staff

User history: simplified · no staff internal ids  
Staff audit: full export CSV button top-right

---

# ENTREGABLE 12 — PDF Preview UX (LGX-008)

## 12.1 Viewer chrome

```
┌─────────────────────────────────────────────────────────────┐
│ ← Back   CTR-001 DJ Partner Agreement v1.0     [Download] [⛶] │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ [MDJB HEADER — logo · doc no · page 1 of 4]             │ │
│ │                                                         │ │
│ │   Document body (A4 ratio, light paper on dark chrome)  │ │
│ │                                                         │ │
│ │ [signature blocks · audit footer]                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                    [ − ] 100% [ + ]     Page 1 / 4          │
└─────────────────────────────────────────────────────────────┘
```

## 12.2 A4 behavior

- Desktop: max-width 794px centered (A4 at 96dpi)  
- Mobile: horizontal pinch zoom · vertical scroll · sticky page indicator  
- Print: `@media print` uses full A4 — future runtime

## 12.3 Corporate shell (from LEGAL/README)

Header: logo · Miami DJ Beat LLC · doc no · version · page n/N  
Footer: contact · audit id · confidential notice  
Signed docs: embedded signature image + audit block

## 12.4 Wizard integration

Step 5: viewer must scroll ≥90% or tap "I have read entire document" before Continue enables (UX spec — configurable PO)

---

# ENTREGABLE 13 — Wireframes conceptuales

Wireframes ASCII incluidos en entregables 2–12. Resumen pantallas a mockup en UX-1:

| # | Screen | Portal | Priority |
|---|--------|--------|----------|
| W-01 | Staff Overview | Staff | P0 |
| W-02 | Staff Pending Signatures | Staff | P0 |
| W-03 | Artist Dashboard | Artist | P0 |
| W-04 | Client Contracts | Client | P0 |
| W-05 | Wizard steps 1–10 | All + external | P0 |
| W-06 | Package card | All | P0 |
| W-07 | W-9 secure zone | Artist | P0 |
| W-08 | Compliance matrix | Artist + Staff | P1 |
| W-09 | Introduction card | Staff + Artist | P1 |
| W-10 | Audit timeline | Staff | P1 |
| W-11 | PDF preview | All | P0 |
| W-12 | Mobile bottom nav | Artist/Client | P0 |
| W-13 | External signer welcome | External | P0 |
| W-14 | RED status block | Artist | P0 |
| W-15 | Staff package builder | Staff | P1 |

**UX-1 deliverable:** Figma file `MDJB-Legal-UX-v1` with above screens at 3 breakpoints.

---

# ENTREGABLE 14 — Roadmap UX

| Phase | ID | Output | Owner | Gate |
|-------|-----|--------|-------|------|
| Discovery | **UX-0** | This ticket | Agent/Architect | PO approve |
| Wireframes | **UX-1** | Figma lo-fi + hi-fi key screens | Design | PO visual sign-off |
| Design System | **UX-2** | Legal components in MOD-009 spec | Architect | Token review |
| Runtime Planning | **UX-3** | Map LGX → LC/SW phases · storybook list | Architect | Dev estimate |
| Implementation | **UX-4** | UI in lab portales | Dev | QA + PO |
| Production | **UX-5** | Cutover | PO | APROBADO DEPLOY |

**Parallel tracks:** UX-1 can start after UX-0 PO OK · UX-4 blocked until LC-2 data contracts.

---

# ENTREGABLE 15 — Riesgos pendientes

| ID | Riesgo | Sev. | Mitigación UX |
|----|--------|------|---------------|
| RU-01 | Generic e-sign clone look | Media | MDJB gold/dark mandatory review |
| RU-02 | Mobile signature canvas too small | Alta | Full-width step · typed fallback |
| RU-03 | W-9 zone not visually distinct | Alta | LGX-005 double border + separate nav |
| RU-04 | Staff table overload mobile | Media | Card fallback pattern |
| RU-05 | PDF unreadable on phone | Alta | Pinch zoom + page mode · minimum 16px |
| RU-06 | Wizard fatigue 10 steps | Media | Progress · save & exit · package summary |
| RU-07 | Client sees performer fiscal by mistake | Crítica | LGX-003 scope QA checklist |
| RU-08 | Color-only status (a11y) | Alta | Icon + text always with color |
| RU-09 | External signer distrust | Media | MDJB branding · security copy step 2 |
| RU-10 | Figma drift from MOD-008 | Media | UX-2 token binding review |

---

## External signer flow (summary)

Minimal chrome · steps 1–10 identical to LGX-004 · post-complete: download + optional create account CTA · no W-9 center in nav for client external guests unless package includes performer W-9 self-sign

---

## Inspiring patterns (not copied)

| Industry | Pattern adopted |
|----------|-----------------|
| DocuSign / Adobe Sign | Step wizard · progress · review before sign |
| PandaDoc | Package document list · status per doc |
| Banking onboarding | Identity step · disclosure accordion |
| Dealer F&I | Split doc/sign desktop layout |
| Corporate portals | Staff sidebar · KPI cards · audit timeline |

---

## Fuera de alcance

Figma files · HTML · CSS · TS · runtime · commit · deploy.

---

## Referencias

| Documento |
|-----------|
| `TICKET-V2-LEGAL-CENTER-DISCOVERY-001` |
| `TICKET-V2-LEGAL-SIGNING-WORKFLOW-DISCOVERY-001` |
| `docs/V2/LEGAL/README.md` |
| `MiamiDJBeat-MigracionV2/shared/design-system/DESIGN-SYSTEM-SPEC.md` |

---

## Criterio de cierre

| Criterio | Estado |
|----------|--------|
| 15 entregables | ✅ |
| 9 módulos LGX-001–009 | ✅ |
| Desktop / tablet / mobile | ✅ |
| Wireframes conceptuales (ASCII) | ✅ |
| Roadmap UX-0–UX-5 | ✅ |
| Implementación | ❌ no autorizada |

**ESTADO FINAL: DISCOVERY LISTO PARA REVISIÓN DEL PRODUCT OWNER.**

**DETENERSE.**
