import {
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { GalleryState } from './gallery-state';
import { SORTED_SERIES, Series } from './series';
import { trapTabFocus } from './focus-trap';

// Sélecteur de série mobile : trigger + menu en overlay. L'ouverture/fermeture
// est impérative (classList) pour que le focus se pose sur un élément déjà
// visible, comme dans l'implémentation d'origine.
@Component({
  selector: 'app-filter-mobile',
  template: `
    <button class="filter-mobile-trigger" #trigger
            aria-haspopup="dialog" aria-expanded="false" aria-controls="filter-mobile-menu"
            (click)="toggle()">
      <span>{{ label() }}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>
    <div class="filter-mobile-menu" id="filter-mobile-menu" #menu
         role="dialog" aria-modal="true" aria-label="Filtrer par série" aria-hidden="true">
      <div class="filter-mobile-menu__header">
        <span class="filter-mobile-menu__title">Séries</span>
        <button class="filter-mobile-menu__close" #closeBtn aria-label="Fermer" (click)="close()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <nav class="filter-mobile-menu__list">
        <button class="filter-pill__btn"
                [class.is-active]="state.isAll()"
                [attr.aria-pressed]="state.isAll()"
                (click)="select(null)">Tout</button>
        @for (s of series; track s.slug) {
          <button class="filter-pill__btn"
                  [class.is-active]="state.isActive(s.slug)"
                  [attr.aria-pressed]="state.isActive(s.slug)"
                  (click)="select(s)">{{ s.title }}</button>
        }
      </nav>
      <button class="filter-mobile-menu__about" #aboutBtn (click)="about()">À propos</button>
    </div>
  `,
})
export class FilterMobile {
  protected readonly state = inject(GalleryState);
  protected readonly series = SORTED_SERIES;
  protected readonly label = computed(() =>
    this.state.isAbout() ? 'À propos' : this.state.label()
  );

  private readonly trigger = viewChild.required<ElementRef<HTMLElement>>('trigger');
  private readonly menu = viewChild.required<ElementRef<HTMLElement>>('menu');
  private readonly closeBtn = viewChild.required<ElementRef<HTMLElement>>('closeBtn');
  private readonly aboutBtn = viewChild.required<ElementRef<HTMLElement>>('aboutBtn');

  constructor() {
    afterNextRender(() => {
      document.addEventListener('keydown', e => {
        const menu = this.menu().nativeElement;
        if (!menu.classList.contains('is-open')) return;
        if (e.key === 'Escape') { this.close(); return; }
        if (e.key === 'Tab') {
          const focusable = [
            this.closeBtn().nativeElement,
            ...menu.querySelectorAll<HTMLElement>('.filter-pill__btn'),
            this.aboutBtn().nativeElement,
          ].filter(el => !el.hidden);
          trapTabFocus(focusable, e);
        }
      });
    });
  }

  protected toggle(): void {
    this.menu().nativeElement.classList.contains('is-open') ? this.close() : this.open();
  }

  protected select(s: Series | null): void {
    this.state.setFilter(s === null ? null : s.slug);
    this.close();
  }

  protected about(): void {
    this.close();
    this.state.enterAbout();
    document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
  }

  private open(): void {
    this.menu().nativeElement.classList.add('is-open');
    this.trigger().nativeElement.setAttribute('aria-expanded', 'true');
    this.menu().nativeElement.removeAttribute('aria-hidden');
    this.closeBtn().nativeElement.focus();
  }

  protected close(): void {
    this.menu().nativeElement.classList.remove('is-open');
    this.trigger().nativeElement.setAttribute('aria-expanded', 'false');
    this.menu().nativeElement.setAttribute('aria-hidden', 'true');
    this.trigger().nativeElement.focus();
  }
}
