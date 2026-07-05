import { Component, inject } from '@angular/core';
import { GalleryState } from './gallery-state';
import { PHOTOS } from './photos';

// Grille plate : chaque card garde son index global (position dans PHOTOS) —
// c'est cet index que la lightbox utilise pour naviguer.
@Component({
  selector: 'app-gallery-grid',
  template: `
    <section class="gallery-grid">
      <div class="gallery-grid__container">
        @for (p of photos; track $index; let i = $index) {
          <a [href]="p.full" class="gallery-card" (click)="open($event, i)">
            <div class="gallery-card__img-wrap">
              <img
                [src]="p.thumb"
                [attr.srcset]="p.thumbSrcset"
                [attr.sizes]="p.thumbSrcset ? sizes : null"
                alt=""
                class="gallery-card__img"
                loading="lazy"
                decoding="async"
                (load)="loaded($event)"
                (error)="loaded($event)"
              />
            </div>
          </a>
        }
      </div>
    </section>
  `,
})
export class GalleryGrid {
  protected readonly photos = PHOTOS;
  protected readonly sizes =
    '(max-width: 1023px) 50vw, (max-width: 1279px) 33vw, (max-width: 1599px) 25vw, (max-width: 1999px) 20vw, 17vw';

  private readonly state = inject(GalleryState);

  protected open(e: Event, index: number): void {
    e.preventDefault();
    this.state.lightboxIndex.set(index);
  }

  protected loaded(e: Event): void {
    const img = e.target as HTMLElement;
    img.classList.add('is-loaded');
    img.closest('.gallery-card__img-wrap')?.classList.add('is-loaded');
  }
}
