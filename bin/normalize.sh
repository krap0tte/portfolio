#!/usr/bin/env bash
# Redimensionne les originaux JPEG dépassant 4K en place.
# Usage : bash bin/normalize.sh
set -euo pipefail

COVER_DIR="assets/images/cover"
PHOTOS_DIR="assets/images/photos"
MAX_RES="3840x2160"
MAX_W="${MAX_RES%x*}"
MAX_H="${MAX_RES#*x}"

check_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "$2" >&2; exit 1; }; }
check_cmd mogrify "ImageMagick introuvable. Installation : sudo apt-get install imagemagick"

resized=0

normalize() {
  local src="$1" w h
  w=$(identify -format "%w" "$src")
  h=$(identify -format "%h" "$src")
  if [ "$w" -gt "$MAX_W" ] || [ "$h" -gt "$MAX_H" ]; then
    mogrify -resize "${MAX_RES}>" -quality 92 -strip "$src"
    echo "  ↓ $(basename "$src") réduit (${w}x${h} → ${MAX_RES})"
    resized=$((resized + 1))
  fi
}

for src in "$COVER_DIR"/*.jpg; do [ -f "$src" ] && normalize "$src"; done
while IFS= read -r src; do normalize "$src"; done < <(find "$PHOTOS_DIR" -name "*.jpg" | sort)

echo "Done — $resized original(aux) réduit(s)."
