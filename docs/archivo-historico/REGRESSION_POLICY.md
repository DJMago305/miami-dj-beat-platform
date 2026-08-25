# MDJPRO Regression Prevention Rules

**CRITICAL: ZERO TOLERANCE FOR CROSS-ZONE FIXES**

The dashboard layout is divided into protected, deeply integrated visual systems. A bug in one zone cannot be "fixed" by compromising the structural integrity of another. The following hard barriers must be respected by all developers and AI agents alike.

### 1. HEADER / TOP NAV
- **Rule**: Changing the header layout or navigation styling must NEVER touch, overlap, or alter the positioning of the Weather Sky Engine below it.
- **Scope**: Logo, Tabs, Avatar, Navigation Bar.

### 2. WEATHER SKY ENGINE
- **Rule**: This is a physically stacked z-index engine relying on panoramic math and precise infinite loop transformations (`translate(-50%)`). Changing weather behavior must NEVER touch header layout, nor calendar side-panels.
- **Scope**: Panoramic banner, `.sky-base`, `.sky-clouds`, `.sky-astral-front`, etc.

### 3. AGENDA / CALENDAR PANEL
- **Rule**: Fixing calendar layout issues or date overlays must NEVER touch the hero sky structure or page-level padding.
- **Scope**: `#calendar-master`, FullCalendar overrides.

### 4. LOGIN / SESSION SHELL
- **Rule**: Fixing login or session token redirects must NEVER touch the dashboard layout styling.
- **Scope**: `login.html`, `role-guard.js`, Auth Tabs.

### Enforcement Rules:
1. No cross-zone fixes.
2. No global layout cleanup or "polish" that bridges two zones.
3. No shared header/body/style adjustments unless explicitly approved.
4. No touching unrelated selectors while fixing a local issue.
5. Every change proposed must explicitly declare:
   - **a) exact file**
   - **b) exact selector**
   - **c) exact reason**
   - **d) exact zones that will NOT be touched**
