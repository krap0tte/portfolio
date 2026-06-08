// ─── Cover ───────────────────────────────────────────────────────────────────

class Cover {
  #el;
  #picture;
  #img;
  #name;
  #btn;
  #dismissed = false;
  #removeKeyListener = null;

  constructor() {
    this.#el      = document.getElementById('cover');
    this.#picture = document.getElementById('cover-picture');
    this.#img     = document.getElementById('cover-img');
    this.#name    = document.getElementById('cover-name');
    this.#btn     = document.getElementById('cover-enter');
    if (!this.#el || !this.#picture || !this.#img || !this.#btn) return;

    document.body.style.overflow = 'hidden';

    const reveal = () => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        this.#picture.classList.add('is-visible');
        setTimeout(() => {
          this.#name?.classList.add('is-visible');
          this.#btn.classList.add('is-visible');
        }, 450);
      }));
    };

    if (this.#img.complete && this.#img.naturalWidth > 0) {
      reveal();
    } else {
      this.#img.addEventListener('load',  reveal, { once: true });
      this.#img.addEventListener('error', reveal, { once: true });
    }

    this.#btn.addEventListener('click', () => this.#dismiss(), { once: true });

    const onKey = e => { if (e.key === 'Escape') this.#dismiss(); };
    document.addEventListener('keydown', onKey);
    this.#removeKeyListener = () => document.removeEventListener('keydown', onKey);
  }

  #dismiss() {
    if (this.#dismissed) return;
    this.#dismissed = true;
    this.#removeKeyListener?.();

    document.body.style.overflow = '';
    this.#name?.classList.remove('is-visible');
    this.#btn.classList.remove('is-visible');

    setTimeout(() => {
      this.#el.classList.add('is-leaving');
      const onEnd = e => {
        if (e.target !== this.#el || e.propertyName !== 'opacity') return;
        this.#el.removeEventListener('transitionend', onEnd);
        this.#el.hidden = true;
      };
      this.#el.addEventListener('transitionend', onEnd);
    }, 250);
  }
}

// ─── Gallery ─────────────────────────────────────────────────────────────────

// Étend EventTarget pour émettre `filterchange` — Lightbox et FilterMobileMenu
// s'abonnent sans couplage direct.
class Gallery extends EventTarget {
  #cards;
  #filterBtns;
  #seriesData;
  #indicator;
  #pill;
  #title;
  #desc;

  constructor() {
    super();
    this.#cards      = document.querySelectorAll('.gallery-card');
    this.#filterBtns = document.querySelectorAll('.filter-pill__btn');
    this.#pill       = document.querySelector('.filter-pill');
    this.#title      = document.getElementById('gallery-heading-title');
    this.#desc       = document.getElementById('gallery-heading-desc');

    const seriesEl   = document.getElementById('series-data');
    this.#seriesData = seriesEl ? JSON.parse(seriesEl.textContent) : {};

    this.#indicator = document.querySelector('.filter-pill__indicator');
    if (this.#indicator) {
      this.#indicator.style.transition = 'none';
      const initial = this.#pill?.querySelector('.filter-pill__btn.is-active');
      if (initial) this.#moveIndicator(initial);
      requestAnimationFrame(() => { this.#indicator.style.transition = ''; });
    }

    this.#bindFilters();
    this.#bindImageFadeIn();
  }

  // Exposé pour que Lightbox attache ses listeners sur les cards.
  get cards() { return this.#cards; }

  // Ignoré si le bouton est hors de .filter-pill (overlay mobile).
  #moveIndicator(btn) {
    if (!this.#indicator || !this.#pill) return;
    if (!this.#pill.contains(btn)) return;
    const pillRect = this.#pill.getBoundingClientRect();
    const btnRect  = btn.getBoundingClientRect();
    this.#indicator.style.transform = `translateX(${btnRect.left - pillRect.left}px)`;
    this.#indicator.style.width     = `${btnRect.width}px`;
  }

  #bindFilters() {
    this.#filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.#filterBtns.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.#moveIndicator(btn);

        const filter = btn.dataset.filter;
        const label  = btn.textContent.trim();

        if (this.#title) this.#title.style.opacity = '0';
        if (this.#desc)  this.#desc.style.opacity  = '0';
        this.#cards.forEach(card => {
          if (card.style.display !== 'none') card.style.opacity = '0';
        });

        setTimeout(() => {
          if (this.#title) this.#title.textContent = filter === 'all' ? 'Toutes les photos' : label;
          if (this.#desc)  this.#desc.textContent  = filter === 'all' ? '' : (this.#seriesData[filter] || '');

          const visible = [];
          this.#cards.forEach(card => {
            const show = filter === 'all' || card.dataset.category === filter;
            if (show) {
              card.style.display = '';
              card.style.opacity = '0';
              visible.push(Number(card.dataset.index));
            } else {
              card.style.display = 'none';
              card.style.opacity = '';
            }
          });

          // Inclut filter et label pour que les abonnés mettent à jour leur UI sans interroger le DOM.
          this.dispatchEvent(new CustomEvent('filterchange', { detail: { visible, filter, label } }));

          // Premier rAF : opacity:0 committée ; second : inline style retiré → transition CSS 0→1.
          requestAnimationFrame(() => requestAnimationFrame(() => {
            if (this.#title) this.#title.style.opacity = '';
            if (this.#desc)  this.#desc.style.opacity  = '';
            this.#cards.forEach(card => {
              if (card.style.display !== 'none') card.style.opacity = '';
            });
          }));
        }, 200);
      });
    });
  }

  #bindImageFadeIn() {
    this.#cards.forEach(card => {
      const img  = card.querySelector('img');
      const wrap = card.querySelector('.gallery-card__img-wrap');
      if (!img) return;
      const markLoaded = () => {
        img.classList.add('is-loaded');
        wrap?.classList.add('is-loaded');
      };
      if (img.complete && img.naturalWidth > 0) markLoaded();
      else img.addEventListener('load', markLoaded, { once: true });
    });
  }
}

