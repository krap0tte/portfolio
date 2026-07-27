# CLAUDE.md

Ce fichier fournit des instructions à Claude Code (claude.ai/code) pour travailler dans ce dépôt.

## Stack

Site généré par **Zola** (générateur de site statique en Rust, binaire unique, templating Tera). Pas de Node, pas de `npm`, pas de `package.json` — la seule dépendance de développement est le binaire `zola` lui-même. Déploiement GitHub Pages en **sous-chemin** (dépôt projet, pas `username.github.io`) — géré nativement par Zola via `base_url` dans `config.toml` (voir la section CSS/templates sur les chemins).

Passé du site : HTML/CSS/JS vanilla fait main (single-page) → Jekyll avant ça. Le retour à un SSG est motivé par l'introduction de catégories (plusieurs pages) et la préparation d'un futur contenu éditorial — pas par un abandon de la simplicité : aucun thème tiers, tout le HTML/CSS/JS métier reste écrit à la main.

## Commandes

```bash
zola build     # génère public/
zola serve     # sert en local avec live-reload, → http://127.0.0.1:1111
```

Pas de test à lancer.

## Architecture

### Modèle de contenu — `data/photos.toml`

`data/photos.toml` est la source unique de vérité des photos : **régénéré entièrement** par `bin/add-photo.sh` depuis un scan de `static/assets/images/photos/`, jamais édité à la main. Une seule structure : `[[series]]`, un bloc par série (`slug` + `latest` + `photos`, triés par nom de fichier croissant ; les templates inversent pour afficher les plus récentes en premier).

Le fichier a porté une liste plate `all` (`{ kind, slug, file }`, toutes photos et tous classements confondus). Elle a disparu avec le second axe : `kind` était le segment de chemin qui distinguait catégories et séries, et aucun template ne lisait `all`.

`latest` = le **nom de fichier le plus récent** du dossier. Le modèle ne porte aucune date (arbitrage utilisateur), or l'accueil doit classer les séries par récence : celle-ci est donc dérivée des noms de fichiers, qui sont datés — même convention que le tri décroissant déjà utilisé partout ailleurs. Tri Tera : `data.series | sort(attribute="latest") | reverse`, puis jointure sur `section.pages | filter(attribute="slug", …)` pour récupérer titre/permalien/couverture.

Les templates lisent ce fichier via `load_data()`. **Chaque page embarque TOUTES les séries** — pas seulement la sienne — dans un `<script id="series-data" type="application/json">`, sous la forme `{slug, title, url, hero, photos:[{full, thumb, thumb2x}]}`. C'est ce qui permet au JS de basculer d'une série à l'autre sans requête. La construction est faite au build, jamais côté client.

### Les séries — seul type de contenu, un dossier = une série

Le rattachement d'une photo se fait **par emplacement de fichier**, jamais par métadonnée par photo. L'arborescence est **plate** : plus de segment d'axe, ni dans les chemins ni dans les URLs.

```
static/assets/images/photos/<slug>/   ↔  content/<slug>.md   →  /<slug>/
```

Le site a porté un **second axe** — des « catégories », bacs thématiques nus sans texte d'intro, servies sous `/categories/<slug>/`. L'utilisateur les a **retirées, photos comprises** (2026-07-27), faute de direction éditoriale lisible entre les deux, puis a fait aplatir l'arborescence. Ne pas les réintroduire, ni proposer un modèle imbriqué « série ⊂ catégorie », sans redemander. Les photos supprimées restent récupérables dans l'historique git.

**Un seul champ image** (`[extra] hero`, valeur = nom de fichier sans extension, dans le dossier de la série) : la **couverture pleine fenêtre** (`100svh`), donc cadrage **paysage** attendu — un portrait s'y réduit à une bande horizontale sur desktop.

Il y en a eu **deux**, délibérément découplés parce que leurs contraintes de cadrage s'opposaient : `cover` alimentait une vignette recadrée en `aspect-ratio: 3/2` (un portrait y passait bien) et `hero` la couverture plein écran. Les vignettes ont disparu avec les cartes puis la mosaïque, et `cover` a été retiré partout (front matter, garde-fou du script, documentation). **Si un affichage en vignette revient un jour, le conflit de cadrage revient avec lui** : sur le corpus actuel, près de la moitié des photos sont en portrait, et c'est précisément ce qui avait motivé la séparation. Ne pas réutiliser `hero` pour une vignette sans y penser.

Le site a eu sa **propre** couverture d'accueil (`config.extra.hero`, pointant `static/assets/images/hero.webp`, hors de `photos/`), convertie et exigée par `bin/add-photo.sh`. Elle a été **retirée** quand l'accueil est devenu une vue de série : image, champ de configuration et garde-fou. `bin/add-photo.sh` ne convertit donc plus rien hors de `photos/`.

