import {
  Component,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { GalleryState } from './gallery-state';
import { PHOTOS } from './photos';
import { trapTabFocus } from './focus-trap';

@Component({
  selector: 'app-lightbox',
  template: `
    <div class="lightbox" #lightbox aria-hidden="true" role="dialog" aria-modal="true" aria-label="Visionneuse photo">

      <div class="lightbox__stage" #stage (click)="onStageClick($event)">
        <div class="lightbox__loader" #loader aria-hidden="true"></div>
        <img class="lightbox__img" #img alt="" />
      </div>

      <div class="lightbox__controls">
        <p class="lightbox__nav-row" #navRow>
          <button class="lightbox__link" #prev aria-label="Photo précédente" (click)="navigate(-1)">Précédent</button>
          <span aria-hidden="true"> / </span>
          <button class="lightbox__link" #next aria-label="Photo suivante" (click)="navigate(1)">Suivant</button>
        </p>
        <button class="lightbox__link" #gridBtn aria-label="Retour à la grille" (click)="close()">Grille</button>
      </div>

    </div>
  `,
})
export class Lightbox {
  private readonly state = inject(GalleryState);
  private readonly photos = PHOTOS;

  private readonly el = viewChild.required<ElementRef<HTMLElement>>('lightbox');
  private readonly img = viewChild.required<ElementRef<HTMLImageElement>>('img');
  private readonly prev = viewChild.required<ElementRef<HTMLButtonElement>>('prev');
  private readonly next = viewChild.required<ElementRef<HTMLButtonElement>>('next');
  private readonly navRow = viewChild.required<ElementRef<HTMLElement>>('navRow');
  private readonly gridBtn = viewChild.required<ElementRef<HTMLButtonElement>>('gridBtn');
  private readonly stage = viewChild.required<ElementRef<HTMLElement>>('stage');
  private readonly loader = viewChild.required<ElementRef<HTMLElement>>('loader');

  private readonly total = this.photos.length;
  private current = 0;
  private lastFocused: Element | null = null;
  private navTimeout: ReturnType<typeof setTimeout> | null = null;
  private swipeTimeout: ReturnType<typeof setTimeout> | null = null;

  // Dérivé de la classe DOM — pas d'état à garder synchronisé séparément.
  private get isOpen(): boolean {
    return this.el().nativeElement.classList.contains('is-open');
  }

  constructor() {
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
      if (swipeDragging && this.total > 1) {
        img.style.transform = `translateX(${delta}px)`;
        img.style.opacity = String(Math.max(0, 1 - Math.abs(delta) / (window.innerWidth * 0.6)));
      }
    }, { passive: true });

    stage.addEventListener('touchend', e => {
      if (!swipeDragging) { img.style.transition = ''; swipeDragging = false; return; }
      const delta = e.changedTouches[0].clientX - swipeStartX;
      const threshold = window.innerWidth * 0.25;

      if (this.total > 1 && Math.abs(delta) > threshold) {
        const dir = delta < 0 ? 1 : -1;
        const exit = delta < 0 ? '-110%' : '110%';
        img.style.transition = 'transform 0.22s ease-out, opacity 0.22s ease-out';
        img.style.transform = `translateX(${exit})`;
        img.style.opacity = '0';
        this.swipeTimeout = setTimeout(() => {
          this.swipeTimeout = null;
          this.current = (this.current + dir + this.total) % this.total;
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
        // `offsetParent === null` couvre à la fois `.hidden` (total < 2) et le
        // `display: none` posé par le media query mobile sur `.lightbox__nav-row` —
        // un seul test de focusabilité réelle au lieu de deux mécanismes qui
        // pouvaient diverger (le second ne touchait jamais `.hidden`).
        const focusable = [this.prev().nativeElement, this.next().nativeElement, this.gridBtn().nativeElement]
          .filter(el => el.offsetParent !== null);
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

    this.navRow().nativeElement.hidden =
      this.prev().nativeElement.hidden =
      this.next().nativeElement.hidden =
      this.total < 2;
  }

  private open(index: number): void {
    this.lastFocused = document.activeElement;
    this.current = index;
    this.update();
    this.el().nativeElement.classList.add('is-open');
    this.el().nativeElement.removeAttribute('aria-hidden');
    document.body.style.overflow = 'hidden';
    this.gridBtn().nativeElement.focus();
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
    const next = (this.current + dir + this.total) % this.total;

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
