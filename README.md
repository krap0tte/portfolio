# Portfolio Photographique — Jekyll

Portfolio minimaliste hébergeable sur GitHub Pages. Sidebar fixe avec titre de série, grille plein-écran, visionneuse lightbox au clavier et au glissement, sélecteur de série avec pill animé, thème sombre synchronisé avec le système, images optimisées automatiquement au build.

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

# 3. Générer les variantes d'images optimisées (à relancer pour chaque nouvelle photo)
bash bin/optimize-images.sh

# 4. Lancer le serveur de développement
bundle exec jekyll serve --livereload
```

Le site est accessible sur [http://localhost:4000](http://localhost:4000).

> **Remarque** : sans l'étape 3, la galerie fonctionne mais charge les JPEGs originaux (non compressés). En production, le CI génère automatiquement les variantes optimisées.

---

## Structure du projet

```
portfolio/
│
├── _config.yml              ← Configuration principale (titre, URL, collections)
├── Gemfile                  ← Dépendances Ruby (Jekyll + plugins)
│
├── _series/                 ← Une fiche .md par série — source unique de vérité
│   ├── architecture.md      ←   titre, description, liste des fichiers images
│   ├── paysage.md
│   └── portrait.md
│
├── _layouts/
│   └── default.html         ← Gabarit de base (head.html + contenu + theme-toggle)
│
├── _includes/
│   ├── head.html            ← Contenu du <head> : meta, CSS, preloads fontes, SEO
│   ├── header.html          ← Bascule filtre : passe site.series aux deux composants
│   ├── filter-pill.html     ← Pill de filtre desktop (≥ 768 px)
│   ├── filter-mobile.html   ← Trigger + overlay filtre mobile (< 768 px)
│   ├── theme-toggle.html    ← Bouton bascule clair/sombre (SVG soleil/lune)
│   ├── cover.html           ← Splash plein-écran avec photo de couverture
│   ├── gallery-heading.html ← Sidebar titre/description de série + JSON series-data
│   ├── gallery-grid.html    ← Grille de cards + JSON photo-data
│   ├── gallery-card.html    ← Card unique, reçoit file, series_slug, index
│   └── lightbox.html        ← Visionneuse plein écran
│
├── _sass/                   ← Styles SCSS (Dart Sass, @use)
│   ├── _fonts.scss          ← Déclarations @font-face (Jost + Climate Crisis, auto-hébergées)
│   ├── _variables.scss      ← Tokens : typographie, tailles, breakpoints
│   ├── _mixins.scss         ← Mixin glass (verre dépoli) + mixin dark-theme
│   ├── _base.scss           ← Reset, CSS custom properties thème clair/sombre
│   ├── _cover.scss          ← Splash de couverture
│   ├── _header.scss         ← Pill de filtre, overlay mobile, bouton thème
│   ├── _gallery.scss        ← Sidebar heading, grille responsive, cards, shimmer
│   └── _lightbox.scss       ← Visionneuse plein écran
│
├── assets/
│   ├── css/main.scss        ← Point d'entrée SCSS (front matter Jekyll requis)
│   ├── fonts/               ← Fichiers WOFF2 auto-hébergés (Jost + Climate Crisis)
│   ├── js/main.js           ← Cover, Gallery, FilterMobileMenu, Lightbox, ThemeToggle
│   └── images/
│       ├── cover/           ← Photos de couverture
│       │   ├── cover.jpg         ← Original commité
│       │   ├── cover.webp        ← Généré — gitignored
│       │   ├── cover_phone.jpg   ← Variante mobile commitée
│       │   └── cover_phone.webp  ← Généré — gitignored
│       └── photos/          ← Photos de galerie, un sous-dossier par série
│           ├── architecture/
│           │   ├── photo-03.jpg        ← Original commité
│           │   ├── photo-03.webp       ← Généré — gitignored
│           │   ├── photo-03-thumb.jpg  ← Généré — gitignored
│           │   └── photo-03-thumb.webp ← Généré — gitignored
│           ├── paysage/
│           └── portrait/
│
├── bin/
│   └── optimize-images.sh   ← Script d'optimisation local (ne modifie pas les originaux)
│
├── .github/
│   └── workflows/deploy.yml ← CI/CD : optimisation images + build + déploiement
│
└── index.html               ← Page unique — assemble les includes de la galerie
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
description: "Description de la série."
photos:
  - photo-01
  - photo-06
  - photo-07
  - photo-10   ← nouvelle photo
---
```

3. Relancez `bash bin/optimize-images.sh` pour générer les variantes WebP et miniatures

L'ordre dans la liste détermine l'ordre d'affichage dans la galerie et de navigation dans la lightbox.

### Créer une nouvelle série

1. Ajoutez un fichier `_series/ma-serie.md` (le nom du fichier devient l'identifiant de la série) :

```yaml
---
title: Ma série
description: "Description affichée dans la sidebar."
photos:
  - photo-11
  - photo-12