Une série est un **corpus éditorial** : sa page s'ouvre sur une couverture pleine fenêtre et son `.md` porte un **texte d'intro** (le corps Markdown, rendu via `page.content`) affiché entre la couverture et la grille. Volontairement **pas** de date ni de légendes par photo (arbitrage utilisateur : les légendes casseraient le modèle « aucune métadonnée par photo » ; pour la date, voir `latest` plus haut).

**Il n'existe pas de page d'index des séries** : l'accueil *est* une série — la plus récente. On passe de l'une à l'autre par les liens Précédente/Suivante, sans page intermédiaire. Les séries sont les pages de la **section racine** (`content/_index.md`, rendue par `index.html`), qu'`index.html` atteint par `section.pages` et `partials/serie.html` par `get_section(path="_index.md")`. Le montage antérieur (une section `series/` en `render = false`, énumérable via `get_section()` mais ne produisant aucune page) a disparu avec l'aplatissement ; c'est le mécanisme Zola à connaître si le besoin « énumérer sans afficher » revient.

Un `.md` de série ne déclare **pas** de `template` : `page.html` est le gabarit par défaut de Zola pour une page.

Créer une série = ajouter son fichier de contenu **avant** de déposer des photos dans le dossier correspondant.

**L'appariement est vérifié dans les deux sens** par `bin/add-photo.sh` : un dossier de photos sans `.md`, **et** un `.md` sans dossier de photos (le second manquait, d'où un renommage à moitié fait resté silencieux). Corollaire important côté templates : puisque le flux documenté crée le `.md` avant les images, **une série sans photo est un état légitime et le build doit le tolérer**. Partout où l'on rapproche `data/photos.toml` et les pages de contenu, on boucle donc sur le résultat du `filter` plutôt que sur `| first` — une correspondance absente est sautée, pas déréférencée. Cela vaut partout dans `partials/serie.html` : résolution des voisines, liste JSON, textes d'intro. Sans cela, `zola build` échoue sur un `Variable ... not found in context` peu parlant.

### Résolutions servies — plein écran vs miniature

**Règle : tout ce qui n'occupe pas l'écran entier est servi en miniature.** Trois variantes par photo, produites par `bin/add-photo.sh` et rangées **à côté** de la pleine résolution (convention héritée du pipeline d'origine, `bin/build-webp.mjs`, supprimé au passage au vanilla) :

| Fichier | Côté long | Versionné | Sert à |
|---|---|---|---|
| `<slug>/<nom>.webp` | résolution d'origine | oui | lightbox et couvertures (`.hero__img`) — plein écran |
| `<slug>/thumbs/<nom>.webp` | 1200 px | **non** | grille masonry, densité 1x |
| `<slug>/thumbs/<nom>-2x.webp` | 2400 px | **non** | même usage, densité 2x (via `srcset`) |

Les miniatures sont **dérivées, donc ni versionnées ni écrites à la main** : `.gitignore` sur `/static/assets/images/photos/*/thumbs/`, et `bin/build-thumbs.sh` les (re)construit — en local comme au déploiement. Conséquence à connaître : **après un clone frais, `zola serve` affiche des images cassées tant que `bin/build-thumbs.sh` n'a pas tourné.** C'est le prix assumé de ne pas versionner 8,5 Mo de dérivées.

Le sous-dossier `thumbs/` n'est pas cosmétique : un glob `*.webp` ne descend pas dans les sous-dossiers, donc les parcours de dossiers de `bin/add-photo.sh` ignorent les miniatures **sans avoir à les filtrer**. Une version antérieure les posait à côté des photos (`<nom>-thumb.webp`) et devait les écarter partout via un prédicat `is_thumb()` — supprimé avec le déplacement.

**La pleine résolution n'est pas plafonnée** : un plafond à 4000 px a existé puis a été retiré (arbitrage utilisateur du 2026-07-27 — sur le corpus réel, toutes les photos font déjà 4000 px sur le grand côté, l'étape ne faisait donc jamais rien). Conséquence assumée : le poids de la variante pleine résolution dépend entièrement de ce qui est déposé. Ce sont les miniatures qui portent l'optimisation, pas un plafonnement de la source.

Consommation : le JSON embarqué porte `{full, thumb, thumb2x}` par photo, `gallery.js` pose `srcset` + `sizes` sur les images de grille. La couverture d'une série n'a **pas** de miniature — elle est plein écran par définition, et c'est la pleine résolution qui est servie.

