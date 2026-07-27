# Portfolio Photographique

Portfolio minimaliste généré par **Zola** (SSG en Rust, binaire unique) — pas de Node, pas de `npm`, pas de dépendance de développement en dehors du binaire `zola`. Single-page éditorial : le site s'ouvre sur la série la plus récente (couverture pleine fenêtre, texte d'intro, galerie masonry) et on passe d'une série à l'autre sans rechargement. Visionneuse lightbox au clavier et au glissement, thème clair fixe, photos en WebP. Hébergeable tel quel sur GitHub Pages.

---

## Prise en main

```bash
bin/build-thumbs.sh   # après un clone frais : génère les miniatures (non versionnées)
zola serve
# → http://127.0.0.1:1111 (live-reload)
```

Nécessite le binaire [`zola`](https://www.getzola.org/), et le paquet `webp` (`cwebp` + `webpinfo`) pour les scripts d'images. **Les miniatures ne sont pas versionnées** : sans `bin/build-thumbs.sh`, la grille affiche des images cassées. Le déploiement les regénère de son côté.

---

## Structure

```
portfolio/
├── config.toml               ← base_url, titre, description, compile_sass
├── content/
│   ├── _index.md              ← Accueil (stub, template = "index.html")
│   └── <slug>.md              ← Une série : title, extra.hero, corps = intro
├── data/
│   └── photos.toml            ← Régénéré par bin/add-photo.sh — source unique des photos
├── sass/
│   └── css/
│       ├── style.scss          ← Uniquement des @use — compilé vers public/css/style.css
│       ├── _breakpoints.scss   ← Variables + mixins de media queries (aucun CSS émis)
│       └── _*.scss             ← Un partial par bloc : fonts, theme, reset, header, hero…
├── templates/
│   ├── base.html               ← Enveloppe du document (head, body, script)
│   ├── index.html              ← Accueil : la série la plus récente
│   ├── page.html               ← Une série à son URL propre
│   └── partials/
│       └── serie.html          ← LA vue (header, couverture, intro, grille, données)
├── static/
│   ├── js/gallery.js           ← Lightbox, bascule de série, invite au défilement
│   └── assets/
│       ├── fonts/               ← WOFF2 auto-hébergés (Jost, Climate Crisis)
│       └── images/
│           └── photos/
│               └── <slug>/       ← Photos (WebP) d'une série
│                   └── thumbs/    ← Miniatures dérivées (git-ignorées)
├── bin/
│   ├── add-photo.sh            ← Outil auteur : convertit en WebP + régénère data/photos.toml
│   └── build-thumbs.sh         ← Miniatures (non versionnées) — lancé en local ET au déploiement
└── .github/workflows/          ← Déploiement GitHub Pages (zola build)
```

---

## Les séries — seul type de contenu

Le site a **un seul type de contenu** : la série, un corpus éditorial. `/<slug>/` s'ouvre sur sa couverture en pleine fenêtre, titre en surimpression, puis le texte d'introduction et la grille masonry. `/` affiche la plus récente — même page, même HTML.

On passe d'une série à l'autre par « Précédente série » (en haut à gauche) et « Série suivante » (en haut à droite). Ce sont de **vrais liens** vers des pages réellement générées, mais leur clic est intercepté : le contenu est échangé sur place et l'URL poussée dans l'historique, sans rechargement. Sans JavaScript, ils rechargent simplement la page. Les liens disparaissent aux extrémités de la chronologie.

Un chevron sous le titre invite au défilement ; un clic mène au texte d'introduction.

**La grille de photos est rendue au build**, pas en JavaScript : le navigateur voit les `<img>` dans le HTML et lance les téléchargements sans attendre le script, `loading="lazy"` et `srcset` restent natifs, et la page est complète sans JS. Le script ne reprend la main que pour la lightbox et les changements de série.

Le site a porté un second axe (des « catégories », bacs thématiques sans texte) ; il a été retiré, avec ses photos, faute de direction éditoriale claire entre les deux. L'arborescence a été aplatie dans la foulée : plus de segment d'axe dans les chemins ni dans les URLs.

Il n'y a **pas** de page d'index des séries : on les parcourt de proche en proche depuis l'accueil.

Un seul champ d'image, `hero` (valeur = nom de fichier sans extension, dans le dossier de la série) : la couverture pleine fenêtre. **Cadrage paysage attendu** — un portrait s'y réduit à une bande horizontale sur grand écran.

Le rattachement des photos, lui, se fait par **emplacement du fichier image**, jamais par métadonnée par photo.

### Ajouter une série

Un fichier `content/<slug>.md`. Pas de `template` à déclarer : `page.html` est le gabarit par défaut de Zola pour une page. Le corps Markdown sert de texte d'intro.

```toml
+++
title = "Libellé affiché"

[extra]
hero = "2025-03-01_LE_MANS_LOTUS_08"
+++

Quelques paragraphes de contexte.
```

L'accueil n'a **pas** de couverture propre : c'est celle de la série la plus récente. Le champ `config.extra.hero` et l'image `static/assets/images/hero.webp` qui l'alimentaient ont été retirés, ainsi que le garde-fou correspondant dans `bin/add-photo.sh` — le script ne convertit plus rien hors de `photos/`.

Le nom de fichier (`<slug>.md`) est le nom machine — il doit correspondre au dossier de photos associé (`static/assets/images/photos/<slug>/`). Créer ce fichier **avant** d'y déposer des photos.

**Renommer** une série, c'est donc déplacer *deux* choses : le `.md` **et** le dossier de photos. Tant que les deux ne concordent pas, le site se construit quand même (grille vide, série absente de la navigation) mais `bin/add-photo.sh` le signale.

---

## Ajouter des photos

Les photos servies sont en **WebP** (format définitif du dépôt). Le flux : **déposer** les images (JPG/PNG/…) dans le dossier de la série concernée (`static/assets/images/photos/<slug>/`), puis lancer le script de synchronisation :

```bash
bin/add-photo.sh   # scanne les dossiers et synchronise
```

Il enchaîne, sans argument :

1. **Sources non-webp** → converties en WebP (`cwebp -q 82 -m 6`), **EXIF retiré**, **résolution d'origine conservée** ; **la source est ensuite supprimée** — le dépôt ne conserve que le WebP. Rien n'est converti hors de `photos/`.
2. Vérifie l'appariement **dans les deux sens** — chaque dossier de photos a son `content/<slug>.md` et réciproquement — et que l'image déclarée (`hero`) existe bien. Échoue sinon avec la liste de ce qui est mal apparié. Utile en particulier lors d'un **renommage** : déplacer le `.md` sans déplacer le dossier de photos (ou l'inverse) est immédiatement signalé.
3. **Miniatures** → délégué à `bin/build-thumbs.sh`, qui écrit `<slug>/thumbs/<nom>.webp` (1200 px) et `<slug>/thumbs/<nom>-2x.webp` (2400 px), régénère celles qui sont absentes ou périmées et supprime les orphelines. Tout ce qui n'est **pas** affiché en plein écran (la grille masonry) est servi via ces miniatures en `srcset` ; la pleine résolution reste pour la lightbox et les couvertures. C'est le seul redimensionnement — la pleine résolution n'est pas plafonnée, ce sont les miniatures qui portent l'optimisation.
4. **`data/photos.toml`** est régénéré intégralement depuis les dossiers présents ; le script signale s'il était déjà à jour ou l'a mis à jour. Chaque bloc `[[series]]` porte un champ `latest` (nom de fichier le plus récent du dossier) : le modèle n'ayant pas de date, c'est lui qui donne l'ordre chronologique des séries sur l'accueil.

