# Portfolio Photographique — Jekyll

Portfolio minimaliste hébergeable sur GitHub Pages. Galerie plein-écran, visionneuse lightbox au clavier et au glissement, sélecteur de série avec pill animé, thème sombre fixe, images optimisées automatiquement au build.

---

## Sommaire

1. [Prérequis](#prérequis)
2. [Installation](#installation)
3. [Structure du projet](#structure-du-projet)
4. [Ajouter du contenu](#ajouter-du-contenu)
5. [Optimisation des images](#optimisation-des-images)
6. [Configuration](#configuration)
7. [Architecture CSS](#architecture-css)
8. [Déploiement](#déploiement)

---

## Prérequis

| Outil | Version | Usage |
|---|---|---|
| Ruby | ≥ 3.1 | Exécution de Jekyll |
| Bundler | dernière | Gestion des gems |
| ImageMagick | toute | Optimisation images (dev local uniquement) |
| webp | toute | Conversion WebP (dev local uniquement) |

```bash
# macOS
brew install imagemagick webp

# Debian / Ubuntu / WSL
sudo apt-get install imagemagick webp
```

---

## Installation

```bash
# 1. Cloner le dépôt
git clone https://github.com/username/username.github.io.git
cd username.github.io

# 2. Installer les dépendances Ruby
bundle install

# 3. Générer les variantes d'images WebP (à relancer pour chaque nouvelle photo)
bash bin/build-webp.sh

# 4. Lancer le serveur de développement
bundle exec jekyll serve --livereload
```

Le site est accessible sur [http://localhost:4000](http://localhost:4000).

> **Remarque** : sans l'étape 3, la galerie fonctionne mais charge les JPEGs originaux non compressés. En production, relancer le script avant chaque build.

---

## Structure du projet

```
portfolio/
│
├── _config.yml              ← Configuration principale (titre, description, lang)
├── Gemfile                  ← Dépendances Ruby (Jekyll + WEBrick)
│
├── _series/                 ← Une fiche .md par série — source unique de vérité
│   ├── architecture.md      ←   title + liste ordonnée photos:
│   ├── paysage.md
│   └── portrait.md
│
├── _layouts/
│   └── default.html         ← Gabarit unique : <head>, filter-bar, main, footer, <script>
│
├── _includes/
│   ├── head.html            ← Contenu du <head> : meta, CSS, preloads fontes
│   ├── cover.html           ← Splash plein-écran avec photo de couverture
│   ├── gallery-grid.html    ← Grille de cards + bloc JSON photo-data
│   └── lightbox.html        ← Visionneuse plein écran
│
├── _sass/                   ← Styles SCSS (Dart Sass, @use)
│   ├── _fonts.scss          ← Déclarations @font-face (Jost + Climate Crisis, auto-hébergées)
│   ├── _variables.scss      ← Tokens : typographie, tailles, breakpoints, z-index
│   ├── _mixins.scss         ← Mixin surface (surfaces flottantes)
│   ├── _base.scss           ← Reset + CSS custom properties (thème sombre fixe)
│   ├── _cover.scss          ← Splash de couverture
│   ├── _layout.scss         ← Filter-bar, pill, menu mobile, site-main, site-footer
│   ├── _gallery.scss        ← Grille responsive, cards, shimmer
│   └── _lightbox.scss       ← Visionneuse plein écran
│
├── assets/
│   ├── css/main.scss        ← Point d'entrée SCSS (front matter Jekyll requis)
│   ├── fonts/               ← Fichiers WOFF2 auto-hébergés (Jost + Climate Crisis)
│   ├── js/main.js           ← Cover, Gallery, FilterMobileMenu, Lightbox, PillScroller
│   └── images/
│       ├── cover/           ← Photos de couverture
│       │   ├── cover.jpg          ← Original commité
│       │   ├── cover.webp         ← Généré 1920 px (1×) — gitignored
│       │   ├── cover-2x.webp      ← Généré 3840 px max (Retina 2×) — gitignored
│       │   ├── cover_phone.jpg    ← Variante mobile commitée
│       │   └── cover_phone.webp   ← Généré — gitignored
│       └── photos/          ← Photos de galerie, un sous-dossier par série
│           ├── architecture/
│           │   ├── photo-03.jpg            ← Original commité
│           │   ├── photo-03.webp           ← Généré pleine résolution — gitignored
│           │   ├── photo-03-thumb.webp     ← Généré 1200 px — gitignored
│           │   └── photo-03-thumb-2x.webp  ← Généré 2400 px (Retina 2×) — gitignored
│           ├── paysage/
│           └── portrait/
│
├── bin/
│   ├── build-webp.sh        ← Génère les variantes WebP avant le build de production
│   └── normalize.sh         ← Redimensionne les photos > 4K en place (optionnel)
│
└── index.html               ← Page unique — assemble cover, gallery-grid, lightbox
```

---

## Ajouter du contenu

### Ajouter une photo à une série existante

1. Placez le fichier image dans `assets/images/photos/<serie>/` (JPG, recommandé ≥ 2000 px de large)
2. Ajoutez son nom (sans extension) dans la liste `photos:` du markdown de série correspondant :

```yaml
# _series/paysage.md
---
title: Paysage
photos:
  - photo-01
  - photo-06
  - photo-07
  - photo-10   ← nouvelle photo
---
```

3. Relancez `bash bin/build-webp.sh` pour générer les variantes WebP et miniatures

L'ordre dans la liste détermine l'ordre d'affichage dans la galerie et de navigation dans la lightbox.

### Créer une nouvelle série

1. Ajoutez un fichier `_series/ma-serie.md` (le nom du fichier devient le slug de la série) :

```yaml
---
title: Ma série
photos:
  - photo-11
  - photo-12
---
```

2. Créez le sous-dossier `assets/images/photos/ma-serie/` et placez-y les images
3. Relancez `bash bin/build-webp.sh`

Les boutons du sélecteur de série sont générés automatiquement à partir des fichiers `_series/` — aucune autre configuration n'est requise.

---

## Optimisation des images

### En développement local

```bash
bash bin/build-webp.sh
```

Pour chaque photo dans `assets/images/photos/<serie>/`, le script génère :

| Fichier | Taille max | Usage |
|---|---|---|
| `photo-XX-thumb.webp` | 1200 px | Miniature grille galerie |
| `photo-XX-thumb-2x.webp` | 2400 px | Miniature Retina 2× |
| `photo-XX.webp` | Résolution native | Lightbox |

Pour les covers desktop, deux variantes sont générées : `cover.webp` (1920 px, affichage standard) et `cover-2x.webp` (3840 px max, Retina 2×). Les covers mobiles (`*_phone`) génèrent une seule variante WebP.

Les fichiers générés sont listés dans `.gitignore` et ne sont **pas** commités.

> Le script ne modifie **pas** les originaux. Il peut être relancé autant de fois que nécessaire.

### En production

```bash
bash bin/build-webp.sh
JEKYLL_ENV=production bundle exec jekyll build
```

---

## Configuration

Éditez `_config.yml` pour adapter le site :

```yaml
title: "Votre Nom"
description: "Photographe — Portrait · Paysage · Architecture"
url: "https://username.github.io"  # URL racine du site déployé
baseurl: ""                        # Laisser vide pour username.github.io
                                   # Mettre "/nom-du-repo" pour un dépôt projet
lang: fr
```

---

## Architecture CSS

Les styles utilisent **Dart Sass** avec la syntaxe `@use` (pas de `@import` déprécié).

```
assets/css/main.scss   ← Point d'entrée (front matter Jekyll obligatoire)
  @use "fonts"         ← @font-face Jost + Climate Crisis (font-display: block)
  @use "variables"     ← Tokens Sass : typo, tailles, breakpoints, z-index
  @use "mixins"        ← Mixin surface (surfaces flottantes)
  @use "base"          ← Reset, CSS custom properties (thème sombre fixe)
  @use "cover"         ← Splash de couverture
  @use "layout"        ← Filter-bar, pill, menu mobile, site-main, site-footer
  @use "gallery"       ← Grille responsive, cards, shimmer
  @use "lightbox"      ← Visionneuse plein écran
```

Chaque partiel commence par `@use 'variables' as *;` pour accéder aux tokens sans préfixe.

Les fontes Jost et Climate Crisis sont **auto-hébergées** dans `assets/fonts/` (WOFF2, subsets latin et latin-ext). Le `font-display: block` est intentionnel : il garantit que les mesures JavaScript de l'indicateur de filtre s'effectuent avec les métriques réelles de la fonte, sans reflow de layout après chargement.

Les composants suivent la convention **BEM** (`.gallery-card__img-wrap`, `.lightbox__nav--prev`, etc.).

### Layout desktop / mobile

Le seuil unique est **768 px** (`$bp-md`) :

- **< 768 px (mobile)** : grille 2 colonnes plein-écran, sélecteur de série en overlay, flèches lightbox masquées (navigation au glissement).
- **≥ 768 px (desktop)** : grille plein-écran, pill de filtre centré en bas, flèches lightbox visibles.

### Thème

Le site utilise un thème **sombre fixe**. Les couleurs sont exposées comme CSS custom properties dans `_base.scss` sous `:root` :

| Variable | Rôle |
|---|---|
| `--bg` | Fond de page |
| `--bg-surface` | Fond de surface (placeholder images) |
| `--border` | Couleur des bordures |
| `--text` | Texte principal |
| `--text-muted` | Texte secondaire |
| `--shimmer-color` | Animation shimmer des cards |

---

## Déploiement

### GitHub Pages

1. Créez un dépôt GitHub :
   - `username.github.io` pour un site utilisateur (URL : `https://username.github.io`)
   - ou `portfolio` pour un dépôt projet (URL : `https://username.github.io/portfolio`)

2. Activez GitHub Pages : **Settings → Pages → Source → GitHub Actions**

3. Créez un workflow `.github/workflows/deploy.yml` qui installe ImageMagick et cwebp, lance `bash bin/build-webp.sh`, puis `JEKYLL_ENV=production bundle exec jekyll build`, et publie `_site/`.

4. Poussez le code :

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/username/username.github.io.git
git push -u origin main
```

> **Important** : `Gemfile.lock` doit être commité. Il garantit des builds CI reproductibles (`bundler-cache: true` dans le workflow s'ancre sur son hash). Ne pas l'ajouter à `.gitignore`.

Le site est disponible ~2 minutes après le premier push.

#### Dépôt projet (sous-chemin)

Si le dépôt n'est pas `username.github.io`, ajustez `_config.yml` :

```yaml
baseurl: "/nom-du-repo"
url: "https://username.github.io"
```

### Build manuel

```bash
JEKYLL_ENV=production bundle exec jekyll build
# Les fichiers statiques sont dans _site/
```