**Piège d'entretien** : les valeurs de `sizes` (`data-grid-sizes` sur `.gallery-grid__container`, posé par `partials/serie.html`) décrivent la largeur réellement occupée par l'image à chaque palier. Elles doublent donc les points de rupture du CSS — modifier le nombre de colonnes d'une grille sans toucher au `sizes` correspondant fait télécharger la mauvaise variante, sans que rien ne casse visiblement.

### Deux scripts — `bin/add-photo.sh` et `bin/build-thumbs.sh`

Séparés parce qu'ils ont deux appelants et deux natures :

- **`bin/build-thumbs.sh`** — pur calcul dérivé : lit les photos, écrit `thumbs/`, supprime les miniatures orphelines. **Ne mute aucun contenu** (ne supprime pas de source, ne touche pas à `data/photos.toml`). C'est ce qui le rend lançable au déploiement : un déploiement n'a pas à réécrire un fichier versionné ni à effacer des sources.
- **`bin/add-photo.sh`** — outil auteur : garde-fous, conversion des sources déposées (qui les **supprime**), régénération de `data/photos.toml`. Il appelle `build-thumbs.sh` à l'étape 2, pour que l'auteur garde un seul geste.

Une seule implémentation des miniatures, deux appelants. Ne pas dupliquer la logique dans le workflow.

### Ajouter des photos — `bin/add-photo.sh`

Outil auteur de **synchronisation** (jamais servi au visiteur, hors déploiement). On dépose les images dans le dossier de la série concernée, `static/assets/images/photos/<slug>/`, puis :

```bash
bin/add-photo.sh   # aucun argument : scanne les dossiers et synchronise
```

Ce qu'il fait, en quatre temps :

0. **Inventaire** : les dossiers de premier niveau de `photos/` sont relevés — chacun est une série. Le sous-dossier `thumbs/` est hors d'atteinte, il est d'un niveau plus bas. Le garde-fou qui rejetait les dossiers « hors axe » a disparu avec le second axe ; un reliquat d'ancienne arborescence (un dossier `series/` ou `categories/` d'un vieux clone) est désormais attrapé par le contrôle d'appariement, qui le signalera comme une série sans contenu.
1. **Sources non-webp** (JPG/PNG/TIFF déposés) → converties en WebP (`cwebp -q 82 -m 6`), **EXIF retiré** (`-metadata none`), **résolution d'origine conservée** ; **la source est ensuite supprimée** (le dépôt ne garde que le WebP). Rien n'est plus converti hors de `photos/`.
2. **Appariement**, vérifié dans les deux sens : chaque dossier `<slug>/` doit avoir son `content/<slug>.md` **et réciproquement** ; le `.md` doit y déclarer un `hero` existant. Échoue sinon avec la liste de ce qui est mal apparié (`check_photo_field()` factorise le contrôle des champs pointant une photo). Le sens 2 saute `_index.md`, qui est la section racine et non une série.
3. **Miniatures** → délégué à `bin/build-thumbs.sh` (voir plus haut) : régénérées si absentes ou plus anciennes que leur photo, supprimées si leur photo disparaît. Seul endroit où l'on redimensionne encore (`resize_args()`).
4. **`data/photos.toml`** est régénéré intégralement depuis les dossiers présents (un bloc `[[series]]` par dossier), et le script indique s'il était **déjà à jour** ou s'il a été **mis à jour**.

**L'ordre 1 → 2 est un invariant, ne pas l'inverser.** Les contrôles exigent des `.webp` ; c'est la conversion qui les produit. Quand ils passaient en premier, le flux documenté (créer le `.md`, déposer des JPG, lancer le script) échouait systématiquement sur une couverture « introuvable » que la conversion allait créer juste après — impasse dont on ne sortait qu'en convertissant une image à la main.

Idempotent : relancé sans nouveau fichier ni WebP hors-format, il ne change rien. Dépend de `cwebp` **et** `webpinfo` (paquet `webp`).

**Piège bash à ne pas réintroduire** : un motif sans métacaractère (`"$base".jpg`) n'est **pas** soumis à l'expansion de chemins — donc ni `nullglob` ni `nocaseglob` ne s'y appliquent, et le mot est passé littéralement même si le fichier n'existe pas. Il faut globber sur le **dossier** (`"$dir"/*.jpg`) puis filtrer sur le nom de base. Le code qui l'avait rencontré (la conversion de la couverture d'accueil, cherchée par nom) a disparu avec elle ; la règle vaut pour tout futur traitement d'un fichier unique désigné par son nom.

### Templates Tera — `templates/`

**Le site est un single-page** : `/` affiche la série la plus récente, `/<slug>/` une série donnée, et les deux rendent **exactement le même HTML** pour une même série. C'est cette identité qui permet au JS d'échanger l'une pour l'autre sans rechargement — et au site de rester utilisable sans JS, chaque URL étant réellement générée.

