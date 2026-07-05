import {
  Component,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { GalleryState } from './gallery-state';
import { PHOTOS } from './series';
import { trapTabFocus } from './focus-trap';

// La liste des indices visibles est synchronisée depuis GalleryState pour que
// la navigation reste dans le filtre actif sans interroger le DOM.
@Component({
  selector: 'app-lightbox',
  template: `
    <div class="lightbox" #lightbox aria-hidden="true" role="dialog" aria-modal="true" aria-label="Visionneuse photo">

      <button class="lightbox__close" #closeBtn aria-label="Fermer" (click)="close()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>

      <div class="lightbox__stage" #stage (click)="onStageClick($event)">
        <div class="lightbox__loader" #loader aria-hidden="true"></div>

        <button class="lightbox__nav lightbox__nav--prev" #prev aria-label="Photo précédente" (click)="navigate(-1)">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>

        <img class="lightbox__img" #img alt="" />

        <button class="lightbox__nav lightbox__nav--next" #next aria-label="Photo suivante" (click)="navigate(1)">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>

    </div>
  `,
})
export class Lightbox {
  private readonly state = inject(GalleryState);
  private readonly photos = PHOTOS;

  private readonly el = viewChild.required<ElementRef<HTMLElement>>('lightbox');
  private readonly img = viewChild.required<ElementRef<HTMLImageElement>>('img');
  private readonly closeBtn = viewChild.required<ElementRef<HTMLButtonElement>>('closeBtn');
  private readonly prev = viewChild.required<ElementRef<HTMLButtonElement>>('prev');
  private readonly next = viewChild.required<ElementRef<HTMLButtonElement>>('next');
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly loader = viewChild.required<ElementRef<HTMLElement>>('loader');

  private current = 0;
  private lastFocused: Element | null = null;
  private visible: number[] = [];
  private navTimeout: ReturnType<typeof setTimeout> | null = null;
  private swipeTimeout: ReturnType<typeof setTimeout> | null = null;

  // Dérivé de la classe DOM — pas d'état à garder synchronisé séparément.
  private get isOpen(): boolean {
    return this.el().nativeElement.classList.contains('is-open');
  }

  constructor() {
    effect(() => {
      this.visible = this.state.visible();
      if (this.isOpen) {
        this.prev().nativeElement.hidden = this.next().nativeElement.hidden = this.visible.length < 2;
      }
    });

    effect(() => {
      const index = this.state.lightboxIndex();
      if (index !== null) this.open(index);
    });

    afterNextRender(() => this.bind());
  }

  private bind(): void {
    const img = this.img().nativeElement;
    const stage = this.stage().nativeElement;

    let swipeStartX = 0;
    let swipeDragging = false;

    const snapBack = () => {
      img.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
      img.style.transform = '';
      img.style.opacity = '';
      setTimeout(() => { img.style.transition = ''; }, 300);
    };

    stage.addEventListener('touchstart', e => {
      // Annule toute navigation en cours (clic/clavier ou swipe précédent) pour
      // qu'un nouveau swipe ne fasse pas cohabiter deux mises à jour de `current`.
      this.clearTimeouts();
      swipeStartX = e.touches[0].clientX;
      swipeDragging = false;
      img.style.transition = 'none';
    }, { passive: true });

    stage.addEventListener('touchmove', e => {
      const delta = e.touches[0].clientX - swipeStartX;
      if (!swipeDragging && Math.abs(delta) > 6) swipeDragging = true;
      if (swipeDragging && this.visible.length > 1) {
        img.style.transform = `translateX(${delta}px)`;
        img.style.opacity = String(Math.max(0, 1 - Math.abs(delta) / (window.innerWidth * 0.6)));
      }
    }, { passive: true });

    stage.addEventListener('touchend', e => {
      if (!swipeDragging) { img.style.transition = ''; swipeDragging = false; return; }
      const delta = e.changedTouches[0].clientX - swipeStartX;
      const threshold = window.innerWidth * 0.25;

      if (this.visible.length > 1 && Math.abs(delta) > threshold) {
        const dir = delta < 0 ? 1 : -1;
        const exit = delta < 0 ? '-110%' : '110%';
        img.style.transition = 'transform 0.22s ease-out, opacity 0.22s ease-out';
        img.style.transform = `translateX(${exit})`;
        img.style.opacity = '0';
        this.swipeTimeout = setTimeout(() => {
          this.swipeTimeout = null;
          const pos = this.visible.indexOf(this.current);
          this.current = this.visible[(pos + dir + this.visible.length) % this.visible.length];
          img.style.transition = 'none';
          img.style.transform = '';
          img.style.opacity = '';
          this.update();
          requestAnimationFrame(() => { img.style.transition = ''; });
        }, 220);
      } else {
        snapBack();
      }
      swipeDragging = false;
    }, { passive: true });

    stage.addEventListener('touchcancel', () => {
      if (swipeDragging) snapBack();
      swipeDragging = false;
    }, { passive: true });

    document.addEventListener('keydown', e => {
      if (!this.isOpen) return;
      if (e.key === 'Escape') { this.close(); return; }
      if (e.key === 'ArrowLeft') { this.navigate(-1); return; }
      if (e.key === 'ArrowRight') { this.navigate(1); return; }
      if (e.key === 'Tab') {
        const focusable = [this.closeBtn().nativeElement, this.prev().nativeElement, this.next().nativeElement]
          .filter(el => !el.hidden);
        trapTabFocus(focusable, e);
      }
    });
  }

  protected onStageClick(e: Event): void {
    if (e.target === this.stage().nativeElement) this.close();
  }

  private update(): void {
    const img = this.img().nativeElement;
    const stage = this.stage().nativeElement;
    const loader = this.loader().nativeElement;
    const p = this.photos[this.current];

    img.classList.add('is-loading');
    loader.classList.add('is-visible');
    img.style.width = '';
    img.style.height = '';

    const onLoad = () => {
      img.onload = null;
      img.classList.remove('is-loading');
      loader.classList.remove('is-visible');
      const dpr = window.devicePixelRatio || 1;
      const physW = stage.clientWidth * dpr;
      const physH = stage.clientHeight * dpr;
      if (img.naturalWidth < physW && img.naturalHeight < physH) {
        img.style.width = `${img.naturalWidth / dpr}px`;
        img.style.height = `${img.naturalHeight / dpr}px`;
      }
    };
    img.onload = onLoad;
    img.onerror = () => {
      img.onload = null;
      img.onerror = null;
      img.classList.remove('is-loading');
      loader.classList.remove('is-visible');
    };

    img.alt = '';
    img.src = p.full;
    if (img.complete && img.naturalWidth) onLoad();

    this.prev().nativeElement.hidden = this.next().nativeElement.hidden = this.visible.length < 2;
  }

  private open(index: number): void {
    this.lastFocused = document.activeElement;
    this.current = index;
    this.update();
    this.el().nativeElement.classList.add('is-open');
    this.el().nativeElement.removeAttribute('aria-hidden');
    document.body.style.overflow = 'hidden';
    this.closeBtn().nativeElement.focus();
  }

  private clearTimeouts(): void {
    if (this.navTimeout) { clearTimeout(this.navTimeout); this.navTimeout = null; }
    if (this.swipeTimeout) { clearTimeout(this.swipeTimeout); this.swipeTimeout = null; }
  }

  protected close(): void {
    this.clearTimeouts();
    this.el().nativeElement.classList.remove('is-open');
    this.el().nativeElement.setAttribute('aria-hidden', 'true');
    this.state.lightboxIndex.set(null);
    document.body.style.overflow = '';
    (this.lastFocused as HTMLElement | null)?.focus();
  }

  protected navigate(dir: number): void {
    const hadPendingSwipe = this.swipeTimeout !== null;
    this.clearTimeouts();

    const img = this.img().nativeElement;
    const pos = this.visible.indexOf(this.current);
    const next = this.visible[(pos + dir + this.visible.length) % this.visible.length];

    if (hadPendingSwipe) {
      // Un swipe était en cours de sortie : on annule son déplacement
      // instantanément avant d'entamer le fondu normal, sinon l'image reste
      // visuellement décalée hors-écran.
      img.style.transition = 'none';
      img.style.transform = '';
      void img.offsetWidth;
      img.style.transition = '';
    }

    img.style.opacity = '0';

    this.navTimeout = setTimeout(() => {
      this.navTimeout = null;
      this.current = next;
      img.style.opacity = '';
      this.update();
    }, 200);
  }
}