Idempotent (relancé sans nouveau fichier, il ne change rien) et ne dépend que du paquet `webp` (`cwebp` + `webpinfo`). Jamais servi au visiteur, hors déploiement.

L'affichage (grille et lightbox) est trié par nom de fichier **décroissant** (les plus récentes en premier) : nomme tes sources en conséquence (un préfixe date `2025-03-01_…`, ou un `photo-NN` zero-paddé, trient correctement).

---

## CSS

Du **Sass**, compilé par Zola lui-même (compilateur intégré au binaire, `compile_sass = true` dans `config.toml`) — toujours aucune dépendance Node. `sass/css/style.scss` ne contient que des `@use` ; tout le CSS vit dans des partials, un par bloc. L'emplacement `sass/css/` est délibéré : Zola calque l'arborescence de `sass/` sur la racine de `public/`, c'est donc lui qui préserve l'URL de sortie `/css/style.css`. Convention BEM (`.gallery-card__img-wrap`, `.lightbox__nav-row`), pas de nesting concaténant.

- **Chemins d'assets dans les templates via `get_url()`** (racine-absolus, pas relatifs) : nécessaire dès qu'il y a plusieurs pages à des profondeurs d'URL différentes. `get_url()` tient compte de `base_url` (`config.toml`), déjà réglé sur le sous-chemin GitHub Pages du dépôt.
- Point de rupture **principal 768 px** : sous ce seuil, navigation lightbox au glissement uniquement. La galerie masonry a ses propres paliers (1024/1280/1600/2000) et reste à 2 colonnes jusqu'à 1024.
- **Header à trois colonnes explicites** (navigation, marque, navigation) et non un `space-between` : les liens disparaissent aux extrémités de la chronologie, ce qui décentrerait la marque.
- Deux fontes **auto-hébergées** (`font-display: block`) : Climate Crisis pour la marque du header, Jost pour tout le reste.
- Thème **clair fixe** — couleurs exposées en custom properties sous `:root` (`--bg`, `--bg-surface`, `--text`, `--text-muted`, `--shimmer-color`).

---

## Déploiement — GitHub Pages

1. **Settings → Pages → Source → GitHub Actions**.
2. Poussez sur `main` : le workflow `.github/workflows/deploy.yml` installe le binaire Zola et le paquet `webp`, génère les miniatures (`bin/build-thumbs.sh`, avec un cache clé sur le hash des photos), lance `zola build`, et publie `public/`.

`base_url` dans `config.toml` porte déjà le sous-chemin GitHub Pages (`https://<user>.github.io/portfolio`) — à ajuster si le dépôt est renommé ou déployé ailleurs.