- **`partials/serie.html`** — **toute la vue**, header compris : navigation entre séries, couverture, intro, grille, coquille lightbox, JSON des séries, `<template>` des intros. Attend `serie` dans le contexte. C'est le seul endroit où la vue est décrite ; `index.html` et `page.html` ne font que choisir la série et l'inclure. Le header y vit (et non dans `base.html`) parce qu'il porte la navigation, qui dépend de la série courante.
- **`base.html`** — réduit à l'enveloppe du document : `<head>`, `<body>`, un bloc `body`, le `<script src>`. Plus de bloc `main`/`intro`/`photos`/`scripts` : il n'y a plus qu'une seule vue, ces points d'extension n'avaient plus d'objet.
- **`index.html`** — choisit la série la plus récente (`sort(attribute="latest") | reverse`) et inclut le partial. **Le `break` est conditionné à `{% if serie %}`** : un dossier de photos plus récent que tous les autres mais pas encore apparié à son `.md` — l'état transitoire du flux documenté — arrêtait sinon la boucle sur lui et rendait un accueil **totalement vide**, sans que le build échoue. On saute désormais à la série suivante. Publier une nouvelle série ne demande donc aucune intervention : elle devient l'accueil dès que son `.md` et son dossier concordent.
- **`page.html`** — passe `page` au partial. Deux lignes utiles.

**Piège Tera rencontré ici, à ne pas réintroduire** : dans une boucle imbriquée, `loop` désigne la boucle **la plus proche**. Le JSON des séries était séparé par `{% if not loop.last %},{% endif %}` à l'intérieur d'un `filter` d'un seul élément — `loop.last` y était donc toujours vrai, aucune virgule n'était émise, et le JSON devenait invalide **dès la deuxième série**. Symptôme trompeur : aucune erreur de build, aucune erreur console, mais grille vide et navigation qui recharge la page (le JS lisait un tableau vide). Les séparateurs viennent maintenant d'un drapeau `set_global`, juste même quand une série est sautée.

**`.series-intro` et les deux liens de navigation sont TOUJOURS dans le DOM**, l'attribut `hidden` faisant la différence. Les rendre conditionnellement les faisait manquer au DOM dès que la série servie au chargement n'avait ni intro ni voisine — et le JS ne pouvait alors plus jamais les faire apparaître en basculant de série. C'est le même piège deux fois ; toute zone que le JS peut avoir à révéler doit être rendue puis masquée, jamais omise.

