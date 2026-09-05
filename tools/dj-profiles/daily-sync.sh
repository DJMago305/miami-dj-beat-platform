#!/bin/bash
# tools/dj-profiles/daily-sync.sh
#
# Re-corre el generador de perfiles de DJ (build.mjs) automáticamente vía
# launchd (~/Library/LaunchAgents/com.miamidjbeat.dj-profiles-sync.plist).
#
# Actualiza SOLO archivos locales en el working tree (web/dj/*.html,
# web/equipo.html, web/sitemap.xml) — nunca hace git add, commit, push ni
# ningún cambio a producción. Eso sigue siendo decisión manual del PO,
# como exige CLAUDE.md. Este script resuelve únicamente el trabajo de
# "acordarse de correrlo" — la aprobación humana antes de producción no
# se toca.
#
# Log persistente en tools/dj-profiles/sync.log — cada corrida deja
# timestamp + qué encontró, para que se pueda revisar aunque nadie haya
# estado mirando cuando corrió.

set -euo pipefail

REPO_DIR="/Users/djmago/Desktop/miami-dj-beat-platform"
LOG_FILE="$REPO_DIR/tools/dj-profiles/sync.log"
NODE_BIN="/opt/homebrew/bin/node"

cd "$REPO_DIR"

{
  echo "════════════════════════════════════════════════════════"
  echo "$(date '+%Y-%m-%d %H:%M:%S %Z') — corrida automática (launchd)"
  echo "════════════════════════════════════════════════════════"

  BEFORE_STATUS="$(git status --porcelain web/dj/ web/equipo.html web/sitemap.xml 2>/dev/null || true)"

  "$NODE_BIN" tools/dj-profiles/build.mjs 2>&1

  AFTER_STATUS="$(git status --porcelain web/dj/ web/equipo.html web/sitemap.xml 2>/dev/null || true)"

  if [ "$BEFORE_STATUS" != "$AFTER_STATUS" ] || [ -n "$AFTER_STATUS" ]; then
    echo ""
    echo "Cambios detectados en el working tree (sin comitear, pendientes de revisión):"
    echo "$AFTER_STATUS"
  else
    echo ""
    echo "Sin cambios — los datos en vivo coinciden con lo ya publicado."
  fi
  echo ""
} >> "$LOG_FILE" 2>&1
