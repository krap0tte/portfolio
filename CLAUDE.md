# CLAUDE.md

Ce fichier fournit des instructions à Claude Code (claude.ai/code) pour travailler dans ce dépôt.

## Stack

Site statique en **HTML / CSS / JavaScript vanilla**. Aucun framework, aucun bundler, aucune étape de build, aucun TypeScript. Page unique rendue côté client par un unique script classique (pas de module ES). SCSS abandonné au profit de CSS natif (custom properties). Déploiement GitHub Pages en **sous-chemin** (dépôt projet, pas `username.github.io`) — d'où l'importance des chemins d'assets relatifs (voir la section CSS).

Le site n'a **aucune dépendance**, ni d'exécution ni de développement : pas de `package.json`, pas de `node_modules`. `index.html` s'ouvre directement dans un navigateur (y compris en `file://`) ou se sert via n'importe quel serveur statique.

## Commandes

```bash
# Servir le site en local (n'importe quel serveur statique fait l'affaire)
python3 -m http.server 4200        # → http://localhost:4200
```

Il n'y a **pas** de build ni de test à lancer : les fichiers servis (`index.html`, `css/`, `js/`, `assets/`) sont la source ET la sortie.

## Architecture

### Modèle de contenu — `js/gallery.js`

`PHOTOS` (dérivé de `FILES` en haut de `js/gallery.js`) est la source unique de vérité : une liste plate de photos, triée par nom de fichier. Ajouter une photo = déposer le **WebP** dans `assets/images/photos/` et ajouter son nom (sans extension) à `FILES`. L'index de position dans `PHOTOS` est celui que la lightbox utilise pour naviguer, et c'est à partir de cette même liste que la grille est générée — grille et lightbox ne peuvent donc pas diverger.

Toutes les images sont des **WebP** commités et servis directement (`assets/images/photos/photo-XX.webp`), le même fichier servant à la fois de vignette de grille et de vue pleine résolution en lightbox. Pas de pipeline, pas de variantes générées, pas de distinction dev/prod : le WebP est le format définitif du dépôt (conversion faite une fois avec `cwebp -q 82`, l'ancien `bin/build-webp.mjs` a été supprimé). Une nouvelle photo à ajouter se convertit donc manuellement (`cwebp -q 82 -m 6 photo.jpg -o photo.webp`) avant dépôt.

### `js/gallery.js`

Un seul fichier, encapsulé dans une IIFE (`'use strict'`), chargé via `<script src>` classique (pas `type="module"`, pour rester ouvrable en `file://`). Trois responsabilités :

- **`renderGrid()`** — génère les `<a class="gallery-card">` à partir de `PHOTOS` et les injecte dans `.gallery-grid__container`. Chaque card est un lien vers le JPEG pleine résolution (progressive enhancement : si le JS échoue, le lien ouvre quand même l'image), dont le clic est intercepté (`preventDefault`) pour ouvrir la lightbox à l'index global. Les listeners `load`/`error` sont posés **avant** d'assigner `src` (couvre le cas d'une image déjà en cache).
- **`lightbox`** (IIFE fermée) — visionneuse : navigation par index global sur `PHOTOS` (modulo la longueur totale), swipe tactile, clavier, focus trap, dimensionnement DPR, loader. `navTimeout` (nav clic/clavier) et `swipeTimeout` (nav swipe) sont annulés ensemble via `clearTimeouts()` dès qu'une nouvelle navigation démarre — sinon un swipe suivi d'un clic sur une flèche fait cohabiter deux mises à jour de `current`. `isOpen()` est dérivé de la classe DOM `is-open`, pas un champ à synchroniser. Écouteurs touch en `{ passive: true }`. La coquille HTML de la lightbox est statique dans `index.html` ; le JS ne fait que la câbler (`init()` requête les éléments, `bind()` pose les écouteurs).
- **`wireHeader()`** — la marque « Demo » du header remonte en haut de page (`scrollTo({ top: 0, behavior: 'smooth' })`). Pas de routage (le site n'a qu'une page) : « retour à l'accueil » = remonter en haut, pas une navigation.

`trapTabFocus()` est une fonction locale à `gallery.js` (piège du focus Tab/Shift+Tab dans la lightbox). S'il fallait un jour un second modal, l'extraire plutôt que la redupliquer.

Contrôles de la lightbox en liens texte (pas de boutons icônes/cercles, pas de compteur, pas de scrim sombre) fixés en bas à gauche : « Précédent / Suivant » (masqué sous 768 px, swipe uniquement) et « Grille » (ferme la visionneuse, seul contrôle toujours visible). Fond de la visionneuse = `var(--bg)`, aligné sur le thème clair du site.

Règle générale : les chorégraphies d'animation, mesures DOM et gestion du focus sont impératives — c'est un choix assumé, hérité du portage depuis Angular ; ne pas chercher à les « abstraire » prématurément.

### `index.html`

Page unique : `<header>` avec la marque, `<main>` contenant la `.gallery-grid` (conteneur vide, peuplé par le JS) et la coquille `.lightbox`. Pas de `<base href>` (les chemins relatifs se résolvent seuls sous un sous-chemin). Pas de `<link rel=preload>` — `font-display: block` évite déjà tout flash. Le `<script>` est en fin de `<body>` ; l'amorçage est en plus gardé par un test `document.readyState`.

### CSS — `css/style.css`

Un seul fichier, CSS natif. Ordre : `@font-face` → `:root` (custom properties) → reset → header → grille → lightbox. Pas de préprocesseur, pas de nesting concaténant (les sélecteurs BEM sont écrits en toutes lettres). Convention BEM (`.gallery-card__img-wrap`, `.lightbox__nav-row`).

**Chemins d'assets : toujours relatifs (jamais de `/` en tête).** Un chemin racine-absolu (`/assets/...`) casserait le déploiement en dépôt projet GitHub Pages (`username.github.io/portfolio/`) — ce dépôt en est un. Les `url()` de `@font-face` pointent `../assets/fonts/...` (depuis `css/` vers `assets/fonts/` à la racine).

Point de rupture unique **768 px**. En dessous (≤ 767 px) : grille masonry 2 colonnes, navigation lightbox au glissement uniquement, flèches masquées. Au-dessus : grille masonry (3 à 6 colonnes selon la largeur), navigation par flèches. Grille en masonry via CSS `columns` (pas `grid`) : chaque miniature garde son ratio naturel (`break-inside: avoid` sur `.gallery-card`). Compromis assumé : `PHOTOS` ne porte pas les dimensions intrinsèques, donc pas de hauteur réservée avant chargement — le shimmer peut apparaître avec une hauteur quasi nulle et la colonne se réajuste au chargement.

Thème **clair fixe** — custom properties (`--bg`, `--bg-surface`, `--text`, `--text-muted`, `--shimmer-color`) déclarées sous `:root` uniquement, pas de bascule, pas de `localStorage`. La lightbox utilise `var(--bg)`, comme le reste du site.

Fontes **auto-hébergées** dans `assets/fonts/` (WOFF2, Jost + Climate Crisis, subsets latin/latin-ext). `font-display: block` supprime le swap de police sans reflow après coup.

### Déploiement — `.github/workflows/deploy.yml`

Site statique : **aucun build**. Le workflow assemble les fichiers servis (`index.html`, `css/`, `js/`, `assets/`) dans `_site/` et les publie via `actions/upload-pages-artifact` + `actions/deploy-pages`. Les chemins étant relatifs, pas de `--base-href` à injecter. Pas de `npm ci`, pas de Node.

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
