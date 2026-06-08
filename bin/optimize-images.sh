#!/usr/bin/env bash
# Génère les variantes d'images pour le développement local.
# Ne modifie PAS les originaux — les fichiers générés sont dans .gitignore.
# Usage : bash bin/optimize-images.sh
set -euo pipefail

SRC_DIR="assets/images"

check_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "$2" >&2; exit 1; }
}
check_cmd convert "ImageMagick introuvable. Installation : sudo apt-get install imagemagick"
check_cmd cwebp   "cwebp introuvable. Installation : sudo apt-get install webp"

count=0
skipped=0

for src in "$SRC_DIR"/*.jpg; do
  [[ "$src" == *-thumb.jpg ]] && continue
  [ -f "$src" ] || continue

  base="${src%.jpg}"
  name="$(basename "$src")"

  if [[ "$name" == "cover.jpg" ]]; then
    # Cover : WebP pleine résolution uniquement, pas de miniature
    if [ -f "${base}.webp" ] && [ "${base}.webp" -nt "$src" ]; then
      ((skipped++)) || true
      continue
    fi
    cwebp -q 82 "$src" -o "${base}.webp" -quiet
  else
    # Photos standard : miniature JPEG + miniature WebP + WebP pleine résolution
    if [ -f "${base}.webp" ] && [ -f "${base}-thumb.jpg" ] && [ -f "${base}-thumb.webp" ] \
       && [ "${base}.webp" -nt "$src" ]; then
      ((skipped++)) || true
      continue
    fi
    convert "$src" -resize "800x800>" -quality 82 -strip "${base}-thumb.jpg"
    cwebp -q 80 "${base}-thumb.jpg" -o "${base}-thumb.webp" -quiet
    cwebp -q 82 "$src" -o "${base}.webp" -quiet
  fi

  echo "  ✓ $name"
  ((count++)) || true
done

echo "Done — $count image(s) traitée(s), $skipped ignorée(s)."
