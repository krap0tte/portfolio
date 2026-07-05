import { Component } from '@angular/core';
import { GalleryGrid } from './gallery-grid';
import { Lightbox } from './lightbox';
import { SiteHeader } from './site-header';

@Component({
  selector: 'app-root',
  imports: [SiteHeader, GalleryGrid, Lightbox],
  template: `
    <app-site-header />
    <main class="site-main">
      <app-gallery-grid />
      <app-lightbox />
    </main>
  `,
})
export class App {}
