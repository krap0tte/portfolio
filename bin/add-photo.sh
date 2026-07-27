#!/usr/bin/env bash
# add-photo.sh — outil auteur (jamais servi au visiteur, hors déploiement).
#
# Synchronise static/assets/images/photos/ avec data/photos.toml. Les photos sont
# classées sur DEUX AXES INDÉPENDANTS, matérialisés par les deux dossiers de
# premier niveau — une photo appartient à l'un ou à l'autre, jamais aux deux :
#
#   photos/categories/<slug>/  → un bac thématique, apparié à content/categories/<slug>.md
#   photos/series/<slug>/      → un corpus éditorial,  apparié à content/series/<slug>.md
#
# Déposer une photo dans le bon sous-dossier suffit à la classer — aucune
# métadonnée par photo. Une série porte en plus un texte d'intro (corps du .md)
# et une photo de couverture (front matter `[extra] cover`), vérifiée ici.
#
#   1. Toute image NON-webp déposée dans un sous-dossier est convertie en WebP
#      (cwebp -q 82 -m 6, EXIF retiré), puis la source est SUPPRIMÉE. La photo
#      est conservée à sa résolution d'origine : c'est elle que sert la lightbox.
#   2. Les miniatures sont (re)générées — délégué à bin/build-thumbs.sh, que le
#      déploiement lance aussi : elles sont dérivées et non versionnées.
#   3. data/photos.toml est intégralement régénéré depuis les sous-dossiers
#      présents ; on signale s'il était déjà à jour ou s'il a été mis à jour.
#
# Idempotent : relancé sans nouveau fichier, il ne change rien.
# Usage : bin/add-photo.sh   (aucun argument — dépose tes images dans le sous-dossier
#                              de la catégorie ou de la série concernée)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PHOTOS_DIR="$ROOT/static/assets/images/photos"
CONTENT_DIR="$ROOT/content"
DATA_FILE="$ROOT/data/photos.toml"
KINDS=(categories series)

command -v cwebp    >/dev/null || { echo "cwebp introuvable (ex. : apt install webp)"; exit 1; }
mkdir -p "${KINDS[@]/#/$PHOTOS_DIR/}" "$(dirname "$DATA_FILE")"

# ─── 0. Inventaire des dossiers présents, sous forme « axe<TAB>slug ». ────────
#        Tout dossier de premier niveau hors des deux axes est une erreur
#        (typiquement un reliquat de l'ancienne arborescence à un seul niveau).
stray=()
for dir in "$PHOTOS_DIR"/*/; do
  [ -d "$dir" ] || continue
  name="$(basename "$dir")"
  [[ " ${KINDS[*]} " == *" $name "* ]] || stray+=("$name")
done
if [ "${#stray[@]}" -gt 0 ]; then
  echo "Dossier(s) hors des deux axes dans $PHOTOS_DIR :"
  for name in "${stray[@]}"; do echo "  - $name"; done
  echo "Attendu : photos/categories/<slug>/ ou photos/series/<slug>/."
  exit 1
fi

pairs=()
for kind in "${KINDS[@]}"; do
  for dir in "$PHOTOS_DIR/$kind"/*/; do
    [ -d "$dir" ] || continue
    pairs+=("$kind"$'\t'"$(basename "$dir")")
  done
done
[ "${#pairs[@]}" -gt 0 ] || { echo "aucune catégorie ni série dans $PHOTOS_DIR"; exit 1; }

# La couverture d'accueil vit dans config.toml et pointe sous static/ (elle peut
# venir de n'importe quel classement), pas dans un dossier de photos.
site_hero="$(sed -n 's/^hero *= *"\(.*\)"$/\1/p' "$ROOT/config.toml" | head -1)"
HERO_FILE=""
if [ -n "$site_hero" ]; then HERO_FILE="$ROOT/static/$site_hero"; fi

# Convertit <src> en WebP <out> (EXIF retiré, résolution d'origine conservée)
# puis supprime la source. En cas d'échec, la source est conservée. Mutualisé
# entre les dossiers de photos et le hero de l'accueil (qui vit hors de photos/
# mais suit la même règle).
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
for pair in "${pairs[@]}"; do
  dir="$PHOTOS_DIR/${pair%%$'\t'*}/${pair#*$'\t'}/"
  for src in "$dir"*.{jpg,jpeg,png,tif,tiff}; do
    name="${src##*/}"; name="${name%.*}"
    convert_source "$src" "$dir$name.webp" "${pair/$'\t'//}/$name.webp"
  done
done
# Le hero suit la même règle : une source déposée à côté de lui (même nom, autre
# extension) le remplace. Le glob porte sur le DOSSIER — un motif sans
# métacaractère (`"$base".jpg`) échappe entièrement à l'expansion de chemins,
# donc à `nullglob` comme à `nocaseglob`, et serait passé littéralement.
if [ -n "$HERO_FILE" ]; then
  hero_base="${HERO_FILE##*/}"; hero_base="${hero_base%.*}"
  for src in "${HERO_FILE%/*}"/*.{jpg,jpeg,png,tif,tiff}; do
    name="${src##*/}"; name="${name%.*}"
    if [ "$name" = "$hero_base" ]; then convert_source "$src" "$HERO_FILE" "$site_hero"; fi
  done
