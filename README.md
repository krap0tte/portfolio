# Portfolio Photographique

Portfolio minimaliste généré par **Zola** (SSG en Rust, binaire unique) — pas de Node, pas de `npm`, pas de dépendance de développement en dehors du binaire `zola`. Accueil éditorial (couverture, séries récentes, catégories), galerie masonry classée sur deux axes (catégories et séries), visionneuse lightbox au clavier et au glissement, thème clair fixe, photos en WebP. Hébergeable tel quel sur GitHub Pages.

---

## Prise en main

```bash
bin/build-thumbs.sh   # après un clone frais : génère les miniatures (non versionnées)
zola serve
# → http://127.0.0.1:1111 (live-reload)
```

Nécessite le binaire [`zola`](https://www.getzola.org/), et le paquet `webp` (`cwebp` + `webpinfo`) pour les scripts d'images. **Les miniatures ne sont pas versionnées** : sans `bin/build-thumbs.sh`, les grilles et les cartes affichent des images cassées. Le déploiement les regénère de son côté.

---

## Structure

```
portfolio/
├── config.toml               ← base_url, titre, description (= texte d'accueil), extra.hero
├── content/
│   ├── _index.md              ← Accueil (stub, template = "index.html")
│   ├── categories/
│   │   ├── _index.md          ← Section non rendue (render = false), sert à lister sur l'accueil
│   │   └── <slug>.md          ← Une catégorie : title, extra.cover
│   └── series/
│       ├── _index.md          ← Section non rendue (render = false), listée sur l'accueil
│       └── <slug>.md          ← Une série : title, extra.cover, extra.hero, corps = intro
├── data/
│   └── photos.toml            ← Régénéré par bin/add-photo.sh — source unique des photos
├── templates/
│   ├── base.html               ← Coquille commune (header, blocs intro/grille/lightbox)
│   ├── index.html               ← Accueil : couverture + toutes les séries + catégories
│   ├── categories/
│   │   └── page.html            ← Une catégorie : photos du sous-dossier correspondant
│   └── series/
│       └── page.html            ← Une série : couverture + texte d'intro + photos
├── static/
│   ├── css/style.css           ← CSS natif : @font-face, custom properties, grille, lightbox
│   ├── js/gallery.js           ← Rendu grille + lightbox (PHOTOS fourni par le template)
│   └── assets/
│       ├── fonts/               ← WOFF2 auto-hébergés (Jost + Climate Crisis)
│       └── images/
│           ├── hero.webp          ← Couverture de l'accueil (hors classement)
│           └── photos/
│               ├── categories/<slug>/ ← Photos (WebP) d'une catégorie
│               │   └── thumbs/         ← Miniatures dérivées (git-ignorées)
│               └── series/<slug>/     ← Photos (WebP) d'une série
│                   └── thumbs/         ← idem
├── bin/
│   ├── add-photo.sh            ← Outil auteur : convertit en WebP + régénère data/photos.toml
│   └── build-thumbs.sh         ← Miniatures (non versionnées) — lancé en local ET au déploiement
└── .github/workflows/          ← Déploiement GitHub Pages (zola build)
```

---

## Catégories et séries — deux axes indépendants

Les photos sont classées sur **deux axes de même rang, sans recouvrement** — une photo appartient à l'un ou à l'autre, jamais aux deux :

- une **catégorie** est un bac thématique, sans texte : `/categories/<slug>/` n'affiche qu'une grille ;
- une **série** est un corpus éditorial : `/series/<slug>/` s'ouvre sur sa couverture en pleine fenêtre, titre en surimpression, puis le texte d'introduction et la grille.

Il n'y a **pas** de page `/categories/` ni `/series/` : l'accueil les liste toutes les deux intégralement.

Deux champs d'image, **indépendants** parce que leurs cadrages s'opposent (valeur = nom de fichier sans extension, dans le dossier du classement) :

| Champ | Usage | Cadrage |
|---|---|---|
| `cover` | vignette de carte sur l'accueil, recadrée en 3/2 | portrait ou paysage, indifférent |
| `hero` | couverture pleine fenêtre d'une page de série | **paysage** — un portrait s'y réduit à une bande |

Le rattachement des photos, lui, se fait par **emplacement du fichier image**, jamais par métadonnée par photo.

### Ajouter une catégorie

Un fichier `content/categories/<slug>.md` — une catégorie n'a que des cartes, donc pas de `hero` :

```toml
+++
title = "Libellé affiché"
template = "categories/page.html"

[extra]
cover = "2026-07-14_RASS_COUTURE_BOUSSEY_01"
+++
```

### Ajouter une série

Idem dans `content/series/<slug>.md`, plus un `hero` (sa page s'ouvre sur une couverture pleine fenêtre) ; le corps Markdown sert de texte d'intro :

```toml
+++
title = "Libellé affiché"
template = "series/page.html"

[extra]
cover = "2025-03-01_LE_MANS_LOTUS_01"
hero  = "2025-03-01_LE_MANS_LOTUS_08"
+++

Quelques paragraphes de contexte.
```

La couverture pleine fenêtre de l'**accueil** se règle à part, dans `config.toml` (`[extra] hero`), en chemin sous `static/`. Elle vit **hors de `photos/`** (`static/assets/images/hero.webp`) : elle n'appartient à aucun classement et n'entre donc pas dans `data/photos.toml`. `bin/add-photo.sh` la convertit quand même — déposer un `hero.jpg` à côté suffit à la remplacer — mais ne lui génère pas de miniature, puisqu'elle est toujours affichée en plein écran.

Dans les deux cas le nom de fichier (`<slug>.md`) est le nom machine — il doit correspondre au sous-dossier de photos qui lui est associé (`static/assets/images/photos/categories/<slug>/` ou `.../series/<slug>/`). Créer ce fichier **avant** de déposer des photos dans le sous-dossier correspondant.

**Renommer** un classement, c'est donc déplacer *deux* choses : le `.md` **et** le dossier de photos. Tant que les deux ne concordent pas, le site se construit quand même (grille vide, carte masquée) mais `bin/add-photo.sh` le signale.

---

## Ajouter des photos

Les photos servies sont en **WebP** (format définitif du dépôt). Le flux : **déposer** les images (JPG/PNG/…) dans le sous-dossier de la catégorie ou de la série concernée (`static/assets/images/photos/categories/<slug>/` ou `.../series/<slug>/`), puis lancer le script de synchronisation :

```bash
bin/add-photo.sh   # scanne les sous-dossiers et synchronise
```

Il enchaîne, sans argument :

1. **Sources non-webp** → converties en WebP (`cwebp -q 82 -m 6`), **EXIF retiré**, **résolution d'origine conservée** ; **la source est ensuite supprimée** — le dépôt ne conserve que le WebP. Le `hero` de `config.toml` suit la même règle.
2. Vérifie l'appariement **dans les deux sens** — chaque sous-dossier de photos a son fichier de contenu (`content/categories/<slug>.md` ou `content/series/<slug>.md`) et réciproquement — que les images déclarées (`cover`, et `hero` pour une série) existent bien, et que le `hero` de `config.toml` existe. Échoue sinon avec la liste de ce qui est mal apparié. Utile en particulier lors d'un **renommage** : déplacer le `.md` sans déplacer le dossier de photos (ou l'inverse) est immédiatement signalé.
3. **Miniatures** → délégué à `bin/build-thumbs.sh`, qui écrit `<slug>/thumbs/<nom>.webp` (1200 px) et `<slug>/thumbs/<nom>-2x.webp` (2400 px), régénère celles qui sont absentes ou périmées et supprime les orphelines. Tout ce qui n'est **pas** affiché en plein écran (grille masonry, cartes) est servi via ces miniatures en `srcset` ; la pleine résolution reste pour la lightbox et les couvertures. C'est le seul redimensionnement — la pleine résolution n'est pas plafonnée, ce sont les miniatures qui portent l'optimisation.
4. **`data/photos.toml`** est régénéré intégralement depuis les sous-dossiers présents ; le script signale s'il était déjà à jour ou l'a mis à jour. Chaque bloc porte un champ `latest` (nom de fichier le plus récent du dossier) : le modèle n'ayant pas de date, c'est lui qui donne l'ordre chronologique des séries sur l'accueil.

Idempotent (relancé sans nouveau fichier, il ne change rien) et ne dépend que du paquet `webp` (`cwebp` + `webpinfo`). Jamais servi au visiteur, hors déploiement.

L'affichage (grille et lightbox) est trié par nom de fichier **décroissant** (les plus récentes en premier) : nomme tes sources en conséquence (un préfixe date `2025-03-01_…`, ou un `photo-NN` zero-paddé, trient correctement).

---

## CSS

Un seul fichier `static/css/style.css`, en CSS natif (custom properties, pas de préprocesseur). Convention BEM (`.gallery-card__img-wrap`, `.lightbox__nav-row`). Séries et catégories partagent la même carte `.cover-card` (couverture recadrée, titre en surimpression) ; seule la densité de grille les distingue (`.card-grid` vs `.card-grid--small`).

- **Chemins d'assets dans les templates via `get_url()`** (racine-absolus, pas relatifs) : nécessaire dès qu'il y a plusieurs pages à des profondeurs d'URL différentes. `get_url()` tient compte de `base_url` (`config.toml`), déjà réglé sur le sous-chemin GitHub Pages du dépôt.
- Point de rupture unique **768 px** : sous ce seuil, grille masonry 2 colonnes et navigation lightbox au glissement uniquement ; au-dessus, 3 à 6 colonnes et flèches.
- Thème **clair fixe** — couleurs exposées en custom properties sous `:root` (`--bg`, `--bg-surface`, `--text`, `--text-muted`, `--shimmer-color`).
- Fontes **auto-hébergées** (`font-display: block`).

---

## Déploiement — GitHub Pages

1. **Settings → Pages → Source → GitHub Actions**.
2. Poussez sur `main` : le workflow `.github/workflows/deploy.yml` installe le binaire Zola et le paquet `webp`, génère les miniatures (`bin/build-thumbs.sh`, avec un cache clé sur le hash des photos), lance `zola build`, et publie `public/`.

`base_url` dans `config.toml` porte déjà le sous-chemin GitHub Pages (`https://<user>.github.io/portfolio`) — à ajuster si le dépôt est renommé ou déployé ailleurs.
