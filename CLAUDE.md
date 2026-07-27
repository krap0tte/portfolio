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

`data/photos.toml` est la source unique de vérité des photos : **régénéré entièrement** par `bin/add-photo.sh` depuis un scan de `static/assets/images/photos/`, jamais édité à la main. Trois structures :
- `all` — liste plate de toutes les photos (`{ kind, slug, file }`), triée par nom de fichier croissant (comme l'ancien `FILES`) ; les templates l'inversent pour afficher les plus récentes en premier. `kind` vaut `"categories"` ou `"series"` — c'est **littéralement le segment de chemin**, pour que la construction d'URL reste un simple `~ p.kind ~ "/" ~ p.slug ~`, sans table de correspondance.
- `[[categories]]` — un bloc par catégorie (`slug` + `latest` + `photos`, triés pareil), utilisé par les pages `/categories/<slug>/`.
- `[[series]]` — idem pour les séries, utilisé par les pages `/series/<slug>/`.

`latest` = le **nom de fichier le plus récent** du dossier. Le modèle ne porte aucune date (arbitrage utilisateur), or l'accueil doit afficher « les trois dernières séries » : la récence est donc dérivée des noms de fichiers, qui sont datés — même convention que le tri décroissant déjà utilisé partout ailleurs. Tri Tera : `data.series | sort(attribute="latest") | reverse`, puis jointure sur `section.pages | filter(attribute="slug", …)` pour récupérer titre/permalien/couverture.

Les templates (`templates/base.html`, `templates/index.html`, `templates/categories/page.html`, `templates/series/page.html`) lisent ce fichier via `load_data()`. Les pages de galerie injectent le résultat en `window.PHOTOS` (`<script>` inline) dans la forme `{full, thumb}` attendue par `static/js/gallery.js` — la construction de la liste est faite au build, plus côté client.

### Catégories et séries — deux axes indépendants, un dossier = un classement

Le rattachement d'une photo se fait **par emplacement de fichier**, jamais par métadonnée par photo. Deux axes de **même rang, sans recouvrement** — une photo est dans une catégorie ou dans une série, jamais les deux (décision explicite de l'utilisateur : ne pas re-proposer un modèle imbriqué « série ⊂ catégorie » sans redemander) :

```
static/assets/images/photos/categories/<slug>/   ↔  content/categories/<slug>.md
static/assets/images/photos/series/<slug>/       ↔  content/series/<slug>.md
```

**Deux usages d'image, deux champs indépendants** (`[extra]`, valeur = nom de fichier sans extension, dans le dossier du classement) — ils ont été délibérément **découplés** parce que leurs contraintes de cadrage s'opposent :
- `cover` — **vignette de carte**, recadrée en `aspect-ratio: 3/2` sur l'accueil et `/series/`. Un portrait y passe très bien. Obligatoire pour les catégories **et** les séries, toutes deux présentées en cartes.
- `hero` — **couverture pleine fenêtre** (`100svh`), donc cadrage **paysage** attendu : un portrait s'y réduit à une bande horizontale sur desktop. Obligatoire pour les séries uniquement — les catégories n'ont pas de page à couverture. L'accueil a son équivalent dans `config.extra.hero`, rangé **hors de `photos/`** (`static/assets/images/hero.webp`) : la couverture du site n'appartient à aucun classement, elle n'a donc rien à faire dans un dossier de classement, et `bin/add-photo.sh` l'ignore complètement — ni conversion, ni redimensionnement, ni entrée dans `data/photos.toml`. Contrepartie : si elle est remplacée, c'est à la main (WebP, dimensions). D'où aussi sa forme de **chemin sous `static/`** et non de nom de fichier.

Ne pas re-fusionner les deux : sur le jeu de photos actuel, presque la moitié sont en portrait, et c'est précisément ce conflit qui a motivé la séparation.

Ce qui distingue catégorie et série, c'est le **statut éditorial**, pas la structure de données :
- une **catégorie** est un bac thématique nu — `/categories/<slug>/` n'affiche qu'une grille ;
- une **série** est un corpus éditorial — sa page s'ouvre sur une couverture pleine fenêtre et son `.md` porte un **texte d'intro** (le corps Markdown, rendu via `page.content`) affiché entre la couverture et la grille. Volontairement **pas** de date ni de légendes par photo (arbitrage utilisateur : les légendes casseraient le modèle « aucune métadonnée par photo » ; pour la date, voir `latest` plus haut).