// ─── FilterMobileMenu ────────────────────────────────────────────────────────

class FilterMobileMenu {
  #trigger;
  #label;
  #menu;
  #closeBtn;

  constructor(gallery) {
    this.#trigger  = document.getElementById('filter-mobile-trigger');
    this.#label    = document.getElementById('filter-mobile-label');
    this.#menu     = document.getElementById('filter-mobile-menu');
    this.#closeBtn = document.getElementById('filter-mobile-close');
    if (!this.#trigger || !this.#menu) return;

    this.#trigger.addEventListener('click', () => this.#toggle());
    this.#closeBtn?.addEventListener('click', () => this.#close());

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.#menu.classList.contains('is-open')) this.#close();
    });

    gallery.addEventListener('filterchange', e => {
      if (this.#label) {
        this.#label.textContent = e.detail.filter === 'all' ? 'Séries' : e.detail.label;
      }
      if (this.#menu.classList.contains('is-open')) this.#close();
    });
  }

  #toggle() {
    this.#menu.classList.contains('is-open') ? this.#close() : this.#open();
  }

  #open() {
    this.#menu.classList.add('is-open');
    this.#trigger.setAttribute('aria-expanded', 'true');
    this.#menu.setAttribute('aria-hidden', 'false');
    this.#closeBtn?.focus();
  }

  #close() {
    this.#menu.classList.remove('is-open');
    this.#trigger.setAttribute('aria-expanded', 'false');
    this.#menu.setAttribute('aria-hidden', 'true');
    this.#trigger.focus();
  }
}

// ─── Lightbox ────────────────────────────────────────────────────────────────

// Maintient #visible à jour via filterchange pour que la navigation
// respecte le filtre actif sans interroger le DOM.
class Lightbox {
  #photos;
  #el;
  #img;
  #info;
  #title;
  #meta;
  #location;
  #desc;
  #closeBtn;
  #prev;
  #next;
  #stage;
  #loader;
  #current     = 0;
  #lastFocused = null;
  #visible     = [];
  #navTimeout  = null;

