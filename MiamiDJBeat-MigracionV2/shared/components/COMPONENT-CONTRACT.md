# COMPONENT-CONTRACT.md

**TICKET-V2-SHARED-CORE-017 — Components Library Specification**

**Módulo:** MOD-009 · Contrato por componente  
**Versión:** 1.0

> Plantilla contractual — **no** props TypeScript. Cada entrada inventario conforma a esta estructura.

---

## Campos obligatorios (inventario)

| Campo | Req | Descripción |
|-------|-----|-------------|
| `id` | ✅ | `MdjButton` — NAMING-CONVENTIONS |
| `category` | ✅ | COMPONENT-CATEGORIES |
| `purpose` | ✅ | Una línea funcional |
| `consumers` | ✅ | client \| artist \| staff \| all |
| `dependencies` | ✅ | DS tokens · other component ids |
| `status` | ✅ | planned \| documented \| deprecated |
| `version` | ✅ | Semver spec — starts 1.0.0 |

---

## Props conceptuales (runtime futuro)

| Prop tipo | Permitido | Prohibido |
|-----------|-----------|-----------|
| `variant` | enum documented | arbitrary string |
| `size` | sm \| md \| lg from DS | px literals |
| `disabled` | boolean | — |
| `loading` | boolean | — |
| `labelKey` | i18n key | raw string |
| `ariaLabelKey` | i18n key | raw string |
| `onAction` | callback ref | inline business logic |
| `children` | composition | HTML strings |
| `className` | escape hatch ADR | default pattern |
| `data-testid` | qa ADR | — |

**Prohibido en props:** `role`, `capability`, `userId`, `orderId`, `paymentToken`, `themeToken`, `locale`.

---

## Variants

| Regla | Detalle |
|-------|---------|
| V-01 | Variants map to DS — primary · secondary · ghost · danger |
| V-02 | Max 6 variants per component without ADR |
| V-03 | Portal-specific variant → portal wrapper — not Core id |

---

## Events emitted (component-level)

Document in COMPONENT-EVENTS per component ADR — e.g. Modal `onOpen`, `onClose`.

---

## Accessibility contract

Every interactive component **must** document:

| Field | Required |
|-------|----------|
| `role` | ARIA role |
| `keyboard` | Key map |
| `focusManagement` | trap/restoration for overlays |
| `labelStrategy` | visible label \| ariaLabelKey |

→ ACCESSIBILITY-GUIDELINES.md

---

## Theme consumption

| Rule | Detail |
|------|--------|
| TC-01 | List token refs used — no hex |
| TC-02 | Respond to THEME_CHANGED ADR |
| TC-03 | No new tokens — request Theme ticket |

---

## Responsive contract

| Field | Description |
|-------|-------------|
| `responsiveBehavior` | stack \| hide \| full-bleed \| MOD-016 ref |
| `minTouchTarget` | 44px ADR mobile |

---

## Feature flag hook (optional)

| Field | Description |
|-------|-------------|
| `flagKey` | `flag.mod-009.component-id` optional |
| `defaultWhenMissing` | false |

---

## Composition

| Rule | Detail |
|------|--------|
| CP-01 | Document `allowedChildren` if restricted |
| CP-02 | Document `slots` — header, footer, actions |
| CP-03 | See COMPOSITION-RULES.md |

---

## Ejemplo conceptual (Button)

```
id: MdjButton
category: Buttons
purpose: Primary user action trigger
variants: primary | secondary | ghost | danger
sizes: sm | md | lg
states: COMPONENT-STATES all interactive
labelKey: required unless icon-only + ariaLabelKey
dependencies: semantic.color.accent, spacing.md, radius.md
consumers: all portals
status: documented
```

---

*COMPONENT-CONTRACT v1.0 — TICKET-V2-SHARED-CORE-017*
