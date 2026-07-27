#!/usr/bin/env bash
# add-photo.sh — outil auteur (jamais servi au visiteur, hors déploiement).
#
# Synchronise static/assets/images/photos/ avec data/photos.toml. Le site n'a
# qu'un seul type de contenu, la SÉRIE, matérialisée par un dossier de photos et
# le fichier de contenu apparié :
#
#   photos/<slug>/  ↔  content/<slug>.md
#
# Déposer une photo dans le bon dossier suffit à la classer — aucune métadonnée
# par photo. Une série porte un texte d'intro (corps du .md) et une couverture
# pleine fenêtre (`[extra] hero`), vérifiée ici.
#
# Deux champs ont disparu des contrôles : la couverture d'accueil du site
# (`config.extra.hero`, hors de photos/), que ce script convertissait et
# exigeait, et le `cover` de série (vignette recadrée en 3/2). L'accueil affiche
# désormais la série la plus récente et plus aucune vignette n'existe : il ne
# reste qu'un champ image par série, et plus rien à convertir hors de photos/.
#
#   1. Toute image NON-webp déposée dans un dossier de série est convertie en
#      WebP (cwebp -q 82 -m 6, EXIF retiré), puis la source est SUPPRIMÉE. La
#      photo garde sa résolution d'origine : c'est elle que sert la lightbox.
#   2. Les miniatures sont (re)générées — délégué à bin/build-thumbs.sh, que le
#      déploiement lance aussi : elles sont dérivées et non versionnées.
#   3. data/photos.toml est intégralement régénéré depuis les dossiers présents ;
#      on signale s'il était déjà à jour ou s'il a été mis à jour.
#
# Idempotent : relancé sans nouveau fichier, il ne change rien.
# Usage : bin/add-photo.sh   (aucun argument — dépose tes images dans le dossier
#                              de la série concernée)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PHOTOS_DIR="$ROOT/static/assets/images/photos"
CONTENT_DIR="$ROOT/content"
DATA_FILE="$ROOT/data/photos.toml"

command -v cwebp    >/dev/null || { echo "cwebp introuvable (ex. : apt install webp)"; exit 1; }
mkdir -p "$PHOTOS_DIR" "$(dirname "$DATA_FILE")"

# ─── 0. Inventaire des séries présentes ──────────────────────────────────────
#        Un dossier de premier niveau = une série. Le sous-dossier thumbs/ est
#        hors d'atteinte : il est d'un niveau plus bas.
slugs=()
for dir in "$PHOTOS_DIR"/*/; do
  [ -d "$dir" ] || continue
  slugs+=("$(basename "$dir")")
done
[ "${#slugs[@]}" -gt 0 ] || { echo "aucune série dans $PHOTOS_DIR"; exit 1; }

# Convertit <src> en WebP <out> (EXIF retiré, résolution d'origine conservée)
# puis supprime la source. En cas d'échec, la source est conservée.
convert_source() {  # <src> <out> <étiquette>
  local src=$1 out=$2 label=$3
  if cwebp -q 82 -m 6 -metadata none "$src" -o "$out" >/dev/null 2>&1 && [ -s "$out" ]; then
    rm -f "$src"
    echo "converti : $label — source supprimée"
  else
    echo "ÉCHEC    : ${src##*/} — source conservée"
  fi
}

# ─── 1. Sources non-webp : convertir (EXIF retiré) puis supprimer ─────────────
#        DOIT précéder les contrôles de l'étape 2 : ceux-ci exigent des `.webp`
#        et c'est cette étape qui les produit. Dans l'ordre inverse, le flux
#        documenté (créer le .md, déposer des JPG, lancer le script) échouait
#        systématiquement sur une couverture « introuvable » que la conversion
#        allait créer juste après — impasse dont on ne sortait qu'à la main.
shopt -s nullglob nocaseglob
for slug in "${slugs[@]}"; do
  dir="$PHOTOS_DIR/$slug/"
  for src in "$dir"*.{jpg,jpeg,png,tif,tiff}; do
    name="${src##*/}"; name="${name%.*}"
    convert_source "$src" "$dir$name.webp" "$slug/$name.webp"
  done
done
shopt -u nullglob nocaseglob

