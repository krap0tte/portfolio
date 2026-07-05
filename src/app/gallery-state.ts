import { Injectable, signal } from '@angular/core';

// Hub central de l'état partagé — remplace les événements `filterchange` et
// `aboutstate` de l'ancienne classe Gallery (EventTarget).
@Injectable({ providedIn: 'root' })
export class GalleryState {
  readonly isAbout = signal(false);

  // Demande d'ouverture de la lightbox (index global) ; null = fermée.
  readonly lightboxIndex = signal<number | null>(null);

  enterAbout(): void {
    this.isAbout.set(true);
  }

  leaveAbout(): void {
    this.isAbout.set(false);
  }
}
