# CLAUDE.md

Ce fichier fournit des instructions à Claude Code (claude.ai/code) pour travailler dans ce dépôt.

## Stack

Site statique Jekyll 4.3 (Ruby/Bundler), Dart Sass, JS vanilla (champs privés ES2022). Aucune dépendance Node en développement — terser s'exécute uniquement en CI via `npx --yes`.

## Commandes

```bash
# Installer les dépendances
bundle install

# Serveur de développement avec rechargement automatique
bundle exec jekyll serve --livereload

# Normaliser les photos si un JPEG dépasse 4K (optionnel — covers exclues)
bash bin/normalize.sh

# Build de production (génère les WebP puis compile)
bash bin/build-webp.sh && JEKYLL_ENV=production bundle exec jekyll build
```

## Architecture

### Modèle de contenu — `_series/`

`_series/*.md` est la source unique de vérité. Chaque fichier déclare `title` et une liste ordonnée `photos:` (noms de fichiers sans extension). Le slug du nom de fichier devient l'identifiant de la série utilisé dans les templates et le JS. Ajouter un fichier ici génère automatiquement un bouton de filtre, sans autre configuration.

### Flux de données : Liquid → JSON → JS

Jekyll ne peut pas transmettre de données complexes au JS à l'exécution. `gallery-grid.html` intègre un bloc `<script type="application/json" id="photo-data">` que Liquid compile en données structurées. Le JS lit ce bloc à l'initialisation pour obtenir la liste complète des photos avec leurs chemins src. Ce schéma évite tout appel Ajax.

### Hiérarchie des classes JS

`Gallery` étend `EventTarget` et sert de hub central. Elle émet deux événements :
- `filterchange { visible: number[], filter: string|null, label }` — filtre appliqué (null = Tout).
- `aboutstate { active: bool, label? }` — entrée/sortie de l'état "À propos".

`Lightbox` et `FilterMobileMenu` s'abonnent à ces événements — ils ne sont jamais couplés entre eux. L'ordre d'instanciation dans `main.js` est important : `Gallery` doit être créé avant d'être passé aux autres constructeurs.

