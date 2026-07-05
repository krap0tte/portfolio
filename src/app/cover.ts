import { Component, ElementRef, afterNextRender, isDevMode, viewChild } from '@angular/core';
import { BP_MD } from './constants';

@Component({
  selector: 'app-cover',
  host: { '(document:keydown.escape)': 'dismiss()' },
  template: `
    <div class="cover" #cover role="region" aria-label="Bienvenue">
      <picture class="cover__picture" #picture>
        @if (prod) {
          <source [attr.media]="mobileMedia" srcset="assets/images/cover/cover_phone.webp" type="image/webp" />
        }
        <source [attr.media]="mobileMedia" srcset="assets/images/cover/cover_phone.jpg" />
        @if (prod) {
          <source srcset="assets/images/cover/cover.webp 1x, assets/images/cover/cover-2x.webp 2x" type="image/webp" />
        }
        <img class="cover__img" #img src="assets/images/cover/cover.jpg" alt="" fetchpriority="high" />
      </picture>
      <button class="cover__enter" #btn (click)="dismiss()">Entrer</button>
    </div>
  `,
})
export class Cover {
  protected readonly prod = !isDevMode();
  protected readonly mobileMedia = `(max-width: ${BP_MD - 1}px)`;

  private readonly el = viewChild.required<ElementRef<HTMLElement>>('cover');
  private readonly picture = viewChild.required<ElementRef<HTMLElement>>('picture');
  private readonly img = viewChild.required<ElementRef<HTMLImageElement>>('img');
  private readonly btn = viewChild.required<ElementRef<HTMLElement>>('btn');

  private dismissed = false;

  constructor() {
    afterNextRender(() => {
      document.body.style.overflow = 'hidden';

      const img = this.img().nativeElement;
      const reveal = () => {
        // Double rAF : garantit que le navigateur a rendu opacity:0 avant
        // d'ajouter is-visible, sinon la transition CSS ne joue pas.
        requestAnimationFrame(() => requestAnimationFrame(() => {
          this.picture().nativeElement.classList.add('is-visible');
          setTimeout(() => { this.btn().nativeElement.classList.add('is-visible'); }, 450);
        }));
      };

      if (img.complete && img.naturalWidth > 0) reveal();
      else {
        img.addEventListener('load', reveal, { once: true });
        img.addEventListener('error', reveal, { once: true });
      }
    });
  }

  protected dismiss(): void {
    if (this.dismissed) return;
    this.dismissed = true;

    document.body.style.overflow = '';
    this.btn().nativeElement.classList.remove('is-visible');

    const el = this.el().nativeElement;
    setTimeout(() => {
      el.classList.add('is-leaving');
      let fallback: ReturnType<typeof setTimeout>;
      const onEnd = (e: TransitionEvent) => {
        if (e.target !== el || e.propertyName !== 'opacity') return;
        clearTimeout(fallback);
        el.removeEventListener('transitionend', onEnd);
        el.hidden = true;
      };
      el.addEventListener('transitionend', onEnd);
      fallback = setTimeout(() => {
        el.removeEventListener('transitionend', onEnd);
        el.hidden = true;
      }, 800);
    }, 250);
  }
}
