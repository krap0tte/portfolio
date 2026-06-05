#!/usr/bin/env bash
# Génère les variantes d'images pour le développement local.
# Ne modifie PAS les originaux — les fichiers générés sont dans .gitignore.
# Usage : bash bin/optimize-images.sh
set -euo pipefail

command -v convert >/dev/null 2>&1 || {
  echo "ImageMagick introuvable. Installation : sudo apt-get install imagemagick" >&2; exit 1
}
command -v cwebp >/dev/null 2>&1 || {
  echo "cwebp introuvable. Installation : sudo apt-get install webp" >&2; exit 1
}

count=0
for src in assets/images/*.jpg; do
  [[ "$src" == *-thumb.jpg ]] && continue
  [ -f "$src" ] || continue
  base="${src%.jpg}"
  convert "$src" -resize "800x800>" -quality 82 -strip "${base}-thumb.jpg"
  cwebp -q 80 "${base}-thumb.jpg" -o "${base}-thumb.webp" -quiet
  cwebp -q 82 "$src" -o "${base}.webp" -quiet
  echo "  ✓ $(basename "$src")"
  ((count++)) || true
done

echo "Done — $count image(s) traitée(s)."
