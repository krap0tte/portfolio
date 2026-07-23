#!/usr/bin/env bash
# add-photo.sh — outil auteur (jamais servi au visiteur, hors déploiement).
#
# Synchronise static/assets/images/photos/<catégorie>/ avec data/photos.toml :
# un sous-dossier de photos/ = une catégorie, appariée par nom à un fichier
# content/categories/<nom>.md (nom machine + libellé). Déposer une photo dans
# le bon sous-dossier suffit à la catégoriser — aucune métadonnée par photo.
#
#   1. Toute image NON-webp déposée dans un sous-dossier est convertie en WebP
#      (cwebp -q 82 -m 6, EXIF retiré, réduite à 4000 px sur le plus grand côté),
#      puis la source est SUPPRIMÉE.
#   2. Chaque WebP présent est vérifié : s'il dépasse 4000 px il est ré-encodé
#      réduit (un WebP compressé ne peut être redimensionné sans ré-encodage).
#   3. data/photos.toml est intégralement régénéré depuis les sous-dossiers
#      présents ; on signale s'il était déjà à jour ou s'il a été mis à jour.
#
# Idempotent : relancé sans nouveau fichier ni WebP hors-format, il ne change rien.
# Usage : bin/add-photo.sh   (aucun argument — dépose tes images dans le sous-dossier
#                              de la catégorie concernée, sous photos/)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PHOTOS_DIR="$ROOT/static/assets/images/photos"
CATEGORIES_DIR="$ROOT/content/categories"
DATA_FILE="$ROOT/data/photos.toml"
MAX=4000  # côté le plus long, en pixels.

command -v cwebp    >/dev/null || { echo "cwebp introuvable (ex. : apt install webp)"; exit 1; }
command -v webpinfo >/dev/null || { echo "webpinfo introuvable (ex. : apt install webp)"; exit 1; }
mkdir -p "$PHOTOS_DIR" "$(dirname "$DATA_FILE")"

# « W H » à passer à cwebp -resize si (w,h) dépasse MAX (retour 1 sinon).
# Plus grand côté ramené à MAX (0 = calculé, ratio préservé) ; jamais d'agrandissement.
resize_args() {
  local w=$1 h=$2
  { [ "$w" -gt "$MAX" ] || [ "$h" -gt "$MAX" ]; } || return 1
  if [ "$w" -ge "$h" ]; then echo "$MAX 0"; else echo "0 $MAX"; fi
}

# ─── 0. Sous-dossiers présents = catégories candidates ; chacun doit avoir
#        son fichier content/categories/<nom>.md (nom machine + libellé). ────
missing=()
for dir in "$PHOTOS_DIR"/*/; do
  [ -d "$dir" ] || continue
  cat="$(basename "$dir")"
  [ -f "$CATEGORIES_DIR/$cat.md" ] || missing+=("$cat")
done
if [ "${#missing[@]}" -gt 0 ]; then
  echo "Catégorie(s) sans fichier content/categories/<nom>.md :"
  for cat in "${missing[@]}"; do echo "  - $cat (attendu : content/categories/$cat.md)"; done
  echo "Créer le(s) fichier(s) de catégorie avant de synchroniser ses photos."
  exit 1
fi

# ─── 1. Sources non-webp : convertir (EXIF retiré, ≤ MAX) puis supprimer ──────
shopt -s nullglob nocaseglob
for dir in "$PHOTOS_DIR"/*/; do
  [ -d "$dir" ] || continue
  for src in "$dir"*.{jpg,jpeg,png,tif,tiff}; do
    name="$(basename "${src%.*}")"
    out="$dir$name.webp"

    dims="$(cwebp -q 1 -m 0 "$src" -o /dev/null 2>&1 \
            | sed -n 's/.*Dimension: \([0-9]*\) x \([0-9]*\).*/\1 \2/p')" || dims=""
    w="${dims% *}"; h="${dims#* }"

    args=(-q 82 -m 6 -metadata none)
    note=""
    if [ -n "$w" ] && ra="$(resize_args "$w" "$h")"; then
      args+=(-resize $ra); note=" (réduit de ${w}x${h} → ${MAX}px)"
    fi

    if cwebp "${args[@]}" "$src" -o "$out" >/dev/null 2>&1 && [ -s "$out" ]; then
      rm -f "$src"
      echo "converti : $(basename "$dir")/$name.webp$note — source supprimée"
    else
      echo "ÉCHEC    : $(basename "$src") — source conservée"
    fi
  done
