# FRONTEND ARCHITECTURE & RULES

This document dictates the absolute boundaries of the Miami DJ Beat Platform frontend structure. AI Agents and automated tools MUST respect this architecture. Any refactor that violates these rules is considered destructive.

## 1. Global Layout Rules
The platform uses a standardized container-based approach:
- No global wrapping or enclosing of the existing `.container` divs unless explicitly approved by the Lead Engineer.
- The root layout structure in all `.html` files is considered LOCKED. Do not inject new top-level wrappers (e.g., `<div id="app">`, `<main class="wrapper">`) that alter the flex/grid behavior of the page.
- Modifying `body` styles or global resets in `styles.css` is strictly forbidden unless authorized.

## 2. Containers
The visual structure heavily relies on specific `.container` and layout boundaries:
- `.container`: Max-width constrained block. Do not alter its padding/margin rules globally.
- `.knowledge-container` / `.knowledge-sidebar`: Forms a strict 2-column flex relation on the Knowledge page. Do not alter their flex relations, change `flex-shrink` parameters, or wrap their inner contents in new divs. Doing so destroys the sticky layout.

## 3. Navigation
The top navigation (`header`, `.main-nav`, `.top-nav`, `.nav-item-dropdown`) is a mission-critical component.
- The `.nav-dropdown-menu` architecture is standard across 6+ files. Do not modify the DOM structure of the navigation.
- CSS for the navigation is universally applied. Never add inline styles to navigation elements.

## 4. Content and i18n
- **DO NOT** replace hardcoded Spanish text with `<span data-i18n="..."></span>` tags if the corresponding translation string does not exist in `translations.js`.
- **NEVER** leave a paragraph or list item empty just because an i18n tag was applied. Wait for the actual translation data before stripping the source text.
- Editorial pages (like Knowledge) rely on specific hardcoded HTML structures for visual weight. Do not refactor paragraphs, headings, or lists into generalized components without permission.

## 5. Security Markers
Critical sections of the HTML files are marked with:
`<!-- LOCKED SECTION: DO NOT MODIFY -->`

If you are an agent reading a file and you see this marker, you are strictly prohibited from editing the DOM node that immediately follows it.

---
**Lead Engineer Override:** These rules can only be bypassed by explicit instruction from the human Lead Engineer acknowledging the risk.