**Les textes d'intro ne sont pas dans le JSON** mais dans des `<template data-serie-intro="<slug>">`. Y mettre du HTML obligeait à neutraliser `</script>` à la main, et l'échappement de Tera ressortait littéralement dans la page (`<\/p>` visible à l'écran). Du HTML dans du HTML : le navigateur fait le travail, `<template>` garantit que rien n'est rendu ni chargé avant que le JS n'y touche.

**La grille de photos est rendue au build**, pas en JavaScript. Ce n'est pas cosmétique : le scanner de préchargement du navigateur ne voit que le HTML, il lance donc les téléchargements des miniatures avant même d'avoir analysé le CSS et le JS — ce qu'il ne peut pas faire pour des images créées par script. `loading="lazy"` et `srcset` redeviennent natifs, et la page reste complète sans JS (chaque série ayant sa vraie page, on navigue par rechargement). Conséquences côté `gallery.js` : voir la section suivante — délégation d'événement, test de `img.complete`, et `renderGrid()` réservée aux bascules.

La valeur de `sizes` est posée **une seule fois**, en `data-grid-sizes` sur `.gallery-grid__container`, et relue par le JS. Elle double déjà les points de rupture du CSS ; l'écrire en plus dans le script en aurait fait une troisième copie à garder en phase.

Il n'existe **pas** de `list.html` : la seule section est la racine, rendue par `index.html`.

### `static/js/gallery.js`

Un seul fichier, encapsulé dans une IIFE (`'use strict'`), chargé via `<script src>` classique (pas `type="module"`, pour rester ouvrable en `file://`). Quatre responsabilités :

- **`renderGrid()` / `watchImages()` / `wireGrid()`** — la grille. **Le rendu initial vient du template, pas du JS** (voir plus bas) ; `renderGrid()` ne sert plus qu'aux bascules de série et n'est donc **pas** appelée à l'amorçage — la rejouer détruirait un DOM identique et annulerait les téléchargements déjà lancés. Elle relit `data-grid-sizes` sur le conteneur plutôt que de porter sa propre copie des paliers. `watchImages()` lève le shimmer : elle teste `img.complete` **avant** de poser des écouteurs, parce qu'une image rendue par le template peut avoir fini de charger avant l'exécution du script — plus aucun `load` ne serait alors émis et la carte resterait bloquée sous le shimmer. `wireGrid()` ouvre la lightbox par **délégation** sur le conteneur : un seul écouteur, qui couvre indifféremment les cartes du template et celles regénérées.
- **`lightbox`** (IIFE fermée) — `init()` sort immédiatement si `.lightbox` est absent, comme `renderGrid()` le fait pour son conteneur : sans cette garde, une page chargeant `gallery.js` sans la coquille lightbox faisait échouer **tout** le script (grille et header compris). Vider le bloc `scripts` sur les pages sans galerie reste souhaitable — c'est une optimisation, plus une obligation. Pour le reste, visionneuse : navigation par index sur `PHOTOS` (modulo `PHOTOS.length`, **relu à chaque usage** : il n'y a plus de `TOTAL` figé, puisque `PHOTOS` change quand on bascule de série), swipe tactile, clavier, focus trap, dimensionnement DPR, loader. `navTimeout` (nav clic/clavier) et `swipeTimeout` (nav swipe) sont annulés ensemble via `clearTimeouts()` dès qu'une nouvelle navigation démarre — sinon un swipe suivi d'un clic sur une flèche fait cohabiter deux mises à jour de `current`. `isOpen()` est dérivé de la classe DOM `is-open`, pas un champ à synchroniser. Écouteurs touch en `{ passive: true }`. La coquille HTML de la lightbox est statique dans `templates/partials/serie.html` ; le JS ne fait que la câbler (`init()` requête les éléments, `bind()` pose les écouteurs). `closeIfOpen()` est exposée pour la bascule de série — changer de série la visionneuse ouverte la laisserait sur les photos de l'ancienne.
- **`serieNav`** (IIFE fermée) — la bascule de série sans rechargement. Lit `#series-data` et `#series-current`, échange couverture / titre / `<title>` / intro / grille, met à jour les deux liens, pousse la nouvelle URL (`pushState`) et écoute `popstate`. Les liens Précédente/Suivante restent de **vrais liens** vers des pages réellement générées : le clic est intercepté (`preventDefault`), mais sans JS — ou si `SERIES` fait moins de deux entrées — ils rechargent normalement. Les modificateurs clavier (Ctrl/Cmd/Maj, clic non gauche) ne sont pas interceptés, pour que « ouvrir dans un nouvel onglet » marche — test mutualisé dans `isPlainClick()`, partagé avec la délégation de la grille. Le rapprochement URL → série sur `popstate` compare des **`pathname` normalisés** (`indexOfPath()`), pas des suffixes de chaînes : deux slugs dont l'un se termine comme l'autre se confondraient. Les deux liens sont **toujours dans le DOM**, l'attribut `hidden` faisant la différence : le rendu serveur pose déjà le bon état, le JS n'a qu'un attribut à basculer plutôt que des nœuds à créer.
- **`wireScrollDown()`** — le chevron sous le titre défile en douceur jusqu'au texte d'intro, ou jusqu'à la grille si la série n'en a pas.
- **`wireHeader()`** — la marque est un vrai lien vers l'accueil ; si on y est déjà, le clic est intercepté pour un `scrollTo` doux plutôt qu'un rechargement.

`trapTabFocus()` est une fonction locale à `gallery.js` (piège du focus Tab/Shift+Tab dans la lightbox). S'il fallait un jour un second modal, l'extraire plutôt que la redupliquer.

Contrôles de la lightbox en liens texte (pas de boutons icônes/cercles, pas de compteur, pas de scrim sombre) fixés en bas à gauche : « Précédent / Suivant » (masqué sous 768 px, swipe uniquement) et « Grille » (ferme la visionneuse, seul contrôle toujours visible). Fond de la visionneuse = `var(--bg)`, aligné sur le thème clair du site.

Règle générale : les chorégraphies d'animation, mesures DOM et gestion du focus sont impératives — c'est un choix assumé, hérité du portage depuis Angular ; ne pas chercher à les « abstraire » prématurément.

### SCSS — `sass/css/`

Sass compilé par **Zola lui-même** (compilateur intégré au binaire, activé par `compile_sass = true` dans `config.toml` — sans quoi `sass/` est ignoré **en silence** et le site sort sans feuille de style). Toujours pas de Node : le passage au préprocesseur n'ajoute aucune dépendance.

`sass/css/style.scss` ne contient **que des `@use`** ; tout le CSS vit dans les partials. L'ordre des `@use` est l'ordre d'émission, donc **l'ordre de cascade** : `fonts` → `theme` (`:root`) → `reset` → `header` → `hero` → `series` → `gallery` → `lightbox`.

