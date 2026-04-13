#!/usr/bin/env bash
# Vista previa local del sitio (carpeta web/). Usa solo 127.0.0.1 para evitar fallos IPv6.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"
PORT="${1:-8000}"
echo ""
echo "  Miami DJ Beat — servidor local"
echo "  Carpeta: $DIR"
echo "  URL:     http://127.0.0.1:${PORT}/"
echo "  Para parar: Ctrl+C"
echo ""
exec python3 -m http.server "$PORT" --bind 127.0.0.1
