# MATRIZ DE JURISDICCIONES Y DOMINIOS — MDJB

## 1. Hilo Maestro: Miami DJ Beat LLC (Orquestador y Auditor)
- Dominio: Gobernanza, arquitectura global, `docs/ESTADO_MAESTRO.md`, `CLAUDE.md`, gestión de merges y PRs a `main`.

## 2. Especialista: Elixis Voice Agent Blueprint
- Dominio exclusivo: Edge functions de audio/Realtime (`elixis-realtime-token`, `elixis-chat`), WebSocket, prompts del agente y herramientas de voz (`enviar_sms`), más la memoria persistente del agente (`elixis_memory_facts`, `agent_memory`, y `dj_memory_facts` — vista unificada de consulta, no tabla física; no duplicar la verdad ahí).
- Restricción: No edita estilos de la web principal ni lógica financiera de Stripe.

## 3. Especialista: Business Financial Intelligence / Artist Financial
- Dominio exclusivo: Integración Stripe Connect, tablas contables (`cash_flow`, `payouts`), reportes de ingresos y contratos.
- Restricción: No toca el motor de voz ni configuraciones de UI general.

## 4. Especialista: Road Master Map / Calendario Business Intelligence
- Dominio exclusivo: Matriz de agenda, disponibilidad de artistas, sincronización de fechas y logística de eventos.

## 5. Especialista: Weather Design Bible / UI
- Dominio exclusivo: Componentes visuales, estilos CSS, cabecera compartida (`mdjb-shared-header.js`) y layouts responsivos.

## 6. Especialista: Inteligencia Musical (ELIXIS/DJMago + software de DJ + MDJPRO)
- Dominio exclusivo: que ELIXIS/DJMago catalogue y arme playlists a partir de lo que Serato DJ, VirtualDJ y Rekordbox ya dejan en la máquina del DJ (`database V2`/`history.database`, `.m3u`/`tracklisting.txt`, exportación XML); el punto de conexión con MDJPRO como vehículo local (sin construir todavía); y el reconocimiento tipo Shazam bajo demanda (ACRCloud/AudD) como pieza aparte, de bajo volumen, para identificar sets ajenos.
- Registrado en estado VISIÓN (2026-08-28) — sin ticket de construcción abierto. Ver `docs/ESTADO_MAESTRO.md`.
- Restricción dura: **cero cambios a código/config/SQL de MDJPRO sin orden explícita del PO** — la app funciona al 100% en producción hoy (licenciamiento, cobro, kill-switch). Documentar/investigar MDJPRO es aceptable; modificarlo no.
- Restricción general: no toca el motor de voz de ELIXIS (dominio #2) ni la lógica financiera de Stripe (dominio #3) más allá de lo que ya exista para el propio flujo de reconocimiento bajo demanda, si se llega a construir.
