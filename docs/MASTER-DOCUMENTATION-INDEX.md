# Master documentation index

Canonical entry point for specifications that exist in this repository.  
If a path is not listed here, it is not a declared source of truth.

This file closes integrity probe **V6**. It does not invent missing documents.

## Governance and runtime rules

| Document | Role |
|---|---|
| [AI_RULES.md](../AI_RULES.md) | Auth, RLS, and identity rules for agents and humans |
| [SUPABASE-RUNBOOK.md](../SUPABASE-RUNBOOK.md) | Supabase operations and deploy discipline |
| [docs/workflow-control.md](./workflow-control.md) | Work control: scope, commit, push, deploy |
| [docs/nav/NAV-CONTRACT-001.md](./nav/NAV-CONTRACT-001.md) | Navigation contract (anti-regression) |

## Road map

| Path | Role |
|---|---|
| [docs/roadmap/](./roadmap/) | Generated map of layers, capabilities, and probes |
| [docs/roadmap/README.md](./roadmap/README.md) | How the map is generated |
| [docs/roadmap/build.mjs](./roadmap/build.mjs) | Generator (`node docs/roadmap/build.mjs`) |
| [docs/roadmap/master-map.json](./roadmap/master-map.json) | Source: layers, probes, roadmap items |

## Architecture

| Document | Role |
|---|---|
| [MASTER-WIRING-AUDIT-V1.md](./architecture/MASTER-WIRING-AUDIT-V1.md) | Wiring audit |
| [CASH-FLOW-PRODUCT-DEFINITION-V1.md](./architecture/CASH-FLOW-PRODUCT-DEFINITION-V1.md) | Cash-flow product definition |
| [CFMOVEMENT-READ-MAP-SPEC-V1.md](./architecture/CFMOVEMENT-READ-MAP-SPEC-V1.md) | Cash-flow movement read map |
| [TIE architecture](./architecture/temporal-intelligence/MIAMI-DJ-BEAT-TEMPORAL-INTELLIGENCE-ENGINE-ARCHITECTURE.md) | Temporal intelligence engine |
| [TIE ownership decision](./architecture/temporal-intelligence/MIAMI-DJ-BEAT-TIE-CAPABILITY-OWNERSHIP-AND-DISTRIBUTION-DECISION.md) | TIE capability ownership |
| [Weather design bible](./architecture/weather-intelligence/MIAMI-DJ-BEAT-WEATHER-DESIGN-BIBLE-V1.md) | Weather visual system |
| [Weather engine candidate C](./architecture/weather-intelligence/MIAMI-DJ-BEAT-WEATHER-INTELLIGENCE-ENGINE-CANDIDATE-C.md) | Weather engine candidate |
| [Weather prototype direction](./architecture/weather-intelligence/MIAMI-DJ-BEAT-WEATHER-VISUAL-PROTOTYPE-DIRECTION-V1.md) | Weather prototype direction |

## AI / ELIXIS

| Document | Role |
|---|---|
| [agent-registry.json](./ai/agent-registry.json) | R4 declarative agent and tool catalog |
| [system-agent-v1.md](./ai/system-agent-v1.md) | ELIXIS / assistant system prompt v1 |
| [tracking-contract.md](./ai/tracking-contract.md) | Booth capture / attribution contract |
| [booth-tracking-contract.md](./ai/booth-tracking-contract.md) | Booth tracking (historical companion) |
