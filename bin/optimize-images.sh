#!/usr/bin/env bash
# Génère les variantes d'images pour le développement local.
# Ne modifie PAS les originaux — les fichiers générés sont dans .gitignore.
# Usage : bash bin/optimize-images.sh
set -euo pipefail

COVER_DIR="assets/images/cover"
PHOTOS_DIR="assets/images/photos"
MAX_RES="5120x2880"   # plafond 5K — les originaux plus grands sont réduits avant encodage

check_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "$2" >&2; exit 1; }
}
check_cmd convert "ImageMagick introuvable. Installation : sudo apt-get install imagemagick"
check_cmd cwebp   "cwebp introuvable. Installation : sudo apt-get install webp"

count=0
skipped=0
resized=0

# Redimensionne l'original en place s'il dépasse MAX_RES ; sans effet sinon.
normalize_original() {
  local src="$1"
  local w h
  w=$(identify -format "%w" "$src")
  h=$(identify -format "%h" "$src")
  if [ "$w" -gt 5120 ] || [ "$h" -gt 2880 ]; then
    mogrify -resize "${MAX_RES}>" -quality 92 -strip "$src"
    echo "  ↓ $(basename "$src") réduit (${w}x${h} → 5K max)"
    ((resized++)) || true
  fi
}

# Covers : WebP pleine résolution uniquement, pas de miniature
for src in "$COVER_DIR"/*.jpg; do
  [ -f "$src" ] || continue
  normalize_original "$src"
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
while IFS= read -r src; do
  normalize_original "$src"
  base="${src%.jpg}"
  if [ -f "${base}.webp" ] && [ -f "${base}-thumb.jpg" ] && [ -f "${base}-thumb.webp" ] \
     && [ "${base}.webp" -nt "$src" ]; then
    ((skipped++)) || true
    continue
  fi
  convert "$src" -resize "1200x1200>" -quality 82 -strip "${base}-thumb.jpg"
  cwebp -q 80 "${base}-thumb.jpg" -o "${base}-thumb.webp" -quiet
  cwebp -q 82 "$src" -o "${base}.webp" -quiet

  echo "  ✓ $(basename "$src")"
  ((count++)) || true
done < <(find "$PHOTOS_DIR" -name "*.jpg" ! -name "*-thumb.jpg" | sort)

echo "Done — $count image(s) traitée(s), $resized original(aux) réduit(s), $skipped ignorée(s)."
