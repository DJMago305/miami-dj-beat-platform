# Colores

## Marca y sitio (`web/styles.css`, `:root`)
| Token | Valor | Uso |
|---|---|---|
| `--bg` | `#07090e` | fondo del sitio |
| `--panel` / `--panel2` | `#0f1623` / `#0c1320` | tarjetas y paneles |
| `--text` / `--muted` | `#e8eefc` / `#b7c2dc` | texto principal / secundario |
| `--accent` = `--gold` | `#c5a059` | dorado de marca (bordes, botones principales, títulos de sección) |
| `--accent-blue` | `#66a3ff` | acento técnico |
| `--line` | `rgba(255,255,255,.08)` | líneas divisorias |
| `--glass` / `--glass-border` | `rgba(15,22,35,.7)` / `rgba(255,255,255,.1)` | cristal (paneles translúcidos) |
Dorado de texto en tablas del portal: `#d4af37`.

## Calendario (`calendario-operacional-inteligente.html`, modo oscuro; el portal usa los mismos en `.portal-coi`)
Fondo `--ground #05070f` · panel `#0e1226` · panel-2 `#0a0d1e` · texto `#f3f5ff` · texto suave `#aeb6da` · texto tenue `#6b7297`.
Acentos por categoría: `--set #ff2e86` (rosa: sets/reservas **y vista activa del selector**), `--today #ff2d55` (rojo: hoy), `--staff #ff7a4d`, `--prod #8b6cff`, `--pago #10b3a3`, `--clima #f5a623`, `--cliente #3d8bff` (azul: clientes/cumple/aniv.), `--personal #54d29a`, `--owner #8a91b4`.
Selector Día/Semana/Mes/Año, opción activa: fondo `color-mix(--set 16%)`, texto `--set`, borde interior `--set 45%` (PO 2026-09-21).

## Estados (portal del cliente, `client-portal.js`)
Pendiente `#ffb400` · En revisión `#7eb8f7` · Confirmado `#00c878` · Cancelado `#ff6060`.
Panel del DJ: confirmado `#22c55e`, cancelado `#ef4444`, asignado (aviso) `#22c55e`, movido/recordatorio `#f0cc80`, urgente `#ff2d55`.

## Botones de acción de tabla (portal)
Dorado («Ver Orden», «🔄»): fondo `rgba(197,160,89,.45)`, borde `rgba(197,160,89,.6)`, texto `#fff`.
Rojo («Cancelar», «Delete»): fondo `rgba(220,60,60,.45)`, borde `rgba(220,60,60,.6)`, texto `#fff`.

## Temas
Oscuro por defecto. Portal: `html[data-theme="day"]` (modo día). Calendario: `data-theme="light|dark"` + `prefers-color-scheme`.
