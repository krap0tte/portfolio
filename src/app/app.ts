import { Component, ElementRef, afterNextRender, inject, viewChild } from '@angular/core';
import { AboutButton } from './about-button';
import { GalleryGrid } from './gallery-grid';
import { GalleryState } from './gallery-state';
import { Lightbox } from './lightbox';

@Component({
  selector: 'app-root',
  imports: [AboutButton, GalleryGrid, Lightbox],
  template: `
    <app-about-button />
    <main class="site-main">
      <app-gallery-grid />
      <app-lightbox />
    </main>
    <footer class="site-footer" id="about" #footer>
      <p class="site-footer__name">Demo</p>
      <p class="site-footer__description">Photographe — Portrait · Paysage · Architecture</p>
    </footer>
  `,
})
export class App {
  private readonly state = inject(GalleryState);
  private readonly footer = viewChild.required<ElementRef<HTMLElement>>('footer');

  constructor() {
    // Le footer plein écran fait office de section « À propos » : l'état suit
    // sa visibilité, que l'on y arrive par bouton ou par défilement.
    afterNextRender(() => {
      new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) this.state.enterAbout();
        else this.state.leaveAbout();
      }, { threshold: 0.5 }).observe(this.footer().nativeElement);
    });
  }
}
