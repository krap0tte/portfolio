# CLAUDE.md

Ce fichier fournit des instructions à Claude Code (claude.ai/code) pour travailler dans ce dépôt.

## Stack

SPA Angular 22 (standalone, zoneless, signals), TypeScript strict (`strict` + `strictTemplates`), SCSS global (Dart Sass). Pas de router, pas de forms, pas de SSR — page unique rendue côté client. Node ≥ 20 requis en développement. Déploiement GitHub Pages en **sous-chemin** (dépôt projet, pas `username.github.io`) — voir la section CSS pour les implications sur les chemins d'assets.

## Commandes

```bash
# Installer les dépendances
npm install

# Serveur de développement (rechargement automatique inclus)
npm start

# Normaliser les photos si un JPEG dépasse 4K (optionnel — covers exclues)
npm run normalize

# Build de production (génère les WebP puis compile)
npm run build:webp && npm run build
```

## Architecture

### Modèle de contenu — `src/app/series.ts`

`SERIES` dans `src/app/series.ts` est la source unique de vérité. Chaque entrée déclare `slug` (= nom du dossier dans `assets/images/photos/`), `title` et une liste ordonnée `photos` (noms de fichiers sans extension). Ajouter une entrée génère automatiquement un bouton de filtre, sans autre configuration. `SORTED_SERIES` trie par titre (équivalent de l'ancien `site.series | sort: "title"` Jekyll) et `PHOTOS` aplatit les séries en une liste globale indexée — l'index de position est celui que la lightbox utilise pour naviguer.

Les chemins d'images sont construits dans `series.ts` selon `isDevMode()` : JPEG originaux en développement, variantes WebP en production. C'est le seul endroit où cette distinction existe.

### État partagé : `GalleryState` (signals)

`src/app/gallery-state.ts` est le hub central — il remplace l'ancienne classe `Gallery extends EventTarget` et ses événements `filterchange`/`aboutstate`. Signals :

- `filter` (`string | null`, null = Tout) — filtre courant, seule source de vérité.
- `label` (computed) — dérivé de `filter` par lookup dans `SORTED_SERIES` ; pas de champ à synchroniser séparément. `setFilter(slug)` ne prend qu'un slug.
- `isAbout` — état « À propos » (footer plein écran).
- `lightboxIndex` (`number | null`) — demande d'ouverture de la lightbox ; remis à null à la fermeture (sinon rouvrir la même photo ne notifierait pas).
- `visible` (computed) — indices globaux des photos visibles sous le filtre courant.

L'état visuel des boutons (`is-active`, `aria-pressed`) **dérive** de `(isAbout, filter)` via `isAll()`/`isActive(slug)` — il n'y a aucune restauration manuelle d'état à la sortie d'À propos, contrairement à l'ancien JS. `setFilter()` scrolle vers le haut si on était en mode À propos.

### Composants (`src/app/`)

Tous standalone, templates inline, **aucun style par composant** — le SCSS est global et les éléments hôtes (`app-cover`, etc.) sont neutralisés par `display: contents` dans `_base.scss`, donc le CSS voit la même arborescence qu'avant la migration.

- `app.ts` (App) — composition + footer « À propos » ; possède l'`IntersectionObserver` (threshold 0.5) qui synchronise `isAbout` avec la visibilité du footer.
- `cover.ts` — splash d'entrée ; chorégraphie impérative conservée (double rAF, transitionend + fallback). Media query mobile dérivée de `BP_MD` (`constants.ts`), pas de littéral dupliqué.
- `filter-bar.ts` — barre desktop : « Tout », pill défilante, indicateur, « À propos ». Intègre l'ex-`PillScroller` (flèches, `ResizeObserver`, `wheel` non passif) — scroll/resize restent impératifs (trop fréquents pour des signals). L'indicateur est repositionné dans un `afterRenderEffect` (mesure après pose des classes `is-active`) et l'activation des transitions attend `document.fonts.ready` car `font-display: block` (intentionnel) garantit des métriques stables.
- `filter-mobile.ts` — trigger + menu overlay mobile. L'ouverture/fermeture est impérative (`classList`) pour que le focus se pose sur un élément déjà visible ; le label et les états actifs sont déclaratifs.
- `gallery-grid.ts` — boucle plate unique sur `PHOTOS` ; l'animation de filtre (fade 200 ms → bascule `display` → double rAF) est chorégraphiée en impératif dans un `afterRenderEffect` qui saute le premier rendu.
- `lightbox.ts` — visionneuse ; navigation par index global restreinte à `visible`, swipe tactile, clavier, focus trap, dimensionnement DPR. Écouteurs touch bindés manuellement (`passive: true` requis). `navTimeout` (nav clic/clavier) et `swipeTimeout` (nav swipe) sont annulés ensemble via `clearTimeouts()` dès qu'une nouvelle navigation démarre — sinon un swipe suivi d'un clic sur une flèche fait cohabiter deux mises à jour de `current`. `isOpen` est un getter dérivé de la classe DOM `is-open`, pas un champ à synchroniser.

`constants.ts` (`BP_MD = 768`) et `focus-trap.ts` (`trapTabFocus()`) sont partagés entre composants — ne pas redupliquer un littéral de breakpoint ou une logique de piège de focus Tab dans un nouveau composant modal, importer depuis ces fichiers.

Règle générale : l'état partagé et les états de boutons sont déclaratifs (signals/bindings) ; les chorégraphies d'animation, mesures DOM et gestion du focus restent impératives — c'est un choix, ne pas « angulariser » ces séquences.

### CSS

Point d'entrée : `src/styles/main.scss` (déclaré dans `angular.json`). Chaque partiel commence par `@use 'variables' as *` pour accéder aux tokens sans préfixe. Convention BEM (`.gallery-card__img-wrap`, `.lightbox__nav--prev`).

Partiels SCSS et leur périmètre :
- `_base.scss` — reset (y compris `display: contents` sur **tous** les hôtes Angular, `app-root` inclus) + custom properties uniquement, aucun composant.
- `_layout.scss` — filter-bar desktop, pill, menu mobile, `.site-main`, `.site-footer`.
- `_cover.scss`, `_gallery.scss`, `_lightbox.scss` — composants autonomes.

**Chemins d'assets : toujours relatifs (jamais de `/` en tête), pour que `<base href>` (posé par `--base-href` au build CI) les résolve correctement quel que soit le sous-chemin de déploiement.** Un chemin racine-absolu (`/assets/...`) ignore `<base href>` et casse tout déploiement en dépôt projet GitHub Pages (`username.github.io/portfolio/`) — ce dépôt en est un, ce n'est pas un cas hypothétique. S'applique à `series.ts`, `cover.ts`, `src/index.html` et aux `url()` SCSS.

`_fonts.scss` référence les fontes via un chemin **relatif sur disque** (`../../assets/fonts/...`, depuis `src/styles/` jusqu'à `assets/fonts/` à la racine du dépôt) — pas un chemin relatif à l'URL de la page. C'est intentionnel et différent des autres assets : le plugin CSS d'esbuild résout et copie ces `url()` comme de vraies dépendances de build (hash de contenu, sortie dans `dist/.../media/`), contrairement à un chemin racine-absolu qu'il laisse passer tel quel. Conséquence : le nom de fichier haché n'est pas prévisible depuis un document statique, donc **aucun `<link rel=preload>` pour les fontes** dans `src/index.html` — `font-display: block` évite déjà tout flash visuel, seul le lancement du fetch aurait été avancé de quelques centaines de ms. Les preloads de covers restent, eux, car les images sont référencées via des bindings de template (`<img src>`), jamais interceptées par le pipeline CSS.

L'`assets` glob d'`angular.json` ne copie que `assets/images/**` (pas `assets/fonts/`) — copier les fontes brutes en plus des fichiers hachés produirait une sortie dupliquée et inutilisée.

Point de rupture unique : `$bp-md = 768px`. En dessous (≤ 767px) : grille 2 colonnes plein-écran, filtre en overlay mobile, navigation lightbox au glissement uniquement. Au-dessus (≥ 768px) : grille plein-écran, pill de filtre, navigation par flèches.

Variables de typographie dans `_variables.scss` : `$size-xs` (0.75rem), `$size-base` (1rem), `$size-lg` (1.5rem), `$weight-ui` (400). `$weight-ui` est le grammage de toutes les pills et labels d'interface — il s'applique partout où `text-transform: uppercase` + `letter-spacing` est utilisé. Ne pas introduire de valeur en dur.

Le sélecteur pill desktop (`.filter-pill`) a `max-width: min(52rem, 60vw)`, défile horizontalement, et ses flèches (`.filter-pill-wrap__arrow`) sont liées aux dégradés de bord via `:has()` CSS — les pseudo-éléments `::before/::after` n'ont `opacity: 1` que si la flèche correspondante est `.is-visible`. Ce couplage est intentionnel et pur CSS.

Le thème est sombre fixe. Les propriétés CSS (`--bg`, `--bg-surface`, `--border`, `--text`, `--text-muted`, `--shimmer-color`) sont déclarées dans `_base.scss` sous `:root` uniquement — pas de bascule, pas de `localStorage`.

### `src/index.html`

Contient les `preload` des covers WebP de production (pas des fontes — voir section CSS). En développement les covers WebP n'existent pas : les deux preloads produisent un avertissement console bénin — c'est le compromis retenu pour éviter un `index.html` par configuration. `<base href="/">` par défaut, réécrit au build CI via `--base-href`.

### Variantes d'images

Les originaux (`.jpg`) sont commités dans `assets/images/` (racine du dépôt, copié tel quel dans le build via `angular.json`). Les variantes générées sont dans `.gitignore` :
- `photo-XX-thumb.webp` — 1200 px max, miniature grille (production uniquement)
- `photo-XX-thumb-2x.webp` — 2400 px max, miniature Retina 2× (production uniquement)
- `photo-XX.webp` — WebP pleine résolution, lightbox (production uniquement)
- `cover.webp` — 1920 px max, cover desktop standard
- `cover-2x.webp` — 3840 px max, cover desktop Retina 2×
- `cover_phone.webp` — WebP pleine résolution, cover mobile

En développement, le site utilise directement les JPEG originaux — aucune variante n'est nécessaire. `bin/build-webp.mjs` et `bin/normalize.mjs` (Node + sharp, aucun outil système requis) génèrent respectivement les variantes WebP et le redimensionnement des originaux surdimensionnés ; `bin/lib/images.mjs` mutualise entre les deux la découverte récursive des JPEG (`jpgsIn`) et le test de fraîcheur par mtime (`isFresh`, équivalent strict de `[ "$out" -nt "$src" ]` — pas `>=`, sinon un mtime égal après un `git checkout`/`rsync` laisserait une variante obsolète). Les deux scripts reproduisent la sémantique ImageMagick d'origine via un unique helper `toWebp(src, out, resize)` dans `build-webp.mjs` : `resize: { width }` (ex-`"Wx>"`, covers) contraint la largeur avec hauteur proportionnelle, `resize: { width, height, fit: 'inside' }` (ex-`"WxH>"`, miniatures et `normalize.mjs`) contraint une boîte englobante, `resize: null` réencode sans redimensionner — dans tous les cas, l'image n'est jamais agrandie (`withoutEnlargement`). `bin/build-webp.mjs` est idempotent par comparaison de mtime (`--force` pour régénérer sans en tenir compte) ; `bin/normalize.mjs` l'est par construction (relance sans effet une fois les dimensions sous le seuil). `normalize.mjs` écrit par-dessus le JPEG source — bufferisé via `.toBuffer()` avant écriture, sharp ne pouvant pas transformer un fichier en flux vers lui-même.

Ni `build-webp.mjs` ni `normalize.mjs` n'appliquent `.rotate()`/auto-orientation EXIF — comportement hérité tel quel de l'ancien `convert`/`mogrify` (qui ne l'appliquaient pas non plus sans `-auto-orient` explicite), pas une régression de cette migration. Une photo au tag EXIF Orientation non standard s'afficherait donc de travers dans les deux mondes ; à corriger séparément si constaté, pas dans le périmètre de ce refactor.

Le workflow CI (`.github/workflows/deploy.yml`) installe les dépendances npm puis appelle `npm run build:webp` avant `npx ng build --base-href …`, et publie `dist/portfolio/browser` — source de vérité unique, ne pas dupliquer la logique d'optimisation inline dans le YAML. `package-lock.json` doit être commité pour que le cache npm de CI soit efficace et les builds reproductibles. Pas d'étape de minification séparée : esbuild s'en charge.

### TypeScript

`strict` + `strictTemplates` sont activés (`tsconfig.json`). `angular.json` fixe `schematics.component.style: "none"` — aucun composant n'a de style propre (voir plus haut), un `ng generate component` ne doit pas scaffolder de SCSS orphelin.

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
