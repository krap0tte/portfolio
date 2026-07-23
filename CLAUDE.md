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

`data/photos.toml` est la source unique de vérité des photos : **régénéré entièrement** par `bin/add-photo.sh` depuis un scan de `static/assets/images/photos/`, jamais édité à la main. Deux structures :
- `all` — liste plate de toutes les photos (`{ slug, file }`), triée par nom de fichier croissant (comme l'ancien `FILES`) ; les templates l'inversent pour afficher les plus récentes en premier.
- `[[categories]]` — un bloc par catégorie (`slug` + `photos`, triés pareil), utilisé par les pages `/categories/<slug>/`.

Les templates (`templates/base.html`, `templates/index.html`, `templates/categories/page.html`) lisent ce fichier via `load_data()` et injectent le résultat en `window.PHOTOS` (`<script>` inline) dans la forme `{full, thumb}` attendue par `static/js/gallery.js` — la construction de la liste est désormais faite au build, plus côté client.

### Catégories — un dossier = une catégorie

Le rattachement d'une photo à une catégorie se fait **par emplacement de fichier**, pas par métadonnée : chaque sous-dossier de `static/assets/images/photos/<slug>/` est une catégorie, appariée par convention de nom à un fichier `content/categories/<slug>.md` qui porte le libellé humain (front matter `title`) et le nom machine (nom du fichier = slug). `content/categories/_index.md` liste les catégories (`/categories/`, triées par `title`).

Créer une catégorie = ajouter `content/categories/<slug>.md` (avec `title` et `template = "categories/page.html"`) **avant** de déposer des photos dans le sous-dossier correspondant — `bin/add-photo.sh` refuse de synchroniser un sous-dossier de photos sans fichier de catégorie apparié (garde-fou contre les photos orphelines de toute catégorie).

### Ajouter des photos — `bin/add-photo.sh`

Outil auteur de **synchronisation** (jamais servi au visiteur, hors déploiement). On dépose les images dans le sous-dossier de la catégorie concernée, sous `static/assets/images/photos/<slug>/`, puis :

```bash
bin/add-photo.sh   # aucun argument : scanne les sous-dossiers et synchronise
```

Ce qu'il fait, en quatre temps :

0. Vérifie que chaque sous-dossier de `photos/` a son fichier `content/categories/<slug>.md` — échoue sinon avec la liste des catégories manquantes.
1. **Sources non-webp** (JPG/PNG/TIFF déposés) → converties en WebP (`cwebp -q 82 -m 6`), **EXIF retiré** (`-metadata none`), **réduites à 4000 px** sur le plus grand côté si besoin (ratio préservé, jamais d'agrandissement) ; **la source est ensuite supprimée** (le dépôt ne garde que le WebP).
2. **WebP présents** → chacun est vérifié ; s'il dépasse 4000 px il est **ré-encodé réduit sur place** (un WebP compressé ne se redimensionne pas sans ré-encodage ; en-deçà il n'est pas touché).
3. **`data/photos.toml`** est régénéré intégralement depuis les sous-dossiers présents, et le script indique s'il était **déjà à jour** ou s'il a été **mis à jour**.

Idempotent : relancé sans nouveau fichier ni WebP hors-format, il ne change rien. Dépend de `cwebp` **et** `webpinfo` (paquet `webp`).

### Templates Tera — `templates/`

- **`base.html`** — coquille commune : `<head>`, header (marque + nav catégories via `get_section(path="categories/_index.md")`), et un bloc `main` par défaut (grille + coquille lightbox) suivi d'un bloc `scripts` par défaut (`window.PHOTOS` + `<script src>`). Les deux sont overridables indépendamment par les templates enfants.
- **`index.html`** — accueil : hérite de `base.html`, ne surcharge que le bloc `photos` (boucle sur `load_data(path="data/photos.toml").all`, inversé).
- **`categories/page.html`** — une catégorie : surcharge `photos` avec le sous-ensemble de `data.categories` filtré sur `page.slug` (`filter(attribute="slug", value=page.slug) | first`). La lightbox navigue donc par index **local** à la catégorie affichée.
- **`categories/list.html`** — `/categories/` : surcharge `main` (liste de liens texte) et vide `scripts` (pas de grille/lightbox sur cette page, donc pas de `gallery.js`).

### `static/js/gallery.js`

Un seul fichier, encapsulé dans une IIFE (`'use strict'`), chargé via `<script src>` classique (pas `type="module"`, pour rester ouvrable en `file://`). Trois responsabilités :

- **`renderGrid()`** — génère les `<a class="gallery-card">` à partir de `PHOTOS` (fourni par le template, `window.PHOTOS`) et les injecte dans `.gallery-grid__container`. Chaque card est un lien vers l'image pleine résolution (progressive enhancement : si le JS échoue, le lien ouvre quand même l'image), dont le clic est intercepté (`preventDefault`) pour ouvrir la lightbox à l'index. Les listeners `load`/`error` sont posés **avant** d'assigner `src` (couvre le cas d'une image déjà en cache).
- **`lightbox`** (IIFE fermée) — visionneuse : navigation par index sur `PHOTOS` (modulo la longueur totale — global sur l'accueil, local sur une page de catégorie), swipe tactile, clavier, focus trap, dimensionnement DPR, loader. `navTimeout` (nav clic/clavier) et `swipeTimeout` (nav swipe) sont annulés ensemble via `clearTimeouts()` dès qu'une nouvelle navigation démarre — sinon un swipe suivi d'un clic sur une flèche fait cohabiter deux mises à jour de `current`. `isOpen()` est dérivé de la classe DOM `is-open`, pas un champ à synchroniser. Écouteurs touch en `{ passive: true }`. La coquille HTML de la lightbox est statique dans `templates/base.html` ; le JS ne fait que la câbler (`init()` requête les éléments, `bind()` pose les écouteurs).
- **`wireHeader()`** — la marque du header est un vrai lien vers l'accueil (plusieurs pages désormais). Si on est déjà sur l'accueil, le clic est intercepté (`brand.pathname === window.location.pathname`) pour un `scrollTo({ top: 0, behavior: 'smooth' })` plutôt qu'un rechargement.

`trapTabFocus()` est une fonction locale à `gallery.js` (piège du focus Tab/Shift+Tab dans la lightbox). S'il fallait un jour un second modal, l'extraire plutôt que la redupliquer.

Contrôles de la lightbox en liens texte (pas de boutons icônes/cercles, pas de compteur, pas de scrim sombre) fixés en bas à gauche : « Précédent / Suivant » (masqué sous 768 px, swipe uniquement) et « Grille » (ferme la visionneuse, seul contrôle toujours visible). Fond de la visionneuse = `var(--bg)`, aligné sur le thème clair du site.

Règle générale : les chorégraphies d'animation, mesures DOM et gestion du focus sont impératives — c'est un choix assumé, hérité du portage depuis Angular ; ne pas chercher à les « abstraire » prématurément.

### CSS — `static/css/style.css`

Un seul fichier, CSS natif. Ordre : `@font-face` → `:root` (custom properties) → reset → header → grille → catégories → lightbox. Pas de préprocesseur, pas de nesting concaténant (les sélecteurs BEM sont écrits en toutes lettres). Convention BEM (`.gallery-card__img-wrap`, `.lightbox__nav-row`, `.site-header__nav-link`).

**Chemins d'assets dans les templates : racine-absolus via `get_url()`, pas de chemins relatifs à la main.** Contrairement à l'ère single-page (chemins toujours relatifs), plusieurs pages existent désormais à des profondeurs d'URL différentes (`/`, `/categories/<slug>/`) — un chemin relatif comme `css/style.css` casserait depuis une page de catégorie. `get_url(path="...")` résout correctement en tenant compte de `base_url` (`config.toml`), qui pointe déjà vers le sous-chemin GitHub Pages du dépôt. Les `url()` de `@font-face` dans `style.css` restent en revanche relatives (`../assets/fonts/...`) : elles sont résolues par le navigateur depuis l'URL de la feuille de style elle-même, pas depuis la page — donc inchangées quelle que soit la page qui inclut ce CSS.

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
