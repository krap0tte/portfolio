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

# Normaliser les originaux si un JPEG dépasse 4K (optionnel)
bash bin/normalize.sh

# Build de production (génère les WebP puis compile)
bash bin/build-webp.sh && JEKYLL_ENV=production bundle exec jekyll build
```

## Architecture

### Modèle de contenu — `_series/`

`_series/*.md` est la source unique de vérité. Chaque fichier déclare `title`, `description` et une liste ordonnée `photos:` (noms de fichiers sans extension). Le slug du nom de fichier devient l'identifiant de la série utilisé dans les templates et le JS. Ajouter un fichier ici génère automatiquement un bouton de filtre, sans autre configuration.

### Flux de données : Liquid → JSON → JS

Jekyll ne peut pas transmettre de données complexes au JS à l'exécution. `gallery-grid.html` intègre deux blocs `<script type="application/json">` que Liquid compile en données structurées. Le JS lit ces blocs à l'initialisation (`#series-data` pour les descriptions, `#photo-data` pour la liste complète des photos avec chemins src). Ce schéma évite tout appel Ajax.

### Hiérarchie des classes JS

`Gallery` étend `EventTarget` et sert de hub central. Elle émet `filterchange` avec `{ visible: number[], filter, label }` à chaque changement de série active. `Lightbox` et `FilterMobileMenu` s'abonnent à cet événement — ils ne sont jamais couplés entre eux. L'ordre d'instanciation dans `main.js` est important : `Gallery` doit être créé avant d'être passé aux autres constructeurs.

La position de l'indicateur de la pill est mesurée après `document.fonts.ready` car `font-display: block` (intentionnel) garantit que les métriques sont stables seulement une fois les fontes chargées.

### Index global vs. index par série

Les cards sont rendues dans une boucle plate unique sur toutes les séries (triées alphabétiquement par titre), chacune recevant un `data-index` correspondant à sa position dans le tableau JSON `photo-data`. La lightbox navigue par cet index global ; `#visible` est mis à jour sur `filterchange` pour restreindre la navigation à la série courante.

### CSS

Point d'entrée : `assets/css/main.scss` (front matter Jekyll obligatoire). Chaque partiel commence par `@use 'variables' as *` pour accéder aux tokens sans préfixe. Convention BEM (`.gallery-card__img-wrap`, `.lightbox__nav--prev`).

Point de rupture unique : `$bp-md = 768px`. En dessous (≤ 767px) : grille 2 colonnes plein-écran, filtre en overlay mobile, navigation lightbox au glissement uniquement. Au-dessus (≥ 768px) : sidebar fixe (1/3), pill de filtre, navigation par flèches.

Le système de thème utilise des propriétés CSS personnalisées (`--bg`, `--bg-surface`, `--border`, `--text`, `--text-muted`, `--shimmer-color`) déclarées dans `_base.scss` sous `:root`, `[data-theme="dark"]` et `@media (prefers-color-scheme: dark) :root:not([data-theme="light"])`. Un script inline dans `<head>` (dans `head.html`) écrit `data-theme` sur `<html>` avant le premier rendu pour éviter le FOUC. Les overrides manuels sont persistés dans `localStorage`.

### Variantes d'images

Les originaux (`.jpg`) sont commités. Les variantes générées sont dans `.gitignore` :
- `photo-XX-thumb.webp` — 1200 px max, utilisée dans la grille (production uniquement)
- `photo-XX.webp` — WebP pleine résolution, utilisée dans la lightbox (production uniquement)

En développement, le site utilise directement les JPEG originaux — aucune variante n'est générée. `bin/build-webp.sh` génère toutes les variantes WebP avant le build de production. Relancer le script est sans risque et idempotent (`--force` pour régénérer sans tenir compte des timestamps).

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
