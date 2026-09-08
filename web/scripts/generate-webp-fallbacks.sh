#!/usr/bin/env bash
# Genera un respaldo (.png o .jpg) para cada .webp en web/assets/ que no
# tenga ya uno con el mismo nombre base -- Safari 13.1.2 (macOS High Sierra
# 10.13.6, el tope real de ese sistema) no soporta .webp en absoluto, asi que
# cualquier <img>/background-image que dependa solo de .webp se ve roto ahi.
#
# Usa `sips` (nativo de macOS, sin dependencias nuevas) y decide el formato
# por imagen: si el .webp tiene canal alpha (logos/PNG transparentes) genera
# .png para no perder la transparencia; si no, genera .jpg (mas liviano,
# correcto para fotos reales).
#
# Uso: bash web/scripts/generate-webp-fallbacks.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

JPG_QUALITY=82
count_created=0
count_skipped=0

find web/assets -iname "*.webp" | sort | while IFS= read -r webp; do
  base="${webp%.*}"
  if [[ -f "${base}.jpg" || -f "${base}.jpeg" || -f "${base}.png" ]]; then
    echo "skip (ya tiene respaldo): $webp"
    continue
  fi

  has_alpha="$(sips -g hasAlpha "$webp" 2>/dev/null | awk '/hasAlpha:/{print $2}')"
  if [[ "$has_alpha" == "yes" ]]; then
    out="${base}.png"
    sips -s format png "$webp" --out "$out" >/dev/null
  else
    out="${base}.jpg"
    sips -s format jpeg -s formatOptions "$JPG_QUALITY" "$webp" --out "$out" >/dev/null
  fi
  echo "creado: $out"
done

echo "Listo. Revisa 'git status' para ver los archivos nuevos."
