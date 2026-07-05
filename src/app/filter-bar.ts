import {
  Component,
  ElementRef,
  afterNextRender,
  afterRenderEffect,
  inject,
  viewChild,
  viewChildren,
} from '@angular/core';
import { GalleryState } from './gallery-state';
import { SORTED_SERIES } from './series';
import { BP_MD } from './constants';

// Filter-bar desktop : bouton « Tout », pill défilante avec indicateur animé
// et flèches de bord, bouton « À propos ». Les flèches (ex-PillScroller) sont
// pilotées en impératif : scroll/resize sont trop fréquents pour des signals.
@Component({
  selector: 'app-filter-bar',
  template: `
    <div class="filter-bar">
      <button
        class="filter-bar__all"
        [class.is-active]="state.isAll()"
        [attr.aria-pressed]="state.isAll()"
        (click)="selectAll()"
      >Tout</button>
      <div class="filter-pill-wrap">
        <button class="filter-pill-wrap__arrow filter-pill-wrap__arrow--prev" #prevArrow
                aria-hidden="true" tabindex="-1" (click)="scrollPill(-1)">
          <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
            <path d="M5 1L1 5L5 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <nav class="filter-pill" #pill aria-label="Filtrer par série">
          <span class="filter-pill__indicator" #indicator aria-hidden="true" style="opacity: 0"></span>
          @for (s of series; track s.slug) {
            <button class="filter-pill__btn" #pillBtn
                    [class.is-active]="state.isActive(s.slug)"
                    [attr.aria-pressed]="state.isActive(s.slug)"
                    (click)="state.setFilter(s.slug)">{{ s.title }}</button>
          }
        </nav>
        <button class="filter-pill-wrap__arrow filter-pill-wrap__arrow--next" #nextArrow
                aria-hidden="true" tabindex="-1" (click)="scrollPill(1)">
          <svg width="6" height="10" viewBox="0 0 6 10" fill="none">
            <path d="M1 1L5 5L1 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <button
        class="filter-bar__about"
        [class.is-active]="state.isAbout()"
        [attr.aria-pressed]="state.isAbout()"
        (click)="about()"
      >À propos</button>
    </div>
  `,
})
export class FilterBar {
  protected readonly state = inject(GalleryState);
  protected readonly series = SORTED_SERIES;

  private readonly pill = viewChild.required<ElementRef<HTMLElement>>('pill');
  private readonly indicator = viewChild.required<ElementRef<HTMLElement>>('indicator');
  private readonly prevArrow = viewChild.required<ElementRef<HTMLElement>>('prevArrow');
  private readonly nextArrow = viewChild.required<ElementRef<HTMLElement>>('nextArrow');
  private readonly pillBtns = viewChildren<ElementRef<HTMLElement>>('pillBtn');

  constructor() {
    afterNextRender(() => {
      const pill = this.pill().nativeElement;

      // font-display:block retient le rendu jusqu'à ce que les fontes soient
      // prêtes — activer les transitions avant exposerait des mesures instables.
      document.fonts.ready.then(() => {
        requestAnimationFrame(() => { pill.classList.add('filter-pill--ready'); });
      });

      pill.addEventListener('scroll', () => this.updateArrows(), { passive: true });
      // Molette/trackpad : scrolle la pill sans scroller la page.
      pill.addEventListener('wheel', e => {
        if (pill.scrollWidth <= pill.clientWidth) return;
        e.preventDefault();
        const delta = Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
        pill.scrollLeft += delta;
      }, { passive: false });

      new ResizeObserver(() => this.updateArrows()).observe(pill);
      // La pill est display:none sur mobile : offsetLeft/offsetWidth valent 0.
      // On re-mesure dès qu'elle redevient visible au changement de breakpoint.
      window.matchMedia(`(min-width: ${BP_MD}px)`).addEventListener('change', e => {
        this.updateArrows();
        if (e.matches) this.moveIndicator();
      });
      this.updateArrows();
    });

    // Après rendu : les classes is-active sont posées, les mesures sont justes.
    afterRenderEffect(() => {
      this.state.filter();
      this.state.isAbout();
      this.moveIndicator();
    });
  }

  private moveIndicator(): void {
    const indicator = this.indicator().nativeElement;
    const filter = this.state.filter();
    if (filter === null || this.state.isAbout()) {
      indicator.style.opacity = '0';
      return;
    }
    const idx = this.series.findIndex(s => s.slug === filter);
    const btn = this.pillBtns()[idx]?.nativeElement;
    if (btn) {
      indicator.style.transform = `translateX(${btn.offsetLeft}px)`;
      indicator.style.width = `${btn.offsetWidth}px`;
    }
    indicator.style.opacity = '';
  }

  protected selectAll(): void {
    this.state.setFilter(null);
  }

  protected about(): void {
    this.state.enterAbout();
    document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
  }

  protected scrollPill(dir: number): void {
    const pill = this.pill().nativeElement;
    pill.scrollBy({ left: dir * (pill.clientWidth / 2), behavior: 'smooth' });
  }

  private updateArrows(): void {
    const pill = this.pill().nativeElement;
    if (!pill.clientWidth) return;
    const { scrollLeft, scrollWidth, clientWidth } = pill;
    this.prevArrow().nativeElement.classList.toggle('is-visible', scrollLeft > 1);
    this.nextArrow().nativeElement.classList.toggle('is-visible', scrollLeft + clientWidth < scrollWidth - 1);
  }
}
