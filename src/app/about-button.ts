import { Component, inject } from '@angular/core';
import { GalleryState } from './gallery-state';

// Bouton « À propos » — même rendu à tous les breakpoints.
@Component({
  selector: 'app-about-button',
  template: `
    <button
      class="about-button"
      [class.is-active]="state.isAbout()"
      [attr.aria-pressed]="state.isAbout()"
      (click)="about()"
    >À propos</button>
  `,
})
export class AboutButton {
  protected readonly state = inject(GalleryState);

  protected about(): void {
    this.state.enterAbout();
    document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
  }
}
