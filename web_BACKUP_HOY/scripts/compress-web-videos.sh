#!/usr/bin/env bash
# Re-encode catalog videos: menos peso SIN bajar calidad visible.
# - CRF 26 + preset veryslow: mismo nivel de calidad objetivo que "fast", pero
#   archivos a menudo más pequeños (mejor reparto de bits). Mejor que volver a subir CRF.
# - tune film = vídeo real (no animación)
# Uso: bash web/scripts/compress-web-videos.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

compress_one() {
  local in="$1"
  [[ -f "$in" ]] || { echo "skip (missing): $in"; return 0; }
  local tmp="${in}.compressing.mp4"
  echo "==> $in"
  ffmpeg -y -hide_banner -loglevel warning -stats -i "$in" \
    -vf "scale='if(gt(iw\,1920)\,1920\,iw)':-2" \
    -c:v libx264 -profile:v high -pix_fmt yuv420p \
    -crf 26 \
    -preset veryslow \
    -tune film \
    -c:a aac -b:a 160k \
    -movflags +faststart \
    "$tmp"
  mv "$tmp" "$in"
  ls -lh "$in"
}

compress_one "web/assets/hora-loca/hora-loca-cubana.mp4"
compress_one "web/assets/hora-loca/hora-loca-character.mp4"
compress_one "web/assets/furniture-decor/backdrops.mp4"
compress_one "web/assets/furniture-decor/tables.mp4"
compress_one "web/assets/hora-loca/hora-loca-hadas.mp4"

echo "Done."
