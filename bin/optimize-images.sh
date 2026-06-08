#!/usr/bin/env bash
# Génère les variantes d'images pour le développement local.
# Ne modifie PAS les originaux — les fichiers générés sont dans .gitignore.
# Usage : bash bin/optimize-images.sh
set -euo pipefail

COVER_DIR="assets/images/cover"
PHOTOS_DIR="assets/images/photos"

check_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "$2" >&2; exit 1; }
}
check_cmd convert "ImageMagick introuvable. Installation : sudo apt-get install imagemagick"
check_cmd cwebp   "cwebp introuvable. Installation : sudo apt-get install webp"

count=0
skipped=0

# Covers : WebP pleine résolution uniquement, pas de miniature
for src in "$COVER_DIR"/*.jpg; do
  [ -f "$src" ] || continue
  base="${src%.jpg}"
  if [ -f "${base}.webp" ] && [ "${base}.webp" -nt "$src" ]; then
    ((skipped++)) || true
    continue
  fi
  cwebp -q 82 "$src" -o "${base}.webp" -quiet
  echo "  ✓ $(basename "$src")"
  ((count++)) || true
done

# Photos de galerie : miniature JPEG + miniature WebP + WebP pleine résolution
for src in "$PHOTOS_DIR"/**/*.jpg; do
  [[ "$src" == *-thumb.jpg ]] && continue
  [ -f "$src" ] || continue

  base="${src%.jpg}"
  if [ -f "${base}.webp" ] && [ -f "${base}-thumb.jpg" ] && [ -f "${base}-thumb.webp" ] \
     && [ "${base}.webp" -nt "$src" ]; then
    ((skipped++)) || true
    continue
  fi
  convert "$src" -resize "800x800>" -quality 82 -strip "${base}-thumb.jpg"
  cwebp -q 80 "${base}-thumb.jpg" -o "${base}-thumb.webp" -quiet
  cwebp -q 82 "$src" -o "${base}.webp" -quiet

  echo "  ✓ $(basename "$src")"
  ((count++)) || true
done

echo "Done — $count image(s) traitée(s), $skipped ignorée(s)."