**L'emplacement `sass/css/` n'est pas cosmétique.** Zola calque l'arborescence de `sass/` sur la racine de `public/` : un `sass/style.scss` sortirait en `/style.css` et casserait deux choses d'un coup — le `get_url(path="css/style.css")` de `base.html`, et les `url('../assets/fonts/…')` des `@font-face`, résolues depuis l'emplacement de la feuille **compilée**. Le sous-dossier `css/` préserve l'URL de sortie à l'identique, donc rien d'autre n'a bougé lors de la migration.

**`_breakpoints.scss` ne produit aucun CSS** et n'est donc **pas** dans les `@use` de `style.scss` — il est importé par les partials qui s'en servent. Il porte les variables (`$bp-md` 768px, puis 1024/1280/1600/2000) et deux mixins, `from($bp)` et `below($bp)`. `below()` n'a qu'un appel (les flèches de lightbox sous 768 px) mais existe pour que la borne `max-width` reste le complément **calculé** du `min-width` — écrite à la main, 767px serait une seconde constante à garder en phase.

Un second partial sans CSS a existé, `_type.scss`, portant un mixin `title-display` partagé par le titre de série et le libellé de catégorie. Il est **revenu dans `_hero.scss`** avec le retrait des catégories : un mixin à un seul appelant n'est plus qu'une indirection. Ne rétablir un partial de tokens que si un second porteur apparaît.

Le corps du titre de couverture (`.hero__title`) est borné **par la hauteur autant que par la largeur** : `clamp(2rem, min(6vw, 9svh), 4.5rem)`, précédé du même `clamp` en `9vh` comme repli. Un plafond en `6vw` seul dépendait de la seule largeur — sur une fenêtre courte (mobile en paysage) le titre passait sur deux lignes et dépassait par le haut le voile de `.hero::after`, qui ne couvre que 35 % de la couverture : titre blanc sur photo nue. Mesuré après correction sur mobile en paysage (844 × 390) : une ligne, 106 px de haut contre 136 px de voile. Le garde-fou reste imparfait pour un titre de série très long ; c'est le voile qu'il faudrait alors approfondir.

La sortie de Zola est **minifiée** (une seule ligne, commentaires supprimés) : ne pas comparer `public/css/style.css` à une source au diff textuel. Pour prouver une équivalence après remaniement, compiler la version de référence par le même compilateur (la poser en `sass/css/reference.scss`, builder, differ les deux sorties, supprimer).

Pas de nesting concaténant : les sélecteurs BEM restent écrits en toutes lettres, `&__img` les rendrait non-greppables. Pas de variables Sass pour les couleurs non plus — les custom properties sont résolues au runtime, une variable Sass serait un recul.