`PillScroller` est une classe autonome (pas d'accès à `Gallery`). Elle gère les flèches de défilement du sélecteur desktop (`.filter-pill-wrap__arrow--prev/next`) : visibilité pilotée par `ResizeObserver` + `scroll`, défilement de `clientWidth / 2` au clic, interception `wheel` non passive pour que la molette/trackpad scrolle la pill sans scroller la page. Elle est instanciée avant `Gallery` (pas de dépendance). La constante `BP_MD = 768` est déclarée en tête de `main.js` et partagée entre `Gallery` et `PillScroller` — ne pas dupliquer.

`Gallery.enterAbout()` est une méthode publique appelable depuis `FilterMobileMenu` (bouton "À propos" mobile). Le clic sur le bouton desktop "À propos" (`.filter-bar__about`) est bindé dans `Gallery` directement. `FilterMobileMenu` ne connaît que son propre DOM mobile.

La position de l'indicateur de la pill est mesurée après `document.fonts.ready` car `font-display: block` (intentionnel) garantit que les métriques sont stables seulement une fois les fontes chargées.

### Index global vs. index par série

Les cards sont rendues dans une boucle plate unique sur toutes les séries (triées alphabétiquement par titre), chacune recevant un `data-index` correspondant à sa position dans le tableau JSON `photo-data`. La lightbox navigue par cet index global ; `#visible` est mis à jour sur `filterchange` pour restreindre la navigation à la série courante.

Les cards portent `data-series="{{ series.slug }}"` et les boutons de filtre portent `data-series="{{ s.slug }}"` — même attribut, même valeur. Le JS lit `card.dataset.series` et `btn.dataset.series` partout.

### CSS

Point d'entrée : `assets/css/main.scss` (front matter Jekyll obligatoire). Chaque partiel commence par `@use 'variables' as *` pour accéder aux tokens sans préfixe. Convention BEM (`.gallery-card__img-wrap`, `.lightbox__nav--prev`).

Partiels SCSS et leur périmètre :
- `_base.scss` — reset + custom properties uniquement, aucun composant.
- `_layout.scss` — filter-bar desktop, pill, menu mobile, `.site-main`, `.site-footer`. (Anciennement `_header.scss` — renommé car le fichier ne contient aucun header.)
- `_cover.scss`, `_gallery.scss`, `_lightbox.scss` — composants autonomes.

Point de rupture unique : `$bp-md = 768px`. En dessous (≤ 767px) : grille 2 colonnes plein-écran, filtre en overlay mobile, navigation lightbox au glissement uniquement. Au-dessus (≥ 768px) : grille plein-écran, pill de filtre, navigation par flèches.

Variables de typographie dans `_variables.scss` : `$size-xs` (0.75rem), `$size-base` (1rem), `$size-lg` (1.5rem), `$weight-ui` (400). `$weight-ui` est le grammage de toutes les pills et labels d'interface — il s'applique partout où `text-transform: uppercase` + `letter-spacing` est utilisé. Ne pas introduire de valeur en dur.

Le sélecteur pill desktop (`.filter-pill`) a `max-width: min(52rem, 60vw)`, défile horizontalement. Les flèches (`.filter-pill-wrap__arrow`) pilotent leurs dégradés via les classes `.has-prev` / `.has-next` sur `.filter-pill-wrap`, togglées par `PillScroller#update()` — les pseudo-éléments `::before/::after` ont `opacity: 1` quand ces classes sont présentes. Ce couplage JS → CSS remplace un ancien `:has()` (incompatible Chrome < 105 / Firefox < 121). Ne pas revenir au `:has()`.

Le thème est sombre fixe. Les propriétés CSS (`--bg`, `--bg-surface`, `--border`, `--text`, `--text-muted`, `--shimmer-color`) sont déclarées dans `_base.scss` sous `:root` uniquement — pas de bascule, pas de `localStorage`.

### Partials `_includes/`

Un partial ne se justifie que s'il est inclus dans plusieurs endroits ou s'il représente un composant substantiel et autonome. Un partial à usage unique et de moins de ~20 lignes doit être inliné dans son appelant. `_includes/` contient : `head.html`, `cover.html`, `gallery-grid.html`, `lightbox.html`.

### Page `/compat/`

Variante allégée ciblant Chrome 49+, Firefox 52+, Safari 12+. Fichiers :
- `compat.html` — page Jekyll (front matter uniquement, layout `compat`)
- `_layouts/compat.html` — layout standalone, sans `head.html`
- `assets/css/compat.scss` — styles ; `@use 'base'` + `@use 'variables' as *`
- `assets/js/compat.js` — ES5 + `const`/`let` + `Array.from()`, IIFE strict

**Détection depuis le site principal (`_layouts/default.html`) :**
Script inline dans `<head>` : `new Function('class T{#x}')`. Si ça lève (syntaxe ES2022 non reconnue), `window.location.replace('/compat/')` — redirige sans créer d'entrée d'historique. Couvre Chrome < 74, Firefox < 90.

**Détection sur la page compat (`_layouts/compat.html`) :**
Script ES5 inline. Teste `IDBIndex.prototype.getAll` (Chrome 48+, Firefox 44+, Safari 12+ ; absent de Safari 11) combiné à `CSS.supports('color', 'var(--x)')`. Si le test échoue, ajoute `compat-outdated` sur `<html>` → affiche `.compat-warning`, masque le reste.

**Fontes :**
`@font-face` avec `font-weight: 400` fixe (pas de range `100 900` — non reconnu avant Chrome 66 / Firefox 62, la règle serait silencieusement ignorée). Mêmes fichiers WOFF2 que le site principal. `font-display: swap` (vs. `block` sur le principal — compat n'a pas de mesure JS dépendante des métriques fontes).

**Contraintes CSS :**
Pas de `aspect-ratio` → padding-top trick (`padding-top: 66.666%` sur `.compat-card__inner`). Pas de `inset`, `gap`, `min()`, `clamp()`, `system-ui`.

**Contraintes JS :**
Pas d'`IntersectionObserver` → lazy load via `getBoundingClientRect()` + `scroll`/`resize`. Pas de champs privés, pas de `class`. Clavier via `e.key` uniquement (pas de `e.keyCode`).

**Images :** JPEG directs (`data-src` lazy), jamais de WebP.

### Variantes d'images

Les originaux (`.jpg`) sont commités. Les variantes générées sont dans `.gitignore` :
- `photo-XX-thumb.webp` — 1200 px max, miniature grille (production uniquement)
- `photo-XX-thumb-2x.webp` — 2400 px max, miniature Retina 2× (production uniquement)
- `photo-XX.webp` — WebP pleine résolution, lightbox (production uniquement)
- `cover.webp` — 1920 px max, cover desktop standard
- `cover-2x.webp` — 3840 px max, cover desktop Retina 2×
- `cover_phone.webp` — WebP pleine résolution, cover mobile

En développement, le site utilise directement les JPEG originaux — aucune variante n'est générée. `bin/build-webp.sh` génère toutes les variantes WebP avant le build de production. Relancer le script est sans risque et idempotent (`--force` pour régénérer sans tenir compte des timestamps).

Le workflow CI (`.github/workflows/deploy.yml`) appelle `bash bin/build-webp.sh` directement — source de vérité unique. Ne pas dupliquer la logique d'optimisation inline dans le YAML. `Gemfile.lock` doit être commité (retiré du `.gitignore`) pour que `bundler-cache: true` soit efficace et les builds reproductibles.

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
