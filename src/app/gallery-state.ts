import { Injectable, computed, signal } from '@angular/core';
import { PHOTOS, SORTED_SERIES } from './series';

// Hub central de l'état partagé — remplace les événements `filterchange` et
// `aboutstate` de l'ancienne classe Gallery (EventTarget). Les composants
// dérivent leur affichage de ces signals ; l'état visuel des boutons
// (is-active, aria-pressed) découle de (isAbout, filter) sans restauration
// manuelle.
@Injectable({ providedIn: 'root' })
export class GalleryState {
  // null = « Tout »
  readonly filter = signal<string | null>(null);
  readonly isAbout = signal(false);

  // Dérivé de `filter` — pas d'état à garder synchronisé séparément.
  readonly label = computed(() => {
    const slug = this.filter();
    return slug === null ? 'Tout' : (SORTED_SERIES.find(s => s.slug === slug)?.title ?? 'Tout');
  });

  // Demande d'ouverture de la lightbox (index global) ; null = fermée.
  readonly lightboxIndex = signal<number | null>(null);

  // État visuel des boutons — « Tout » et les filtres s'éteignent en mode
  // À propos, et se restaurent d'eux-mêmes à la sortie.
  readonly isAll = computed(() => !this.isAbout() && this.filter() === null);

  isActive(slug: string): boolean {
    return !this.isAbout() && this.filter() === slug;
  }

  // Indices globaux des photos visibles sous le filtre courant — la navigation
  // de la lightbox reste dans la série active sans interroger le DOM.
  readonly visible = computed(() => {
    const f = this.filter();
    const out: number[] = [];
    PHOTOS.forEach((p, i) => {
      if (f === null || p.series === f) out.push(i);
    });
    return out;
  });

  setFilter(slug: string | null): void {
    const wasAbout = this.isAbout();
    this.isAbout.set(false);
    this.filter.set(slug);
    if (wasAbout) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  enterAbout(): void {
    this.isAbout.set(true);
  }

  leaveAbout(): void {
    this.isAbout.set(false);
  }
}
