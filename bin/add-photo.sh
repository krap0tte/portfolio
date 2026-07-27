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
#      (cwebp -q 82 -m 6, EXIF retiré, réduite à 4000 px sur le plus grand côté),
#      puis la source est SUPPRIMÉE.
#   2. Chaque WebP présent est vérifié : s'il dépasse 4000 px il est ré-encodé
#      réduit (un WebP compressé ne peut être redimensionné sans ré-encodage).
#   3. data/photos.toml est intégralement régénéré depuis les sous-dossiers
#      présents ; on signale s'il était déjà à jour ou s'il a été mis à jour.
#
# Idempotent : relancé sans nouveau fichier ni WebP hors-format, il ne change rien.
# Usage : bin/add-photo.sh   (aucun argument — dépose tes images dans le sous-dossier
#                              de la catégorie ou de la série concernée)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PHOTOS_DIR="$ROOT/static/assets/images/photos"
CONTENT_DIR="$ROOT/content"
DATA_FILE="$ROOT/data/photos.toml"
KINDS=(categories series)
MAX=4000  # côté le plus long, en pixels.

command -v cwebp    >/dev/null || { echo "cwebp introuvable (ex. : apt install webp)"; exit 1; }
command -v webpinfo >/dev/null || { echo "webpinfo introuvable (ex. : apt install webp)"; exit 1; }
mkdir -p "${KINDS[@]/#/$PHOTOS_DIR/}" "$(dirname "$DATA_FILE")"

# « W H » à passer à cwebp -resize si (w,h) dépasse MAX (retour 1 sinon).
# Plus grand côté ramené à MAX (0 = calculé, ratio préservé) ; jamais d'agrandissement.
resize_args() {
  local w=$1 h=$2
  { [ "$w" -gt "$MAX" ] || [ "$h" -gt "$MAX" ]; } || return 1
  if [ "$w" -ge "$h" ]; then echo "$MAX 0"; else echo "0 $MAX"; fi
}

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

# ─── 0 bis. Chaque dossier doit avoir son fichier content/<axe>/<slug>.md et
#            les photos que celui-ci désigne. Deux usages distincts, donc deux
#            champs indépendants : `cover` = vignette de carte (recadrée en 3/2),
#            `hero` = couverture pleine fenêtre (cadrage paysage attendu). Les
#            catégories n'ont que des cartes, les séries ont aussi une page à
#            couverture, d'où `hero` réservé aux séries. ────────────────────────
missing=()

# Vérifie qu'un champ de front matter désigne bien un WebP présent dans le
# dossier du classement. Alimente `missing`.
check_photo_field() {  # <fichier md> <champ> <axe> <slug>
  local val
  val="$(sed -n "s/^$2 *= *\"\(.*\)\"\$/\1/p" "$1" | head -1)"
  if [ -z "$val" ]; then
    missing+=("$3/$4 (attendu : $2 = \"…\" sous [extra] dans content/$3/$4.md)")
  elif [ ! -f "$PHOTOS_DIR/$3/$4/$val.webp" ]; then
    missing+=("$3/$4 ($2 introuvable : photos/$3/$4/$val.webp)")
  fi
}

for pair in "${pairs[@]}"; do
  kind="${pair%%$'\t'*}"; slug="${pair#*$'\t'}"
  md="$CONTENT_DIR/$kind/$slug.md"
  if [ ! -f "$md" ]; then
    missing+=("$kind/$slug (attendu : content/$kind/$slug.md)")
    continue
  fi
  check_photo_field "$md" cover "$kind" "$slug"
  [ "$kind" = series ] && check_photo_field "$md" hero "$kind" "$slug"
done

# La couverture d'accueil vit dans config.toml et pointe sous static/ (elle peut
# venir de n'importe quel classement), pas dans un dossier de photos.
site_hero="$(sed -n 's/^hero *= *"\(.*\)"$/\1/p' "$ROOT/config.toml" | head -1)"
if [ -z "$site_hero" ]; then
  missing+=("config.toml (attendu : hero = \"…\" sous [extra])")
elif [ ! -f "$ROOT/static/$site_hero" ]; then
  missing+=("config.toml (couverture d'accueil introuvable : static/$site_hero)")
fi

if [ "${#missing[@]}" -gt 0 ]; then
  echo "Contenu mal apparié :"
  for m in "${missing[@]}"; do echo "  - $m"; done
  echo "Créer/corriger le(s) fichier(s) de contenu avant de synchroniser les photos."
  exit 1
fi

# ─── 1. Sources non-webp : convertir (EXIF retiré, ≤ MAX) puis supprimer ──────
shopt -s nullglob nocaseglob
for pair in "${pairs[@]}"; do
  dir="$PHOTOS_DIR/${pair%%$'\t'*}/${pair#*$'\t'}/"
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
      echo "converti : ${pair/$'\t'//}/$name.webp$note — source supprimée"
    else
      echo "ÉCHEC    : $(basename "$src") — source conservée"
    fi
  done
done
shopt -u nullglob nocaseglob

# ─── 2. WebP présents : réduire ceux qui dépassent MAX (ré-encodage requis) ───
for pair in "${pairs[@]}"; do
  dir="$PHOTOS_DIR/${pair%%$'\t'*}/${pair#*$'\t'}/"
  for wf in "$dir"*.webp; do
    [ -e "$wf" ] || continue
    w="$(webpinfo "$wf" 2>/dev/null | sed -n 's/.*Width: *\([0-9]*\).*/\1/p'  | head -1)"
    h="$(webpinfo "$wf" 2>/dev/null | sed -n 's/.*Height: *\([0-9]*\).*/\1/p' | head -1)"
    { [ -n "$w" ] && ra="$(resize_args "$w" "$h")"; } || continue
    tmp="$(mktemp "$dir.resize.XXXXXX")"
    if cwebp -q 82 -m 6 -metadata none -resize $ra "$wf" -o "$tmp" >/dev/null 2>&1 && [ -s "$tmp" ]; then
      mv "$tmp" "$wf"
      echo "réduit   : ${pair/$'\t'//}/$(basename "$wf") (de ${w}x${h} → ${MAX}px)"
    else
      rm -f "$tmp"
      echo "ÉCHEC    : $(basename "$wf") — inchangé"
    fi
  done
done

# ─── 3. Régénérer data/photos.toml depuis les WebP présents ──────────────────
IFS=$'\n' pairs=($(sort <<<"${pairs[*]}")); unset IFS

# Noms de fichiers (sans extension) du dossier <axe>/<slug>, triés, dans `names`.
photos_of() {
  shopt -s nullglob
  local files=("$PHOTOS_DIR/$1/$2"/*.webp) f
  shopt -u nullglob
  names=()
  for f in "${files[@]}"; do names+=("$(basename "${f%.webp}")"); done
  [ "${#names[@]}" -eq 0 ] || { IFS=$'\n' names=($(sort <<<"${names[*]}")); unset IFS; }
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
    photos_of "$kind" "$slug"
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
    photos_of "$kind" "$slug"

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