---
```

2. Créez le sous-dossier `assets/images/photos/ma-serie/` et placez-y les images
3. Relancez `bash bin/optimize-images.sh`

Les boutons du sélecteur de série sont générés automatiquement à partir des fichiers présents dans `_series/` — aucune autre configuration n'est requise.

---

## Optimisation des images

### En développement local

```bash
bash bin/optimize-images.sh
```

Pour chaque photo dans `assets/images/photos/<serie>/`, le script génère :

| Fichier | Taille max | Usage |
|---|---|---|
| `photo-XX-thumb.jpg` | 800 px | Miniature grille galerie (fallback JPEG) |
| `photo-XX-thumb.webp` | 800 px | Miniature grille galerie (WebP) |
| `photo-XX.webp` | 1920 px | Lightbox (WebP) |

Pour les photos de couverture dans `assets/images/cover/`, seule la variante WebP pleine résolution est générée (pas de miniature).

Les fichiers générés sont listés dans `.gitignore` et ne sont **pas** commités.

> Le script ne modifie **pas** les originaux. Il peut être relancé autant de fois que nécessaire.

### En production (CI)

Le workflow GitHub Actions optimise automatiquement les images avant le build Jekyll :

1. Redimensionne les JPEGs originaux à **1920 px maximum** (qualité 85, EXIF supprimé) — en place, uniquement dans le contexte CI
2. Génère les miniatures 800 px + variantes WebP

Les originaux dans le dépôt git ne sont jamais modifiés.

---

## Configuration

Éditez `_config.yml` pour adapter le site :

```yaml
title: "Votre Nom"
description: "Photographe — Portrait · Paysage · Architecture"
author: "Votre Nom"
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
  @use "variables"     ← Tokens Sass : typo, tailles, breakpoints
  @use "mixins"        ← Mixin glass (verre dépoli), mixin dark-theme
  @use "base"          ← Reset, CSS custom properties thème clair/sombre
  @use "cover"         ← Splash de couverture
  @use "header"        ← Pill de filtre, overlay mobile, bouton thème
  @use "gallery"       ← Sidebar heading, grille responsive, cards, shimmer
  @use "lightbox"      ← Visionneuse plein écran
```

Chaque partiel commence par `@use 'variables' as *;` pour accéder aux tokens sans préfixe.

Les fontes Jost et Climate Crisis sont **auto-hébergées** dans `assets/fonts/` (WOFF2, subsets latin et latin-ext). Le `font-display: block` est intentionnel : il garantit que les mesures JavaScript de l'indicateur de filtre s'effectuent avec les métriques réelles de la fonte, sans reflow de layout après chargement.

Les composants suivent la convention **BEM** (`.gallery-card__img-wrap`, `.lightbox__nav--prev`, etc.).

### Layout desktop / mobile

Le seuil unique est **768 px** (`$bp-md`) :

- **< 768 px (mobile)** : grille 2 colonnes plein-écran, sélecteur de série en overlay, flèches lightbox masquées (navigation au glissement).
- **≥ 768 px (desktop)** : sidebar fixe 1/3 écran (titre + description de série), grille 2/3 restants, pill de filtre centré sur la grille, flèches lightbox visibles.

### Thème clair / sombre

Les couleurs sont exposées comme **CSS custom properties** dans `_base.scss`, ce qui permet de les modifier à l'exécution sans recompiler le SCSS :

```
:root                              ← thème clair (défaut)
[data-theme="dark"]                ← override manuel (localStorage)
@media (prefers-color-scheme: dark)
  :root:not([data-theme="light"])  ← thème système (sans override)
```

La propriété `data-theme` est écrite sur `<html>` par un script inline dans `<head>` avant le premier rendu, ce qui évite le flash de contenu non stylé (FOUC). Le bouton de bascule (`.theme-toggle`) en bas à droite permet un override manuel persistent via `localStorage`.

**Variables disponibles :**

| Variable | Rôle |
|---|---|
| `--bg` | Fond de page |
| `--bg-surface` | Fond de surface (placeholder images) |
| `--border` | Couleur des bordures |
| `--text` | Texte principal |
| `--text-muted` | Texte secondaire |
| `--text-faint` | Texte tertiaire |
| `--glass-bg` | Fond translucide des surfaces flottantes (pill, toggle, boutons lightbox) |
| `--glass-border` | Bordure des éléments verre dépoli |
| `--glass-shadow` | Ombre portée des éléments verre dépoli |
| `--glass-overlay-bg` | Fond semi-transparent des overlays plein écran |

---

## Déploiement

### GitHub Pages (automatique)

Le workflow `.github/workflows/deploy.yml` se déclenche à chaque push sur `main` :

1. **Install image tools** — installe ImageMagick et cwebp
2. **Optimise images** — génère les variantes WebP et miniatures
3. **Setup Ruby** — installe Ruby 3.3 et les gems (cache Bundler)
4. **Build Jekyll** — `bundle exec jekyll build` avec `JEKYLL_ENV=production`
5. **Deploy** — publie `_site/` sur GitHub Pages

#### Mise en place initiale

1. Créez un dépôt GitHub :
   - `username.github.io` pour un site utilisateur (URL : `https://username.github.io`)
   - ou `portfolio` pour un dépôt projet (URL : `https://username.github.io/portfolio`)

2. Activez GitHub Pages : **Settings → Pages → Source → GitHub Actions**

3. Poussez le code :

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/username/username.github.io.git
git push -u origin main
```

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
