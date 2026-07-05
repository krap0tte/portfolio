import { Component } from '@angular/core';

@Component({
  selector: 'app-site-header',
  template: `
    <header class="site-header">
      <button class="site-header__brand" (click)="scrollToTop()">Demo</button>
    </header>
  `,
})
export class SiteHeader {
  protected scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
