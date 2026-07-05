# Portfolio Photographique — Angular

Portfolio minimaliste hébergeable sur GitHub Pages. Galerie plein-écran, visionneuse lightbox au clavier et au glissement, thème sombre fixe, images optimisées automatiquement au build.

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
| Node.js | ≥ 20 | Build, serveur de développement Angular, optimisation des images |
| npm | dernière | Gestion des dépendances |

La conversion WebP (`bin/build-webp.mjs`) et la normalisation des originaux (`bin/normalize.mjs`) utilisent **sharp**, un paquet npm — aucun outil système à installer.

---

## Installation

```bash
# 1. Cloner le dépôt
git clone https://github.com/username/username.github.io.git
cd username.github.io

# 2. Installer les dépendances
npm install

# 3. Lancer le serveur de développement (rechargement automatique inclus)
npm start
```

Le site est accessible sur [http://localhost:4200](http://localhost:4200).

> **Remarque** : en développement, la galerie charge directement les JPEG originaux — aucune variante WebP n'est nécessaire. Les variantes ne servent qu'au build de production.

---

## Structure du projet

```
portfolio/
│
├── angular.json             ← Configuration du build Angular (assets, styles, budgets)
├── package.json             ← Dépendances npm (Angular 22, sans router ni forms)
├── tsconfig.json            ← Configuration TypeScript (strict)
│
├── src/
│   ├── index.html           ← Coquille HTML : meta (pas de preloads)
│   ├── main.ts              ← Bootstrap de l'application (zoneless)
│   │
│   ├── app/
│   │   ├── photos.ts        ← Photos — source unique de vérité
│   │   ├── gallery-state.ts ← État partagé (signals) : À propos, lightbox
│   │   ├── focus-trap.ts    ← trapTabFocus() — partagé lightbox.ts
│   │   ├── app.ts           ← Composant racine : composition + footer À propos
│   │   ├── about-button.ts  ← Bouton À propos (même rendu à tous les breakpoints)
│   │   ├── gallery-grid.ts  ← Grille de cards
│   │   └── lightbox.ts      ← Visionneuse plein écran (clavier, swipe, focus trap)
│   │
│   └── styles/              ← Styles SCSS globaux (Dart Sass, @use)
│       ├── main.scss        ← Point d'entrée (déclaré dans angular.json)
│       ├── _fonts.scss      ← Déclarations @font-face (Jost + Climate Crisis, auto-hébergées)
│       ├── _variables.scss  ← Tokens : typographie, tailles, breakpoints, z-index
│       ├── _mixins.scss     ← Mixin surface (surfaces flottantes)
│       ├── _base.scss       ← Reset + CSS custom properties (thème sombre fixe)
│       ├── _layout.scss     ← Bouton À propos, site-main, site-footer
│       ├── _gallery.scss    ← Grille responsive, cards, shimmer
│       └── _lightbox.scss   ← Visionneuse plein écran
│
├── assets/
│   ├── fonts/               ← WOFF2 auto-hébergés ; référencés via url() SCSS (esbuild les copie, hachés, dans dist/.../media/ — pas via le glob assets d'angular.json)
│   └── images/               ← Copiées telles quelles dans le build (glob assets d'angular.json)
│       └── photos/          ← Photos de galerie, toutes à plat
│           ├── photo-03.jpg            ← Original commité
│           ├── photo-03.webp           ← Généré pleine résolution — gitignored
│           ├── photo-03-thumb.webp     ← Généré 1200 px — gitignored
│           └── photo-03-thumb-2x.webp  ← Généré 2400 px (Retina 2×) — gitignored
│
└── bin/
    ├── lib/images.mjs       ← Helpers partagés : recherche JPEG récursive, test de fraîcheur (mtime)
    ├── build-webp.mjs       ← Génère les variantes WebP avant le build de production (sharp)
    └── normalize.mjs        ← Redimensionne les photos > 4K en place (optionnel, sharp)
```

---

## Ajouter du contenu

### Ajouter une photo

1. Placez le fichier image dans `assets/images/photos/` (JPG, recommandé ≥ 2000 px de large)
2. Ajoutez son nom (sans extension) dans `FILES` :

```ts
// src/app/photos.ts
const FILES = ['photo-01', 'photo-02', /* … */, 'photo-10'].sort();
//                                                ↑ nouvelle photo
```

L'affichage est trié par nom de fichier (galerie et navigation dans la lightbox).

---

## Optimisation des images

En développement, aucune optimisation n'est nécessaire : les JPEG originaux sont servis directement.

Pour la production :

```bash
npm run build:webp
```

Pour chaque photo dans `assets/images/photos/`, le script génère :

| Fichier | Taille max | Usage |
|---|---|---|
| `photo-XX-thumb.webp` | 1200 px | Miniature grille galerie |
| `photo-XX-thumb-2x.webp` | 2400 px | Miniature Retina 2× |
| `photo-XX.webp` | Résolution native | Lightbox |

Les fichiers générés sont listés dans `.gitignore` et ne sont **pas** commités. En CI, le workflow les régénère à chaque build.

> Le script ne modifie **pas** les originaux. Il peut être relancé autant de fois que nécessaire (idempotent, `--force` pour tout régénérer).

---

## Configuration

- **Titre et description** : dans `src/index.html` (`<title>`, `<meta name="description">`) et le footer de `src/app/app.ts`.
- **Langue** : attribut `lang` de `src/index.html`.
- **Photos** : `src/app/photos.ts`.

Le site fonctionne aussi bien déployé à la racine d'un domaine (`username.github.io`) que sous un sous-chemin (dépôt projet, `username.github.io/nom-du-repo/`) : tous les chemins d'assets sont relatifs et résolus via `<base href>`, posé au build par `--base-href` (voir Déploiement). Aucun ajustement manuel de chemin n'est nécessaire.

---

## Architecture CSS

Les styles sont **globaux** (pas de styles par composant Angular) et utilisent **Dart Sass** avec la syntaxe `@use` (pas de `@import` déprécié).

```
src/styles/main.scss   ← Point d'entrée (déclaré dans angular.json)
  @use "fonts"         ← @font-face Jost + Climate Crisis (font-display: block)
  @use "variables"     ← Tokens Sass : typo, tailles, breakpoints, z-index
  @use "mixins"        ← Mixin surface (surfaces flottantes)
  @use "base"          ← Reset, CSS custom properties (thème sombre fixe)
  @use "layout"        ← Bouton À propos, site-main, site-footer
  @use "gallery"       ← Grille responsive, cards, shimmer
  @use "lightbox"      ← Visionneuse plein écran
```

Chaque partiel commence par `@use 'variables' as *;` pour accéder aux tokens sans préfixe.

Les fontes Jost et Climate Crisis sont **auto-hébergées** dans `assets/fonts/` (WOFF2, subsets latin et latin-ext). Le `font-display: block` est intentionnel : il supprime le swap de police, sans reflow de layout après chargement.

Les composants suivent la convention **BEM** (`.gallery-card__img-wrap`, `.lightbox__nav--prev`, etc.). Les éléments hôtes Angular (`app-gallery-grid`, `app-lightbox`…) sont neutralisés par `display: contents` dans `_base.scss` : le CSS voit la même arborescence qu'un document statique.

### Layout desktop / mobile

Le seuil unique est **768 px** (`$bp-md`) :

- **< 768 px (mobile)** : grille 2 colonnes plein-écran, flèches lightbox masquées (navigation au glissement).
- **≥ 768 px (desktop)** : grille plein-écran, flèches lightbox visibles.

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

1. Créez un dépôt GitHub — `username.github.io` (site utilisateur, URL racine `https://username.github.io`) **ou** un dépôt projet quelconque comme `portfolio` (URL `https://username.github.io/portfolio/`). Les deux fonctionnent sans configuration supplémentaire.

2. Activez GitHub Pages : **Settings → Pages → Source → GitHub Actions**

3. Le workflow `.github/workflows/deploy.yml` installe les dépendances npm, lance `npm run build:webp`, compile avec `npx ng build --base-href "${{ steps.pages.outputs.base_path }}/"`, et publie `dist/portfolio/browser/`. `base_path` (fourni par `actions/configure-pages`) vaut `""` pour un site utilisateur ou `/nom-du-repo` pour un dépôt projet — déterminé automatiquement, rien à éditer.

4. Poussez le code :

```bash
git push -u origin main
```

> **Important** : `package-lock.json` doit être commité. Il garantit des builds CI reproductibles et un cache npm efficace (`cache: 'npm'` dans le workflow). Ne pas l'ajouter à `.gitignore`.

Le site est disponible ~2 minutes après le premier push.

### Build manuel

```bash
npm run build:webp
npm run build
# Les fichiers statiques sont dans dist/portfolio/browser/
```