**Couverture pleine fenêtre (`.hero`)** : `height: 100svh` avec repli `100vh` (le `svh` évite le saut dû à la barre d'adresse mobile). Toute page du site s'ouvre dessus, l'accueil comme une série à son URL propre. Le header ne peut pas rester dans le flux au-dessus d'une image plein écran : il est en `position: absolute` par-dessus, marque en blanc. Ces règles ont vécu sous un sélecteur `.has-hero .site-header`, avec la classe posée sur `<body>`, du temps où des pages sans couverture existaient. Toutes les pages en ayant une désormais, la classe ne discriminait plus rien : elle a été **retirée** et les règles repliées dans `.site-header` (`_header.scss`). Rétablir le crochet si une page sans couverture réapparaît.

**Header à trois emplacements** — série plus ancienne à gauche, marque au centre, série plus récente à droite. Grille à trois colonnes explicites et non un `space-between` : les liens disparaissent aux extrémités de la chronologie, et un `space-between` décentrerait alors la marque. **Ne pas déclarer de `display` sur `.site-header__nav`** : ce sont les seuls éléments du site dont l'affichage repose sur l'attribut `hidden`, qu'un `display` explicite annulerait.

**Bas de couverture (`.hero__bottom`)** — titre puis chevron d'invite au défilement, empilés. C'est ce bloc qui porte le positionnement absolu ; `.hero__title` ne s'occupe plus que de typographie. Le chevron est dessiné en CSS (deux bordures tournées à 45°) plutôt qu'en icône — pas de fichier à charger pour deux traits — et son balancement est coupé sous `prefers-reduced-motion`.

Le composant `.mosaic` (accueil en mosaïque plein écran) et, avant lui, `.cover-card` / `.card-grid` (grille de cartes) ont été **supprimés** : l'accueil est devenu une vue de série. Leur enseignement reste valable si une grille d'images plein écran revient — une image est un élément remplacé, sa taille intrinsèque dicte la hauteur de sa ligne flex ; il faut la sortir du flux (`position: absolute; inset: 0`), un `height: 100%` ne suffisant pas puisque le pourcentage se résout contre un parent de hauteur indéfinie.

Convention BEM (`.gallery-card__img-wrap`, `.lightbox__nav-row`).

**Chemins d'assets dans les templates : racine-absolus via `get_url()`, pas de chemins relatifs à la main.** Contrairement à l'ère single-page (chemins toujours relatifs), plusieurs pages existent désormais à des profondeurs d'URL différentes (`/` et `/<slug>/`) — un chemin relatif comme `css/style.css` casserait depuis une page de série. `get_url(path="...")` résout correctement en tenant compte de `base_url` (`config.toml`), qui pointe déjà vers le sous-chemin GitHub Pages du dépôt. Les `url()` de `@font-face` dans `_fonts.scss` restent en revanche relatives (`../assets/fonts/...`) : elles sont résolues par le navigateur depuis l'URL de la feuille de style elle-même, pas depuis la page — donc inchangées quelle que soit la page qui inclut ce CSS.

Point de rupture **principal** 768 px : c'est lui qui commande la navigation de la lightbox (en dessous, glissement uniquement, flèches masquées) et le corps des liens de navigation entre séries. **La galerie masonry ne le franchit pas** — elle a ses propres paliers, 1024/1280/1600/2000. Écart pré-existant, à connaître avant de « corriger » l'un des deux. Grille en masonry via CSS `columns` (pas `grid`) : chaque miniature garde son ratio naturel (`break-inside: avoid` sur `.gallery-card`). Compromis assumé : `PHOTOS` ne porte pas les dimensions intrinsèques, donc pas de hauteur réservée avant chargement — le shimmer peut apparaître avec une hauteur quasi nulle et la colonne se réajuste au chargement.

Thème **clair fixe** — custom properties (`--bg`, `--bg-surface`, `--text`, `--text-muted`, `--shimmer-color`) déclarées sous `:root` uniquement, pas de bascule, pas de `localStorage`. La lightbox utilise `var(--bg)`, comme le reste du site.

Fontes **auto-hébergées** dans `static/assets/fonts/` (WOFF2 variables, subsets latin/latin-ext). `font-display: block` supprime le swap de police sans reflow après coup. **Deux familles seulement** : **Climate Crisis** pour la marque du header et rien d'autre, **Jost** pour absolument tout le reste, titre de série compris. Aucune règle ne pose donc de `font-family` en dehors de `body` et `.site-header__brand`.

**Playfair Display a été introduite puis retirée le même jour** (2026-07-27) : elle a servi les titres de série, l'utilisateur ne l'a finalement pas retenue. Ses deux WOFF2 ont été supprimés avec ses `@font-face`. Ne pas la réintroduire sans demander. Si une troisième famille revient un jour, retenir de l'épisode que **sa plage de graisses conditionne le reste** : Playfair ne descendait pas sous 400 alors que le `body` est en 300, ce que le navigateur écrêtait silencieusement — il fallait déclarer `font-weight` partout où elle était posée.

**Trois réglages à ne pas « normaliser » par réflexe.** La justure de `.series-intro` est en `ch` (`max-width: 64ch`) parce qu'une justure est un nombre de signes par ligne, pas une largeur en pixels : en `rem`, doubler le corps du texte l'avait fait tomber de ~75 à ~39 signes. L'écart entre ses paragraphes est en `em` (`0.75em`) pour la même raison — en `rem` il restait figé pendant que le texte grossissait. Et `html { font-size: 100% }`, pas `16px` : même valeur par défaut, mais en pourcent le site suit le réglage de taille de police du navigateur au lieu de le neutraliser.

Le corps de `.series-intro` est lui-même **fluide** (`clamp(1.13rem, 2.5vw, 2rem)`) et non fixé à son plafond. Sur téléphone, `max-width` ne borne plus rien — c'est la fenêtre qui borne — et un 32px figé tombait à 23 signes par ligne sur six lignes : l'intro se lisait comme un titre. Défaut invisible au calcul sur desktop, trouvé en simulant l'appareil. Mesures après correction : 35 signes/ligne à 390 px de large, 70 partout au-delà.

### Déploiement — `.github/workflows/deploy.yml`

Le workflow installe le binaire Zola (téléchargement direct depuis les releases GitHub, pas d'action tierce du marketplace), **génère les miniatures** (`apt install webp` puis `bin/build-thumbs.sh`, précédés d'un `actions/cache` clé sur le hash des photos — tant qu'aucune photo ne change, l'étape ne fait rien), lance `zola build`, puis publie `public/` via `actions/upload-pages-artifact` + `actions/deploy-pages`.

**Piège d'arborescence** : le `path` du cache et le glob de `hashFiles()` décrivent la profondeur de `photos/`. L'aplatissement (retrait des catégories) les a fait passer de `photos/*/*/…` à `photos/*/…` — même correction que dans `.gitignore`, où l'oubli aurait fait entrer les miniatures dans le prochain commit. Toute reprise de l'arborescence doit repasser par ces trois globs.

**L'ordre compte** : `build-thumbs.sh` doit précéder `zola build`, qui copie `static/` tel quel dans `public/`. Sans cache, la génération coûte ~35 s pour 31 photos, en croissance linéaire — c'est la contrepartie de ne plus versionner les dérivées. `base_url` dans `config.toml` porte déjà le sous-chemin GitHub Pages, donc aucun `--base-href` à injecter au build. Pas de `npm ci`, pas de Node.

## Mémoire

À chaque session, alimenter le système de mémoire persistant (`~/.claude/projects/.../memory/`) avec les points clés, décisions d'architecture et pièges rencontrés. L'objectif est de rester cohérent d'une conversation à l'autre sans redemander ce qui a déjà été établi.

Ce qu'il faut y consigner : décisions structurantes, patterns validés, plugins ou abstractions délibérément exclus, comportements qui ont surpris ou posé problème. Ce qu'il ne faut pas y mettre : patterns dérivables du code, historique git, solutions de debug.

## Règles de comportement

### 1. Réfléchir avant de coder

**Ne pas supposer. Ne pas masquer la confusion. Exposer les compromis.**

Avant d'implémenter :
- Énoncer explicitement les hypothèses. En cas de doute, demander.
- Si plusieurs interprétations existent, les présenter — ne pas en choisir une en silence.
- Si une approche plus simple existe, le dire. Pousser en arrière si nécessaire.
- Si quelque chose est flou, s'arrêter. Nommer ce qui est confus. Demander.

### 2. La simplicité d'abord

**Le minimum de code qui résout le problème. Rien de spéculatif.**

- Aucune fonctionnalité au-delà de ce qui a été demandé.
- Pas d'abstraction pour du code à usage unique.
- Pas de « flexibilité » ou de « configurabilité » non demandées.
- Pas de gestion d'erreurs pour des scénarios impossibles.
- Si 200 lignes peuvent s'écrire en 50, réécrire.

Se demander : « Un développeur senior dirait-il que c'est trop compliqué ? » Si oui, simplifier.

### 3. Changements chirurgicaux

**Ne toucher que ce qui est nécessaire. Ne nettoyer que sa propre pagaille.**

En modifiant du code existant :
- Ne pas « améliorer » le code adjacent, les commentaires ou le formatage.
- Ne pas refactoriser ce qui n'est pas cassé.
- Respecter le style existant, même si on ferait autrement.
- Si du code mort non lié est repéré, le mentionner — ne pas le supprimer.

Quand les changements créent des orphelins :
- Supprimer les imports/variables/fonctions rendus inutilisés par ses propres changements.
- Ne pas supprimer le code mort préexistant sauf demande explicite.

Le test : chaque ligne modifiée doit se justifier directement par la demande.

### 4. Exécution orientée objectif

**Définir des critères de succès. Boucler jusqu'à vérification.**

Transformer les tâches en objectifs vérifiables :
- « Ajouter une validation » → « Écrire des tests pour les entrées invalides, puis les faire passer »
- « Corriger le bug » → « Écrire un test qui le reproduit, puis le faire passer »
- « Refactoriser X » → « S'assurer que les tests passent avant et après »

Pour les tâches en plusieurs étapes, énoncer un bref plan :
```
1. [Étape] → vérifier : [contrôle]
2. [Étape] → vérifier : [contrôle]
3. [Étape] → vérifier : [contrôle]
```

Des critères de succès solides permettent de boucler en autonomie. Des critères faibles (« faire en sorte que ça marche ») exigent des clarifications constantes.

## Complément : quelques principes de la méthode Kaizen

### 1. Se remettre en permanence en question

**Même si quelque chose fonctionne, il faut toujours chercher à l’améliorer.**

### 2. Ne pas viser la perfection mais l’amélioration continue

**La perfection sera atteinte par la répétition de petites améliorations apportées au quotidien.**

### 3. Identifier la cause originelle des problèmes pour les résoudre durablement

**Régler les symptômes d’un problème sans en rechercher l’origine vous expose à être de nouveau confronté au problème.**

### 4. Régler les problèmes sans attendre

**Il est très important de régler les problèmes dès qu’ils se posent et avant qu’ils n’empirent et que cela devienne plus compliqué et plus coûteux en temps et en énergie de les résoudre.**

### 5. Hiérarchiser les changements

**Privilégier les progrès faciles, rapides et peu coûteux à mettre en place.**
