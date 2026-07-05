import { Injectable, signal } from '@angular/core';

// Hub central de l'état partagé — remplace les événements `filterchange` et
// `aboutstate` de l'ancienne classe Gallery (EventTarget).
@Injectable({ providedIn: 'root' })
export class GalleryState {
  // Demande d'ouverture de la lightbox (index global) ; null = fermée.
  readonly lightboxIndex = signal<number | null>(null);
}