done
shopt -u nullglob nocaseglob

# ─── 2. WebP présents : réduire ceux qui dépassent MAX (ré-encodage requis) ───
for dir in "$PHOTOS_DIR"/*/; do
  [ -d "$dir" ] || continue
  for wf in "$dir"*.webp; do
    [ -e "$wf" ] || continue
    w="$(webpinfo "$wf" 2>/dev/null | sed -n 's/.*Width: *\([0-9]*\).*/\1/p'  | head -1)"
    h="$(webpinfo "$wf" 2>/dev/null | sed -n 's/.*Height: *\([0-9]*\).*/\1/p' | head -1)"
    { [ -n "$w" ] && ra="$(resize_args "$w" "$h")"; } || continue
    tmp="$(mktemp "$dir.resize.XXXXXX")"
    if cwebp -q 82 -m 6 -metadata none -resize $ra "$wf" -o "$tmp" >/dev/null 2>&1 && [ -s "$tmp" ]; then
      mv "$tmp" "$wf"
      echo "réduit   : $(basename "$dir")/$(basename "$wf") (de ${w}x${h} → ${MAX}px)"
    else
      rm -f "$tmp"
      echo "ÉCHEC    : $(basename "$wf") — inchangé"
    fi
  done
done

# ─── 3. Régénérer data/photos.toml depuis les WebP présents ──────────────────
cats=()
for dir in "$PHOTOS_DIR"/*/; do
  [ -d "$dir" ] || continue
  cats+=("$(basename "$dir")")
done
[ "${#cats[@]}" -gt 0 ] || { echo "aucune catégorie dans $PHOTOS_DIR"; exit 1; }
IFS=$'\n' cats=($(sort <<<"${cats[*]}")); unset IFS

tmp="$(mktemp)"
{
  echo "# Régénéré par bin/add-photo.sh — ne pas éditer à la main."
  echo

  # « nom<TAB>catégorie », trié par nom de fichier seul (comme l'ancien
  # FILES.sort()) — pas groupé par catégorie, sinon l'ordre chronologique
  # global se casse dès que deux catégories ont des dates entremêlées.
  entries=()
  for cat in "${cats[@]}"; do
    shopt -s nullglob
    files=("$PHOTOS_DIR/$cat"/*.webp)
    shopt -u nullglob
    for f in "${files[@]}"; do
      entries+=("$(basename "${f%.webp}")"$'\t'"$cat")
    done
  done
  IFS=$'\n' entries=($(sort <<<"${entries[*]}")); unset IFS

  echo "all = ["
  first=1
  for entry in "${entries[@]}"; do
    name="${entry%%$'\t'*}"; cat="${entry#*$'\t'}"
    [ "$first" -eq 1 ] || echo ","
    first=0
    printf '  { slug = "%s", file = "%s" }' "$cat" "$name"
  done
  [ "$first" -eq 1 ] || echo
  echo "]"
  echo

  for cat in "${cats[@]}"; do
    shopt -s nullglob
    files=("$PHOTOS_DIR/$cat"/*.webp)
    shopt -u nullglob
    names=()
    for f in "${files[@]}"; do names+=("$(basename "${f%.webp}")"); done
    IFS=$'\n' names=($(sort <<<"${names[*]}")); unset IFS

    echo "[[categories]]"
    echo "slug = \"$cat\""
    echo "photos = ["
    n=${#names[@]}; i=0
    for name in "${names[@]}"; do
      i=$((i + 1))
      [ "$i" -lt "$n" ] && echo "  \"$name\"," || echo "  \"$name\""
    done
    echo "]"
    echo
  done
} > "$tmp"

if [ -f "$DATA_FILE" ] && diff -q "$tmp" "$DATA_FILE" >/dev/null 2>&1; then
  rm -f "$tmp"
  echo "data/photos.toml déjà à jour."
else
  mv "$tmp" "$DATA_FILE"
  echo "data/photos.toml mis à jour."
fi
