# Portfolio Photographique

Portfolio minimaliste généré par **Zola** (SSG en Rust, binaire unique) — pas de Node, pas de `npm`, pas de dépendance de développement en dehors du binaire `zola`. Galerie masonry par catégories, visionneuse lightbox au clavier et au glissement, thème clair fixe, photos en WebP. Hébergeable tel quel sur GitHub Pages.

---

## Prise en main

```bash
zola serve
# → http://127.0.0.1:1111 (live-reload)
```

Nécessite le binaire [`zola`](https://www.getzola.org/) installé (aucune autre dépendance).

---

## Structure

```
portfolio/
├── config.toml               ← base_url, titre du site
├── content/
│   ├── _index.md              ← Accueil (stub, template = "index.html")
│   └── categories/
│       ├── _index.md          ← /categories/ (listing)
│       └── <slug>.md          ← Une catégorie : title = libellé, nom de fichier = slug
├── data/
│   └── photos.toml            ← Régénéré par bin/add-photo.sh — source unique des photos
├── templates/
│   ├── base.html               ← Coquille commune (header, nav, grille, lightbox)
│   ├── index.html               ← Accueil : toutes les photos
│   └── categories/
│       ├── list.html            ← /categories/
│       └── page.html            ← Une catégorie : photos du sous-dossier correspondant
├── static/
│   ├── css/style.css           ← CSS natif : @font-face, custom properties, grille, lightbox
│   ├── js/gallery.js           ← Rendu grille + lightbox (PHOTOS fourni par le template)
│   └── assets/
│       ├── fonts/               ← WOFF2 auto-hébergés (Jost + Climate Crisis)
│       └── images/photos/<slug>/ ← Photos (WebP), un sous-dossier par catégorie
├── bin/
│   └── add-photo.sh            ← Outil auteur : convertit en WebP + régénère data/photos.toml
└── .github/workflows/          ← Déploiement GitHub Pages (zola build)
```

---

## Ajouter une catégorie

Une catégorie = un fichier `content/categories/<slug>.md` :

```toml
+++
title = "Libellé affiché"
template = "categories/page.html"
+++
```

Le nom de fichier (`<slug>.md`) est le nom machine — il doit correspondre au sous-dossier de photos (`static/assets/images/photos/<slug>/`) qui lui est associé. Créer ce fichier **avant** de déposer des photos dans le sous-dossier correspondant.

---

## Ajouter des photos

Les photos servies sont en **WebP** (format définitif du dépôt). Le flux : **déposer** les images (JPG/PNG/…) dans le sous-dossier de la catégorie concernée (`static/assets/images/photos/<slug>/`), puis lancer le script de synchronisation :

```bash
bin/add-photo.sh   # scanne les sous-dossiers et synchronise
```

Il enchaîne, sans argument :

0. Vérifie que chaque sous-dossier de `photos/` a son fichier `content/categories/<slug>.md` — échoue sinon avec la liste des catégories manquantes.
1. **Sources non-webp** → converties en WebP (`cwebp -q 82 -m 6`), **EXIF retiré**, **réduites à 4000 px** sur le plus grand côté si besoin (ratio préservé, jamais d'agrandissement) ; **la source est ensuite supprimée** — le dépôt ne conserve que le WebP.
2. **WebP déjà présents** → ré-encodés réduits sur place s'ils dépassent 4000 px (un WebP ne se redimensionne pas sans ré-encodage), sinon laissés tels quels.
3. **`data/photos.toml`** est régénéré intégralement depuis les sous-dossiers présents ; le script signale s'il était déjà à jour ou l'a mis à jour.

Idempotent (relancé sans nouveau fichier, il ne change rien) et ne dépend que du paquet `webp` (`cwebp` + `webpinfo`). Jamais servi au visiteur, hors déploiement.

L'affichage (grille et lightbox) est trié par nom de fichier **décroissant** (les plus récentes en premier) : nomme tes sources en conséquence (un préfixe date `2025-03-01_…`, ou un `photo-NN` zero-paddé, trient correctement).

---

## CSS

Un seul fichier `static/css/style.css`, en CSS natif (custom properties, pas de préprocesseur). Convention BEM (`.gallery-card__img-wrap`, `.lightbox__nav-row`).

- **Chemins d'assets dans les templates via `get_url()`** (racine-absolus, pas relatifs) : nécessaire dès qu'il y a plusieurs pages à des profondeurs d'URL différentes. `get_url()` tient compte de `base_url` (`config.toml`), déjà réglé sur le sous-chemin GitHub Pages du dépôt.
- Point de rupture unique **768 px** : sous ce seuil, grille masonry 2 colonnes et navigation lightbox au glissement uniquement ; au-dessus, 3 à 6 colonnes et flèches.
- Thème **clair fixe** — couleurs exposées en custom properties sous `:root` (`--bg`, `--bg-surface`, `--text`, `--text-muted`, `--shimmer-color`).
- Fontes **auto-hébergées** (`font-display: block`).

---

## Déploiement — GitHub Pages

1. **Settings → Pages → Source → GitHub Actions**.
2. Poussez sur `main` : le workflow `.github/workflows/deploy.yml` installe le binaire Zola, lance `zola build`, et publie `public/`.

`base_url` dans `config.toml` porte déjà le sous-chemin GitHub Pages (`https://<user>.github.io/portfolio`) — à ajuster si le dépôt est renommé ou déployé ailleurs.