# ─── 2. Appariement contenu ↔ photos, vérifié DANS LES DEUX SENS. Chaque série
#        a son content/<slug>.md et l'image que celui-ci désigne : `hero`, sa
#        couverture pleine fenêtre (cadrage paysage attendu). ─────────────────
missing=()

# Vérifie qu'un champ de front matter désigne bien un WebP présent dans le
# dossier de la série. Alimente `missing`.
check_photo_field() {  # <fichier md> <champ> <slug>
  local md=$1 field=$2 slug=$3 val
  val="$(sed -n "s/^$field *= *\"\(.*\)\"\$/\1/p" "$md" | head -1)"
  if [ -z "$val" ]; then
    missing+=("$slug (attendu : $field = \"…\" sous [extra] dans content/$slug.md)")
  elif [ ! -f "$PHOTOS_DIR/$slug/$val.webp" ]; then
    missing+=("$slug ($field introuvable : photos/$slug/$val.webp)")
  fi
}

# Sens 1 : un dossier de photos sans fichier de contenu apparié. Attrape au
# passage un reliquat de l'ancienne arborescence à deux niveaux (un dossier
# `series/` ou `categories/` resté d'un ancien clone) : il serait pris pour une
# série et signalé comme dépourvue de contenu.
for slug in "${slugs[@]}"; do
  md="$CONTENT_DIR/$slug.md"
  if [ ! -f "$md" ]; then
    missing+=("$slug (attendu : content/$slug.md)")
    continue
  fi
  check_photo_field "$md" hero "$slug"
done

# Sens 2 : un fichier de contenu sans dossier de photos. Son `hero` ne désigne
# alors aucune image et la page s'affiche amputée — c'est ce sens-là qui
# manquait, d'où un renommage à moitié fait resté silencieux.
shopt -s nullglob
for md in "$CONTENT_DIR"/*.md; do
  slug="${md##*/}"; slug="${slug%.md}"
  # _index.md est la section racine (l'accueil), pas une série.
  if [ "$slug" = "_index" ]; then continue; fi
  if [ ! -d "$PHOTOS_DIR/$slug" ]; then
    missing+=("$slug (dossier de photos absent : photos/$slug/)")
  fi
done
shopt -u nullglob

if [ "${#missing[@]}" -gt 0 ]; then
  echo "Contenu mal apparié :"
  for m in "${missing[@]}"; do echo "  - $m"; done
  echo "Créer/corriger le(s) fichier(s) de contenu avant de synchroniser les photos."
  exit 1
fi

# ─── 3. Miniatures — délégué à bin/build-thumbs.sh, que le déploiement lance
#        aussi de son côté (les miniatures sont dérivées et non versionnées).
#        Une seule implémentation, deux appelants. ──────────────────────────────
"$ROOT/bin/build-thumbs.sh"

# ─── 4. Régénérer data/photos.toml depuis les WebP présents ──────────────────
#        Un seul type d'entrée désormais : un bloc [[series]] par dossier. La
#        liste plate `all` (toutes photos, tous classements confondus) a disparu
#        avec le second axe — elle n'était plus lue par aucun template.
IFS=$'\n' slugs=($(sort <<<"${slugs[*]}")); unset IFS

# Noms (sans extension) des photos du dossier <slug>, triés, un par ligne.
# Écrit sur la sortie standard plutôt que dans une globale : l'appelant décide
# où atterrit le résultat (`mapfile`), la fonction n'a pas d'effet de bord.
# Le sous-dossier thumbs/ est hors d'atteinte : un glob ne descend pas.
photos_of() {  # <slug>
  shopt -s nullglob
  local f
  for f in "$PHOTOS_DIR/$1"/*.webp; do f="${f##*/}"; echo "${f%.webp}"; done | sort
  shopt -u nullglob
}

tmp="$(mktemp)"
{
  echo "# Régénéré par bin/add-photo.sh — ne pas éditer à la main."
  echo

  for slug in "${slugs[@]}"; do
    mapfile -t names < <(photos_of "$slug")

    echo "[[series]]"
    echo "slug = \"$slug\""
    # Nom de fichier le plus récent du dossier (les noms sont datés) : seule
    # source d'ordre chronologique du modèle, qui ne porte aucune date.
    # L'accueil s'en sert pour classer les séries de la plus récente à la plus ancienne.
    echo "latest = \"${names[-1]}\""
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
