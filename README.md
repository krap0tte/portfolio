# Portfolio Photographique — Jekyll

Portfolio minimaliste hébergeable gratuitement sur GitHub Pages. Galerie filtrée par série, visionneuse lightbox au clavier, images optimisées automatiquement au build.

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
├── _config.yml              ← Configuration principale (titre, URL, navigation)
├── Gemfile                  ← Dépendances Ruby (Jekyll + plugins)
│
├── _layouts/
│   ├── default.html         ← Gabarit de base (header + footer)
│   └── photo.html           ← Page détail d'une photo
│
├── _includes/
│   ├── header.html          ← En-tête et navigation (desktop + mobile)
│   └── footer.html          ← Pied de page
│
├── _sass/                   ← Styles SCSS (Dart Sass, @use/@forward)
│   ├── _variables.scss      ← Tokens : couleurs, typographie, breakpoints
│   ├── _base.scss           ← Reset CSS et utilitaires globaux
│   ├── _header.scss         ← Styles de l'en-tête
│   ├── _gallery.scss        ← Galerie, filtres, lightbox
│   ├── _photo.scss          ← Page détail photo
│   └── _pages.scss          ← Pages statiques (À propos, Contact)
│
├── _photos/                 ← Une fiche .md par photo
│   └── nom-de-la-photo.md
│
├── _data/
│   └── series.yml           ← Descriptions des séries (utilisées sous les filtres)
│
├── assets/
│   ├── css/main.scss        ← Point d'entrée SCSS (front matter Jekyll requis)
│   ├── js/main.js           ← Navigation mobile, filtre galerie, lightbox
│   └── images/              ← Photos originales (JPG)
│       ├── photo-01.jpg          ← Original commité dans git
│       ├── photo-01.webp         ← Généré — gitignored
│       ├── photo-01-thumb.jpg    ← Généré — gitignored
│       └── photo-01-thumb.webp   ← Généré — gitignored
│
├── bin/
│   └── optimize-images.sh   ← Script d'optimisation local (ne modifie pas les originaux)
│
├── .github/
│   └── workflows/deploy.yml ← CI/CD : optimisation images + build + déploiement
│
├── index.html               ← Galerie principale
├── about.md                 ← Page À propos
└── contact.md               ← Page Contact
```

---

## Ajouter du contenu

### Ajouter une photo

1. Placez le fichier image dans `assets/images/` (JPG, recommandé ≥ 2000px de large)
2. Créez une fiche dans `_photos/` :

```yaml
# _photos/mon-titre.md
---
title: "Titre de la photo"
date: 2024-11-01
category: "Paysage"          # doit correspondre à une clé dans _data/series.yml
image: /assets/images/mon-titre.jpg
location: "Paris, France"    # optionnel
description: |               # optionnel — supporte le Markdown
  Contexte de la prise de vue.
---
```

3. Relancez `bash bin/optimize-images.sh` pour générer les variantes WebP et miniatures

> Le nom du fichier dans `_photos/` détermine l'URL de la page détail (`/photos/mon-titre/`).

### Ajouter ou modifier une série

Les séries correspondent aux catégories assignées aux photos. Pour ajouter la description qui s'affiche sous les filtres, éditez `_data/series.yml` :

```yaml
# Clé = valeur de `category` dans les fiches _photos/, slugifiée (minuscules, tirets)
paysage: "Description de la série Paysage."
portrait: "Description de la série Portrait."
architecture: "Description de la série Architecture."
ma-serie: "Description de votre nouvelle série."
```

> La clé doit être la version slugifiée du nom de catégorie tel que défini dans `_photos/*.md` (filtre Liquid `| slugify` : espaces → tirets, majuscules → minuscules).

---

## Optimisation des images

### En développement local

```bash
bash bin/optimize-images.sh
```

Pour chaque `photo-XX.jpg` dans `assets/images/`, le script génère :

| Fichier | Taille max | Usage |
|---|---|---|
| `photo-XX-thumb.jpg` | 800 px | Miniature grille galerie (fallback JPEG) |
| `photo-XX-thumb.webp` | 800 px | Miniature grille galerie (WebP) |
| `photo-XX.webp` | original | Page détail + lightbox (WebP) |

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
email: contact@votrenom.com
url: "https://username.github.io"  # URL racine du site déployé
baseurl: ""                        # Laisser vide pour username.github.io
                                   # Mettre "/nom-du-repo" pour un dépôt projet
lang: fr

navigation:
  - title: "Galerie"
    url: "/"
  - title: "À propos"
    url: "/about/"
  - title: "Contact"
    url: "/contact/"
```

### Navigation

Les entrées de `navigation` sont rendues automatiquement dans `_includes/header.html`.

### Page de contact

`contact.md` utilise [Formspree](https://formspree.io) (plan gratuit disponible). Remplacez l'action du formulaire par votre URL Formspree.

---

## Architecture CSS

Les styles utilisent **Dart Sass** avec la syntaxe moderne `@use`/`@forward` (pas de `@import` déprécié).

```
assets/css/main.scss   ← Point d'entrée (front matter Jekyll obligatoire)
  @use "variables"     ← Tokens centralisés
  @use "base"
  @use "header"
  @use "gallery"       ← Inclut la grille, les filtres et la lightbox
  @use "photo"
  @use "pages"
```

Chaque partiel commence par `@use 'variables' as *;` pour accéder aux tokens sans préfixe.

Les composants suivent la convention **BEM** (`.gallery-card__img-wrap`, `.lightbox__nav--prev`, etc.).

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