**Ni `/categories/` ni `/series/` n'existent** : l'accueil liste les deux intégralement, sans limite de nombre, ce qui rend les pages d'index redondantes. Les deux `_index.md` subsistent uniquement en `render = false` — la section ne produit aucune page mais reste interrogeable via `get_section()` pour alimenter l'accueil, et ses pages enfants continuent d'être rendues. C'est le mécanisme Zola à connaître pour « une section qu'on veut énumérer sans l'afficher ».

Créer une catégorie ou une série = ajouter son fichier de contenu **avant** de déposer des photos dans le sous-dossier correspondant — `bin/add-photo.sh` refuse de synchroniser un dossier de photos sans fichier apparié, ou dont la couverture déclarée n'existe pas.

### Ajouter des photos — `bin/add-photo.sh`

Outil auteur de **synchronisation** (jamais servi au visiteur, hors déploiement). On dépose les images dans le sous-dossier concerné, sous `static/assets/images/photos/categories/<slug>/` ou `.../series/<slug>/`, puis :

```bash
bin/add-photo.sh   # aucun argument : scanne les sous-dossiers et synchronise
```

Ce qu'il fait, en quatre temps :

0. Garde-fous : tout dossier de premier niveau de `photos/` hors des deux axes est une erreur (typiquement un reliquat de l'ancienne arborescence à un seul niveau) ; chaque dossier `<axe>/<slug>/` doit avoir son `content/<axe>/<slug>.md` ; chacun (catégorie **comme** série) doit y déclarer un `cover` existant, les séries en plus un `hero` existant ; et `config.toml` un `hero` existant sous `static/`. Échoue sinon avec la liste de ce qui est mal apparié (`check_photo_field()` factorise le contrôle des champs pointant une photo). Les templates n'ont donc **pas** de repli pour une image manquante — c'est le script qui garantit l'invariant, et c'est là qu'il faut étendre ce genre de contrôle.
1. **Sources non-webp** (JPG/PNG/TIFF déposés) → converties en WebP (`cwebp -q 82 -m 6`), **EXIF retiré** (`-metadata none`), **réduites à 4000 px** sur le plus grand côté si besoin (ratio préservé, jamais d'agrandissement) ; **la source est ensuite supprimée** (le dépôt ne garde que le WebP).
2. **WebP présents** → chacun est vérifié ; s'il dépasse 4000 px il est **ré-encodé réduit sur place** (un WebP compressé ne se redimensionne pas sans ré-encodage ; en-deçà il n'est pas touché).
3. **`data/photos.toml`** est régénéré intégralement depuis les sous-dossiers présents (les deux axes confondus dans `all`, puis un bloc `[[categories]]` / `[[series]]` par dossier), et le script indique s'il était **déjà à jour** ou s'il a été **mis à jour**.

Idempotent : relancé sans nouveau fichier ni WebP hors-format, il ne change rien. Dépend de `cwebp` **et** `webpinfo` (paquet `webp`).

### Templates Tera — `templates/`

- **`base.html`** — coquille commune : `<head>`, un bloc `body_class` sur `<body>` (l'accueil et les pages de série y mettent `has-hero` — c'est le crochet qui permet au CSS de rendre le header transparent sur les seules pages à couverture pleine fenêtre), header (**marque seule** — la nav a été retirée, l'utilisateur prévoit un autre dispositif de navigation ; conséquence assumée en attendant : `/categories/` et `/series/` ne sont liées depuis nulle part), et un bloc `main` par défaut (bloc `intro` vide + grille + coquille lightbox) suivi d'un bloc `scripts` par défaut (`window.PHOTOS` + `<script src>`). Tous overridables indépendamment. Le bloc `intro` existe pour que `series/page.html` insère son éditorial **au-dessus** de la grille sans avoir à redupliquer tout le bloc `main`.
- **`index.html`** — accueil : **ce n'est plus une galerie**. Surcharge `main` (couverture **pleine fenêtre**, header compris, avec le texte de présentation = `config.description` en surimpression ; puis **toutes** les séries en cartes, de la plus récente à la plus ancienne, sur 4 colonnes (`.card-grid--lead`) ; puis **toutes** les catégories en cartes plus petites, sur 2 à 6 colonnes) et vide `scripts`. La couverture de l'accueil vient de `config.extra.hero` (chemin sous `static/`, résolu par `get_url()`), pas d'un `.md`.
- **`categories/page.html`** / **`series/page.html`** — surchargent `photos` avec le sous-ensemble de `data.categories` / `data.series` filtré sur `page.slug` (`filter(attribute="slug", value=page.slug) | first`) ; l'axe étant connu du template, il est écrit en dur dans le chemin (`photos/categories/…`, `photos/series/…`). La lightbox navigue donc par index **local** à la page affichée. Les deux surchargent aussi `intro` : `categories/page.html` pour un simple rappel du libellé au-dessus de la grille (`.category-title`, la page n'ayant pas de couverture) ; `series/page.html` pour **couverture pleine fenêtre** (`page.extra.hero`) avec le titre de la série en surimpression, puis le texte éditorial (`page.content | safe`) entre la couverture et la grille — rendu seulement s'il y en a un.
Il n'existe **pas** de `categories/list.html` ni de `series/list.html` — les pages d'index ont été supprimées (voir plus haut).

Conséquence du `scripts` vide sur l'accueil : `wireHeader()` n'y tourne pas, donc le clic sur la marque recharge la page au lieu de remonter en douceur. Sans effet visible tant que l'accueil reste court.

### `static/js/gallery.js`

Un seul fichier, encapsulé dans une IIFE (`'use strict'`), chargé via `<script src>` classique (pas `type="module"`, pour rester ouvrable en `file://`). Trois responsabilités :

- **`renderGrid()`** — génère les `<a class="gallery-card">` à partir de `PHOTOS` (fourni par le template, `window.PHOTOS`) et les injecte dans `.gallery-grid__container`. Chaque card est un lien vers l'image pleine résolution (progressive enhancement : si le JS échoue, le lien ouvre quand même l'image), dont le clic est intercepté (`preventDefault`) pour ouvrir la lightbox à l'index. Les listeners `load`/`error` sont posés **avant** d'assigner `src` (couvre le cas d'une image déjà en cache).
- **`lightbox`** (IIFE fermée) — visionneuse : navigation par index sur `PHOTOS` (modulo la longueur totale — global sur l'accueil, local sur une page de catégorie), swipe tactile, clavier, focus trap, dimensionnement DPR, loader. `navTimeout` (nav clic/clavier) et `swipeTimeout` (nav swipe) sont annulés ensemble via `clearTimeouts()` dès qu'une nouvelle navigation démarre — sinon un swipe suivi d'un clic sur une flèche fait cohabiter deux mises à jour de `current`. `isOpen()` est dérivé de la classe DOM `is-open`, pas un champ à synchroniser. Écouteurs touch en `{ passive: true }`. La coquille HTML de la lightbox est statique dans `templates/base.html` ; le JS ne fait que la câbler (`init()` requête les éléments, `bind()` pose les écouteurs).
- **`wireHeader()`** — la marque du header est un vrai lien vers l'accueil (plusieurs pages désormais). Si on est déjà sur l'accueil, le clic est intercepté (`brand.pathname === window.location.pathname`) pour un `scrollTo({ top: 0, behavior: 'smooth' })` plutôt qu'un rechargement. C'est le seul élément de header restant depuis le retrait de la nav.

`trapTabFocus()` est une fonction locale à `gallery.js` (piège du focus Tab/Shift+Tab dans la lightbox). S'il fallait un jour un second modal, l'extraire plutôt que la redupliquer.

Contrôles de la lightbox en liens texte (pas de boutons icônes/cercles, pas de compteur, pas de scrim sombre) fixés en bas à gauche : « Précédent / Suivant » (masqué sous 768 px, swipe uniquement) et « Grille » (ferme la visionneuse, seul contrôle toujours visible). Fond de la visionneuse = `var(--bg)`, aligné sur le thème clair du site.

Règle générale : les chorégraphies d'animation, mesures DOM et gestion du focus sont impératives — c'est un choix assumé, hérité du portage depuis Angular ; ne pas chercher à les « abstraire » prématurément.

### CSS — `static/css/style.css`

Un seul fichier, CSS natif. Ordre : `@font-face` → `:root` (custom properties) → reset → header → accueil → cartes de couverture → séries → grille → lightbox.

**Couverture pleine fenêtre (`.hero`)** : `height: 100svh` avec repli `100vh` (le `svh` évite le saut dû à la barre d'adresse mobile). Composant **partagé** par l'accueil (couverture du site + `config.description`) et les pages de série (couverture de la série + son titre) — d'où le nom neutre plutôt qu'un `.home-hero`. Le bas de la couverture est un emplacement unique (`.hero__text` / `.hero__title` partagent le même positionnement) : présentation sur l'accueil, titre sur une série. Le header ne peut pas rester dans le flux sur ces pages — `.has-hero .site-header` passe en `position: absolute` par-dessus, marque en blanc. C'est la seule règle du CSS conditionnée au type de page, d'où le crochet `body_class` dans `base.html` plutôt qu'un fichier ou un `<style>` à part.

`.cover-card` est **le même composant** pour les séries et les catégories (couverture recadrée en `aspect-ratio: 3/2` + `object-fit: cover`, titre en surimpression sur un voile dégradé) : deux axes de même rang se présentent pareil. Seule la densité de la grille les distingue — `.card-grid` (3 colonnes) vs `.card-grid--small` (2 → 6). Ce recadrage est délibérément l'inverse du masonry à ratios naturels de la galerie : un index doit se lire comme une liste régulière, pas comme une seconde galerie. Le voile dégradé n'est pas décoratif — le titre est posé sur une photo quelconque, il lui faut un fond garanti. Pas de préprocesseur, pas de nesting concaténant (les sélecteurs BEM sont écrits en toutes lettres). Convention BEM (`.gallery-card__img-wrap`, `.lightbox__nav-row`, `.site-header__nav-link`).

**Chemins d'assets dans les templates : racine-absolus via `get_url()`, pas de chemins relatifs à la main.** Contrairement à l'ère single-page (chemins toujours relatifs), plusieurs pages existent désormais à des profondeurs d'URL différentes (`/`, `/categories/<slug>/`, `/series/<slug>/`) — un chemin relatif comme `css/style.css` casserait depuis une page de catégorie. `get_url(path="...")` résout correctement en tenant compte de `base_url` (`config.toml`), qui pointe déjà vers le sous-chemin GitHub Pages du dépôt. Les `url()` de `@font-face` dans `style.css` restent en revanche relatives (`../assets/fonts/...`) : elles sont résolues par le navigateur depuis l'URL de la feuille de style elle-même, pas depuis la page — donc inchangées quelle que soit la page qui inclut ce CSS.

Point de rupture unique **768 px**. En dessous (≤ 767 px) : grille masonry 2 colonnes, navigation lightbox au glissement uniquement, flèches masquées. Au-dessus : grille masonry (3 à 6 colonnes selon la largeur), navigation par flèches. Grille en masonry via CSS `columns` (pas `grid`) : chaque miniature garde son ratio naturel (`break-inside: avoid` sur `.gallery-card`). Compromis assumé : `PHOTOS` ne porte pas les dimensions intrinsèques, donc pas de hauteur réservée avant chargement — le shimmer peut apparaître avec une hauteur quasi nulle et la colonne se réajuste au chargement.

Thème **clair fixe** — custom properties (`--bg`, `--bg-surface`, `--text`, `--text-muted`, `--shimmer-color`) déclarées sous `:root` uniquement, pas de bascule, pas de `localStorage`. La lightbox utilise `var(--bg)`, comme le reste du site.

Fontes **auto-hébergées** dans `static/assets/fonts/` (WOFF2, Jost + Climate Crisis, subsets latin/latin-ext). `font-display: block` supprime le swap de police sans reflow après coup.

### Déploiement — `.github/workflows/deploy.yml`

Le workflow installe le binaire Zola (téléchargement direct depuis les releases GitHub, pas d'action tierce du marketplace), lance `zola build`, puis publie `public/` via `actions/upload-pages-artifact` + `actions/deploy-pages`. `base_url` dans `config.toml` porte déjà le sous-chemin GitHub Pages, donc aucun `--base-href` à injecter au build. Pas de `npm ci`, pas de Node.

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
