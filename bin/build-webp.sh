#!/usr/bin/env bash
# Génère les variantes WebP — miniatures + pleine résolution.
# À lancer avant le build de production.
# Usage : bash bin/build-webp.sh [--force]
set -euo pipefail

COVER_DIR="assets/images/cover"
PHOTOS_DIR="assets/images/photos"

[ -d "$PHOTOS_DIR" ] || { echo "Lancer depuis la racine du projet." >&2; exit 1; }

FORCE=false
for arg in "$@"; do [ "$arg" = "--force" ] && FORCE=true; done

check_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "$2" >&2; exit 1; }; }
check_cmd convert "ImageMagick introuvable. Installation : sudo apt-get install imagemagick"
check_cmd cwebp   "cwebp introuvable. Installation : sudo apt-get install webp"

count=0
skipped=0

# Covers : phone → WebP direct ; desktop → 1920 px (1×) + 3840 px max (2×)
for src in "$COVER_DIR"/*.jpg; do
  [ -f "$src" ] || continue
  base="${src%.jpg}"
  fname="$(basename "$base")"

  if [[ "$fname" == *_phone ]]; then
    if [ "$FORCE" = false ] && [ -f "${base}.webp" ] && [ "${base}.webp" -nt "$src" ]; then
      skipped=$((skipped + 1)); continue
    fi
    cwebp -q 82 "$src" -o "${base}.webp" -quiet
  else
    if [ "$FORCE" = false ] && [ -f "${base}.webp" ] && [ -f "${base}-2x.webp" ] \
       && [ "${base}.webp" -nt "$src" ]; then
      skipped=$((skipped + 1)); continue
    fi
    convert "$src" -resize "1920x>" -quality 82 -strip "${base}.webp"
    convert "$src" -resize "3840x>" -quality 82 -strip "${base}-2x.webp"
  fi
  echo "  ✓ $(basename "$src")"
  count=$((count + 1))
done

# Photos : miniature WebP + WebP pleine résolution
while IFS= read -r src; do
  base="${src%.jpg}"
  if [ "$FORCE" = false ] && [ -f "${base}.webp" ] && [ -f "${base}-thumb.webp" ] \
     && [ -f "${base}-thumb-2x.webp" ] && [ "${base}.webp" -nt "$src" ]; then
    skipped=$((skipped + 1))
    continue
  fi
  convert "$src" -resize "1200x1200>" -quality 82 -strip "${base}-thumb.webp"
  convert "$src" -resize "2400x2400>" -quality 82 -strip "${base}-thumb-2x.webp"
  cwebp -q 82 "$src" -o "${base}.webp" -quiet
  echo "  ✓ $(basename "$src")"
  count=$((count + 1))
done < <(find "$PHOTOS_DIR" -name "*.jpg" | sort)

echo "Done — $count image(s) traitée(s), $skipped ignorée(s)."