  constructor(gallery) {
    const dataEl = document.getElementById('photo-data');
    if (!dataEl) return;

    this.#photos = JSON.parse(dataEl.textContent);
    this.#el     = document.getElementById('lightbox');
    if (!this.#el) return;

    this.#img      = document.getElementById('lightbox-img');
    this.#info     = document.getElementById('lightbox-info');
    this.#title    = document.getElementById('lightbox-title');
    this.#meta     = document.getElementById('lightbox-meta');
    this.#location = document.getElementById('lightbox-location');
    this.#desc     = document.getElementById('lightbox-description');
    this.#closeBtn = document.getElementById('lightbox-close');
    this.#prev     = document.getElementById('lightbox-prev');
    this.#next     = document.getElementById('lightbox-next');
    this.#stage    = document.getElementById('lightbox-stage');
    this.#loader   = document.getElementById('lightbox-loader');

    this.#visible = this.#photos.map((_, i) => i);
    this.#bind(gallery);
  }

  #bind(gallery) {
    // e.preventDefault() uniquement si la lightbox est initialisée — les cards
    // restent des <a> fonctionnels si #lightbox est absent.
    gallery.cards.forEach(card => {
      card.addEventListener('click', e => {
        e.preventDefault();
        this.#open(Number(card.dataset.index));
      });
    });

    gallery.addEventListener('filterchange', e => {
      this.#visible = e.detail.visible;
      if (this.#el.classList.contains('is-open')) {
        this.#prev.hidden = this.#next.hidden = this.#visible.length < 2;
      }
    });

    this.#closeBtn.addEventListener('click', () => this.#close());
    this.#prev.addEventListener('click', () => this.#navigate(-1));
    this.#next.addEventListener('click', () => this.#navigate(1));

    this.#stage.addEventListener('click', e => {
      if (e.target === this.#stage) this.#close();
    });

    document.addEventListener('keydown', e => {
      if (!this.#el.classList.contains('is-open')) return;
      if (e.key === 'Escape')     this.#close();
      if (e.key === 'ArrowLeft')  this.#navigate(-1);
      if (e.key === 'ArrowRight') this.#navigate(1);
    });
  }

  #update() {
    const p = this.#photos[this.#current];

    this.#img.classList.add('is-loading');
    this.#loader.classList.add('is-visible');

    const onLoad = () => {
      this.#img.classList.remove('is-loading');
      this.#loader.classList.remove('is-visible');
    };
    this.#img.onload = onLoad;

    this.#img.alt = p.title;
    if (p.webp) {
      this.#img.onerror = () => { this.#img.onerror = null; this.#img.src = p.src; };
      this.#img.src = p.webp;
    } else {
      this.#img.src = p.src;
    }
    if (this.#img.complete && this.#img.naturalWidth) onLoad();

    this.#title.textContent    = p.title;
    this.#meta.textContent     = [p.category, p.date].filter(Boolean).join(' · ');
    this.#location.textContent = p.location;
    this.#location.hidden      = !p.location;
    this.#desc.textContent     = p.description;
    this.#desc.hidden          = !p.description;
    this.#prev.hidden = this.#next.hidden = this.#visible.length < 2;
  }

  #open(index) {
    this.#lastFocused = document.activeElement;
    this.#current = index;
    this.#update();
    this.#el.classList.add('is-open');
    this.#el.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    this.#closeBtn.focus();
  }

  #close() {
    this.#el.classList.remove('is-open');
    this.#el.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    this.#lastFocused?.focus();
  }

  #navigate(dir) {
    if (this.#navTimeout) clearTimeout(this.#navTimeout);

    const pos  = this.#visible.indexOf(this.#current);
    const next = this.#visible[(pos + dir + this.#visible.length) % this.#visible.length];

    this.#img.style.opacity  = '0';
    if (this.#info) this.#info.style.opacity = '0';

    this.#navTimeout = setTimeout(() => {
      this.#navTimeout        = null;
      this.#current           = next;
      this.#img.style.opacity = '';
      this.#update();
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (this.#info) this.#info.style.opacity = '';
      }));
    }, 200);
  }
}

// ─── ThemeToggle ─────────────────────────────────────────────────────────────

class ThemeToggle {
  #btn;

  constructor() {
    this.#btn = document.getElementById('theme-toggle');
    if (!this.#btn) return;
    this.#updateLabel();
    this.#btn.addEventListener('click', () => {
      const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('theme', next);
      this.#updateLabel();
    });
    // Suit la préférence système si aucun override manuel n'est actif.
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!localStorage.getItem('theme')) {
        document.documentElement.dataset.theme = e.matches ? 'dark' : 'light';
        this.#updateLabel();
      }
    });
  }

  #updateLabel() {
    const isDark = document.documentElement.dataset.theme === 'dark';
    this.#btn.setAttribute('aria-label', isDark ? 'Passer en thème clair' : 'Passer en thème sombre');
  }
}

// ─── Init ────────────────────────────────────────────────────────────────────

new Cover();
const gallery = new Gallery();
new FilterMobileMenu(gallery);
new Lightbox(gallery);
new ThemeToggle();