fi
shopt -u nullglob nocaseglob

# ─── 2. Appariement contenu ↔ photos, vérifié DANS LES DEUX SENS. Chaque
#        classement a son fichier content/<axe>/<slug>.md et les images que
#        celui-ci désigne : `cover` = vignette de carte (recadrée en 3/2),
#        `hero` = couverture pleine fenêtre. Les catégories n'ont que des
#        cartes, les séries ont aussi une page à couverture. ──────────────────
missing=()

# Vérifie qu'un champ de front matter désigne bien un WebP présent dans le
# dossier du classement. Alimente `missing`.
check_photo_field() {  # <fichier md> <champ> <axe> <slug>
  local md=$1 field=$2 kind=$3 slug=$4 val
  val="$(sed -n "s/^$field *= *\"\(.*\)\"\$/\1/p" "$md" | head -1)"
  if [ -z "$val" ]; then
    missing+=("$kind/$slug (attendu : $field = \"…\" sous [extra] dans content/$kind/$slug.md)")
  elif [ ! -f "$PHOTOS_DIR/$kind/$slug/$val.webp" ]; then
    missing+=("$kind/$slug ($field introuvable : photos/$kind/$slug/$val.webp)")
  fi
}

# Sens 1 : un dossier de photos sans fichier de contenu apparié.
for pair in "${pairs[@]}"; do
  kind="${pair%%$'\t'*}"; slug="${pair#*$'\t'}"
  md="$CONTENT_DIR/$kind/$slug.md"
  if [ ! -f "$md" ]; then
    missing+=("$kind/$slug (attendu : content/$kind/$slug.md)")
    continue
  fi
  check_photo_field "$md" cover "$kind" "$slug"
  if [ "$kind" = series ]; then check_photo_field "$md" hero "$kind" "$slug"; fi
done

# Sens 2 : un fichier de contenu sans dossier de photos. Son `cover` et son
# `hero` ne désignent alors aucune image et la page s'affiche amputée — c'est
# ce sens-là qui manquait, d'où un renommage à moitié fait resté silencieux.
shopt -s nullglob
for kind in "${KINDS[@]}"; do
  for md in "$CONTENT_DIR/$kind"/*.md; do
    slug="${md##*/}"; slug="${slug%.md}"
    if [ "$slug" = "_index" ]; then continue; fi
    if [ ! -d "$PHOTOS_DIR/$kind/$slug" ]; then
      missing+=("$kind/$slug (dossier de photos absent : photos/$kind/$slug/)")
    fi
  done
done
shopt -u nullglob

if [ -z "$site_hero" ]; then
  missing+=("config.toml (attendu : hero = \"…\" sous [extra])")
elif [ ! -f "$HERO_FILE" ]; then
  missing+=("config.toml (couverture d'accueil introuvable : static/$site_hero)")
fi

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
IFS=$'\n' pairs=($(sort <<<"${pairs[*]}")); unset IFS

# Noms (sans extension) des photos du dossier <axe>/<slug>, triés, un par ligne.
# Écrit sur la sortie standard plutôt que dans une globale : l'appelant décide
# où atterrit le résultat (`mapfile`), la fonction n'a pas d'effet de bord.
# Le sous-dossier thumbs/ est hors d'atteinte : un glob ne descend pas.
photos_of() {  # <axe> <slug>
  shopt -s nullglob
  local f
  for f in "$PHOTOS_DIR/$1/$2"/*.webp; do f="${f##*/}"; echo "${f%.webp}"; done | sort
  shopt -u nullglob
}

tmp="$(mktemp)"
{
  echo "# Régénéré par bin/add-photo.sh — ne pas éditer à la main."
  echo

  # « nom<TAB>axe<TAB>slug », trié par nom de fichier seul (comme l'ancien
  # FILES.sort()) — pas groupé par dossier, sinon l'ordre chronologique
  # global se casse dès que deux dossiers ont des dates entremêlées.
  entries=()
  for pair in "${pairs[@]}"; do
    kind="${pair%%$'\t'*}"; slug="${pair#*$'\t'}"
    mapfile -t names < <(photos_of "$kind" "$slug")
    for name in "${names[@]}"; do entries+=("$name"$'\t'"$kind"$'\t'"$slug"); done
  done
  IFS=$'\n' entries=($(sort <<<"${entries[*]}")); unset IFS

  echo "all = ["
  first=1
  for entry in "${entries[@]}"; do
    name="${entry%%$'\t'*}"; rest="${entry#*$'\t'}"
    kind="${rest%%$'\t'*}"; slug="${rest#*$'\t'}"
    [ "$first" -eq 1 ] || echo ","
    first=0
    printf '  { kind = "%s", slug = "%s", file = "%s" }' "$kind" "$slug" "$name"
  done
  [ "$first" -eq 1 ] || echo
  echo "]"
  echo

  for pair in "${pairs[@]}"; do
    kind="${pair%%$'\t'*}"; slug="${pair#*$'\t'}"
    mapfile -t names < <(photos_of "$kind" "$slug")

    echo "[[$kind]]"
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
