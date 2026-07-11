# Portfolio Photographique

Portfolio minimaliste en **HTML / CSS / JavaScript vanilla** — aucun framework, aucun build, aucune dépendance. Galerie masonry, visionneuse lightbox au clavier et au glissement, thème clair fixe, photos en WebP. Hébergeable tel quel sur GitHub Pages.

---

## Prise en main

Le site est entièrement statique : il suffit d'ouvrir `index.html` dans un navigateur, ou de le servir via n'importe quel serveur statique :

```bash
python3 -m http.server 4200
# → http://localhost:4200
```

Aucune étape d'installation ni de compilation.

---

## Structure

```
portfolio/
├── index.html              ← Page unique : header, grille (vide), coquille lightbox
├── css/
│   └── style.css           ← CSS natif : @font-face, custom properties, grille, lightbox
├── js/
│   └── gallery.js          ← Liste PHOTOS (source unique) + rendu grille + lightbox
├── assets/
│   ├── fonts/              ← WOFF2 auto-hébergés (Jost + Climate Crisis)
│   └── images/photos/      ← Photos de galerie (WebP), à plat
└── .github/workflows/      ← Déploiement GitHub Pages (statique, sans build)
```

---

## Ajouter une photo

Les photos sont en **WebP** (format définitif du dépôt). Pour en ajouter une :

1. Convertissez votre image en WebP et déposez-la dans `assets/images/photos/` :

```bash
cwebp -q 82 -m 6 ma-photo.jpg -o assets/images/photos/photo-10.webp
```

2. Ajoutez son nom (sans extension) dans `FILES`, en haut de `js/gallery.js` :

```js
var FILES = ['photo-01', /* … */, 'photo-10'].sort();
//                                    ↑ nouvelle photo
```

L'affichage (grille et navigation lightbox) est trié par nom de fichier. C'est la **source unique de vérité** : la grille et la lightbox se construisent toutes deux à partir de `PHOTOS`.

---

## CSS

Un seul fichier `css/style.css`, en CSS natif (custom properties, pas de préprocesseur). Convention BEM (`.gallery-card__img-wrap`, `.lightbox__nav-row`).

- **Chemins d'assets relatifs** (jamais de `/` en tête) : le site se déploie tel quel sous un sous-chemin GitHub Pages (`username.github.io/portfolio/`) sans `<base href>`.
- Point de rupture unique **768 px** : sous ce seuil, grille masonry 2 colonnes et navigation lightbox au glissement uniquement ; au-dessus, 3 à 6 colonnes et flèches.
- Thème **clair fixe** — couleurs exposées en custom properties sous `:root` (`--bg`, `--bg-surface`, `--text`, `--text-muted`, `--shimmer-color`).
- Fontes **auto-hébergées** (`font-display: block`).

---

## Déploiement — GitHub Pages

1. **Settings → Pages → Source → GitHub Actions**.
2. Poussez sur `main` : le workflow `.github/workflows/deploy.yml` assemble les fichiers servis (`index.html`, `css/`, `js/`, `assets/`) dans `_site/` et les publie — **aucun build**. Les chemins étant relatifs, aucun `--base-href` n'est nécessaire.

Le site fonctionne à la racine d'un domaine (`username.github.io`) comme sous un sous-chemin (`username.github.io/portfolio/`), sans ajustement.
