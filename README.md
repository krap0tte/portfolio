# Portfolio Photographique — Jekyll

Un portfolio minimaliste et élégant pour présenter votre travail photographique,
conçu pour être hébergé gratuitement sur GitHub Pages.

## Démarrage rapide

### Prérequis
- Ruby ≥ 3.1
- Bundler (`gem install bundler`)

### Installation locale

```bash
bundle install
bundle exec jekyll serve --livereload
```

Ouvrez [http://localhost:4000](http://localhost:4000)

---

## Personnalisation

### 1. Vos informations (`_config.yml`)

```yaml
title: "Votre Nom"
description: "Photographe — Portrait · Paysage"
email: contact@votrenom.com
url: "https://votre-username.github.io"
```

### 2. Ajouter une photo

Créez un fichier dans `_photos/nom-de-la-photo.md` :

```yaml
---
title: "Titre de la photo"
date: 2024-11-01
category: "Portrait"          # Paysage, Architecture, etc.
image: /assets/images/photo.jpg
location: "Paris, France"
camera: "Sony A7R V"
lens: "85mm f/1.4"
settings: "1/200s — f/2.0 — ISO 200"
description: |
  Description libre de la photo et du contexte
  dans lequel elle a été prise.
---
```

### 3. Vos photos (`assets/images/`)

- Format recommandé : **JPG** ou **WebP**
- Largeur : 1800–2400px
- Poids cible : < 500 Ko (utilisez [Squoosh](https://squoosh.app))

### 4. Navigation (`_config.yml`)

```yaml
navigation:
  - title: "Galerie"
    url: "/"
  - title: "À propos"
    url: "/about/"
  - title: "Contact"
    url: "/contact/"
```

### 5. Formulaire de contact

Le fichier `contact.md` utilise [Formspree](https://formspree.io) (gratuit).

1. Créez un compte sur formspree.io
2. Créez un formulaire et copiez votre ID
3. Remplacez `YOUR_FORM_ID` dans `contact.md`

---

## Déploiement sur GitHub Pages

### Méthode automatique (recommandée)

Le workflow GitHub Actions (`.github/workflows/deploy.yml`) déploie automatiquement
à chaque push sur `main`.

1. Créez un dépôt GitHub nommé `username.github.io`
2. Activez GitHub Pages : **Settings → Pages → Source → GitHub Actions**
3. Poussez votre code :

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/username/username.github.io.git
git push -u origin main
```

Votre site sera disponible sur `https://username.github.io` après ~2 minutes.

### Dépôt projet (sous-dossier)

Si vous utilisez un dépôt nommé `portfolio` (pas `username.github.io`) :

```yaml
# _config.yml
baseurl: "/portfolio"
url: "https://username.github.io"
```

---

## Structure des fichiers

```
portfolio/
├── _config.yml          ← Configuration principale
├── _layouts/
│   ├── default.html     ← Layout de base
│   └── photo.html       ← Page détail photo
├── _includes/
│   ├── header.html
│   └── footer.html
├── _sass/               ← Styles (SCSS)
├── _photos/             ← Vos photos (fichiers .md)
├── assets/
│   ├── css/main.scss
│   ├── js/main.js
│   └── images/          ← Vos fichiers images
├── index.html           ← Page galerie
├── about.md             ← Page à propos
├── contact.md           ← Page contact
└── Gemfile
```

## Licence

MIT — libre d'utilisation et de modification.
