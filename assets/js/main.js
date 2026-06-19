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
      // Double rAF : garantit que le navigateur a rendu opacity:0 avant
      // d'ajouter is-visible, sinon la transition CSS ne joue pas.
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
      let fallback;
      const onEnd = e => {
        if (e.target !== this.#el || e.propertyName !== 'opacity') return;
        clearTimeout(fallback);
        this.#el.removeEventListener('transitionend', onEnd);
        this.#el.hidden = true;
      };
      this.#el.addEventListener('transitionend', onEnd);
      fallback = setTimeout(() => {
        this.#el.removeEventListener('transitionend', onEnd);
        this.#el.hidden = true;
      }, 800);
    }, 250);
  }
}

// ─── Gallery ─────────────────────────────────────────────────────────────────

// Étend EventTarget pour émettre `filterchange` — Lightbox et FilterMobileMenu
// s'abonnent sans couplage direct.
class Gallery extends EventTarget {
  #cards;
  #filterBtns;
  #indicator;
  #pill;
  #filterTimeout = null;

  constructor() {
    super();
    this.#cards      = document.querySelectorAll('.gallery-card');
    this.#filterBtns = document.querySelectorAll('.filter-pill__btn');
    this.#pill       = document.querySelector('.filter-pill');

    this.#indicator = document.querySelector('.filter-pill__indicator');
    if (this.#indicator) {
      const initial = this.#pill?.querySelector('.filter-pill__btn.is-active');
      if (initial) {
        // Attend que les fontes soient prêtes avant de mesurer : font-display:block
        // retient le rendu mais le script s'exécute en parallèle du chargement.
        document.fonts.ready.then(() => {
          this.#moveIndicator(initial);
          requestAnimationFrame(() => { this.#pill?.classList.add('filter-pill--ready'); });
        });
      }
      // La pill est display:none sur mobile : offsetLeft/offsetWidth valent 0,
      // donc l'indicateur est mal positionné si une sélection est faite dans le
      // menu mobile. On re-mesure dès que la pill redevient visible.
      window.matchMedia('(min-width: 768px)').addEventListener('change', e => {
        if (!e.matches) return;
        const active = this.#pill?.querySelector('.filter-pill__btn.is-active');
        if (active) this.#moveIndicator(active);
      });
    }

    this.#bindFilters();
    this.#bindImageFadeIn();
    // Déclenche après que Lightbox et FilterMobileMenu ont souscrit à filterchange
    queueMicrotask(() => {
      const btn = this.#pill?.querySelector('.filter-pill__btn.is-active');
      if (btn) this.#filter(btn.dataset.filter, btn.textContent.trim(), false);
    });
  }

  // Exposé pour que Lightbox attache ses listeners sur les cards.
  get cards() { return this.#cards; }

  // Ignoré si le bouton est hors de .filter-pill (overlay mobile).
  #moveIndicator(btn) {
    if (!this.#indicator || !this.#pill) return;
    if (!this.#pill.contains(btn)) return;
    this.#indicator.style.transform = `translateX(${btn.offsetLeft}px)`;
    this.#indicator.style.width     = `${btn.offsetWidth}px`;
  }

  #bindFilters() {
    this.#filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        // Synchronise l'état actif sur pill ET menu mobile simultanément.
        this.#filterBtns.forEach(b => {
          b.classList.toggle('is-active', b.dataset.filter === filter);
          b.setAttribute('aria-pressed', String(b.dataset.filter === filter));
        });
        const pillBtn = [...this.#filterBtns].find(b => b.dataset.filter === filter && this.#pill?.contains(b));
        if (pillBtn) this.#moveIndicator(pillBtn);
        this.#filter(filter, btn.textContent.trim(), true);
      });
    });
  }

  #filter(filter, label, animate) {
    if (this.#filterTimeout) { clearTimeout(this.#filterTimeout); this.#filterTimeout = null; }
    if (animate) {
      this.#cards.forEach(card => {
        if (card.style.display !== 'none') card.style.opacity = '0';
      });
    }

    const apply = () => {
      const visible = [];
      this.#cards.forEach(card => {
        const show = card.dataset.category === filter;
        if (show) {
          card.style.display = '';
          if (animate) card.style.opacity = '0';
          visible.push(Number(card.dataset.index));
        } else {
          card.style.display = 'none';
          card.style.opacity = '';
        }
      });

      this.dispatchEvent(new CustomEvent('filterchange', { detail: { visible, filter, label } }));

      if (animate) {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          this.#cards.forEach(card => {
            if (card.style.display !== 'none') card.style.opacity = '';
          });
        }));
      }
    };

    if (animate) this.#filterTimeout = setTimeout(() => { this.#filterTimeout = null; apply(); }, 200);
    else apply();
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
      else {
        img.addEventListener('load',  markLoaded, { once: true });
        img.addEventListener('error', markLoaded, { once: true });
      }
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
      if (!this.#menu.classList.contains('is-open')) return;
      if (e.key === 'Escape') { this.#close(); return; }
      if (e.key === 'Tab') {
        const focusable = [this.#closeBtn, ...this.#menu.querySelectorAll('.filter-pill__btn')].filter(Boolean);
        const first = focusable[0];
        const last  = focusable[focusable.length - 1];
        if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        }
      }
    });

    gallery.addEventListener('filterchange', e => {
      if (this.#label) this.#label.textContent = e.detail.label;
      if (this.#menu.classList.contains('is-open')) this.#close();
    });
  }

  #toggle() {
    this.#menu.classList.contains('is-open') ? this.#close() : this.#open();
  }

  #open() {
    this.#menu.classList.add('is-open');
    this.#trigger.setAttribute('aria-expanded', 'true');
    this.#menu.removeAttribute('aria-hidden');
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
  #closeBtn;
  #prev;
  #next;
  #stage;
  #loader;
  #current      = 0;
  #lastFocused  = null;
  #visible      = [];
  #navTimeout   = null;
  #swipeTimeout = null;

  constructor(gallery) {
    const dataEl = document.getElementById('photo-data');
    if (!dataEl) return;

    try {
      this.#photos = JSON.parse(dataEl.textContent);
    } catch {
      return;
    }
    this.#el = document.getElementById('lightbox');
    if (!this.#el) return;

    this.#img = document.getElementById('lightbox-img');
    this.#closeBtn = document.getElementById('lightbox-close');
    this.#prev     = document.getElementById('lightbox-prev');
    this.#next     = document.getElementById('lightbox-next');
    this.#stage  = document.getElementById('lightbox-stage');
    this.#loader = document.getElementById('lightbox-loader');
    if (!this.#img || !this.#closeBtn || !this.#prev || !this.#next || !this.#stage || !this.#loader) return;

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

    let swipeStartX   = 0;
    let swipeDragging = false;

    const snapBack = () => {
      this.#img.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
      this.#img.style.transform  = '';
      this.#img.style.opacity    = '';
      setTimeout(() => { this.#img.style.transition = ''; }, 300);
    };

    this.#stage.addEventListener('touchstart', e => {
      // Annule une navigation en cours pour qu'un swipe ne charge pas deux photos.
      if (this.#navTimeout) { clearTimeout(this.#navTimeout); this.#navTimeout = null; }
      swipeStartX   = e.touches[0].clientX;
      swipeDragging = false;
      this.#img.style.transition = 'none';
    }, { passive: true });

    this.#stage.addEventListener('touchmove', e => {
      const delta = e.touches[0].clientX - swipeStartX;
      if (!swipeDragging && Math.abs(delta) > 6) swipeDragging = true;
      if (swipeDragging && this.#visible.length > 1) {
        this.#img.style.transform = `translateX(${delta}px)`;
        this.#img.style.opacity   = String(Math.max(0, 1 - Math.abs(delta) / (window.innerWidth * 0.6)));
      }
    }, { passive: true });

    this.#stage.addEventListener('touchend', e => {
      if (!swipeDragging) { this.#img.style.transition = ''; swipeDragging = false; return; }
      const delta     = e.changedTouches[0].clientX - swipeStartX;
      const threshold = window.innerWidth * 0.25;

      if (this.#visible.length > 1 && Math.abs(delta) > threshold) {
        const dir  = delta < 0 ? 1 : -1;
        const exit = delta < 0 ? '-110%' : '110%';
        this.#img.style.transition = 'transform 0.22s ease-out, opacity 0.22s ease-out';
        this.#img.style.transform  = `translateX(${exit})`;
        this.#img.style.opacity    = '0';
        this.#swipeTimeout = setTimeout(() => {
          this.#swipeTimeout = null;
          const pos = this.#visible.indexOf(this.#current);
          this.#current = this.#visible[(pos + dir + this.#visible.length) % this.#visible.length];
          this.#img.style.transition = 'none';
          this.#img.style.transform  = '';
          this.#img.style.opacity    = '';
          this.#update();
          requestAnimationFrame(() => { this.#img.style.transition = ''; });
        }, 220);
      } else {
        snapBack();
      }
      swipeDragging = false;
    }, { passive: true });

    this.#stage.addEventListener('touchcancel', () => {
      if (swipeDragging) snapBack();
      swipeDragging = false;
    }, { passive: true });

    document.addEventListener('keydown', e => {
      if (!this.#el.classList.contains('is-open')) return;
      if (e.key === 'Escape')     { this.#close(); return; }
      if (e.key === 'ArrowLeft')  { this.#navigate(-1); return; }
      if (e.key === 'ArrowRight') { this.#navigate(1); return; }
      if (e.key === 'Tab') {
        const focusable = [this.#closeBtn, this.#prev, this.#next].filter(el => !el.hidden);
        const first = focusable[0];
        const last  = focusable[focusable.length - 1];
        if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        }
      }
    });
  }

  #update() {
    const p = this.#photos[this.#current];

    this.#img.classList.add('is-loading');
    this.#loader.classList.add('is-visible');
    this.#img.style.width  = '';
    this.#img.style.height = '';

    const onLoad = () => {
      this.#img.onload = null;
      this.#img.classList.remove('is-loading');
      this.#loader.classList.remove('is-visible');
      const dpr   = window.devicePixelRatio || 1;
      const physW = this.#stage.clientWidth  * dpr;
      const physH = this.#stage.clientHeight * dpr;
      if (this.#img.naturalWidth < physW && this.#img.naturalHeight < physH) {
        this.#img.style.width  = `${this.#img.naturalWidth  / dpr}px`;
        this.#img.style.height = `${this.#img.naturalHeight / dpr}px`;
      }
    };
    this.#img.onload = onLoad;
    this.#img.onerror = () => {
      this.#img.onload  = null;
      this.#img.onerror = null;
      this.#img.classList.remove('is-loading');
      this.#loader.classList.remove('is-visible');
    };

    this.#img.alt = '';
    this.#img.src = p.src;
    if (this.#img.complete && this.#img.naturalWidth) onLoad();

    this.#prev.hidden = this.#next.hidden = this.#visible.length < 2;
  }

  #open(index) {
    this.#lastFocused = document.activeElement;
    this.#current = index;
    this.#update();
    this.#el.classList.add('is-open');
    this.#el.removeAttribute('aria-hidden');
    document.body.style.overflow = 'hidden';
    this.#closeBtn.focus();
  }

  #close() {
    if (this.#navTimeout)   { clearTimeout(this.#navTimeout);   this.#navTimeout   = null; }
    if (this.#swipeTimeout) { clearTimeout(this.#swipeTimeout); this.#swipeTimeout = null; }
    this.#el.classList.remove('is-open');
    this.#el.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    this.#lastFocused?.focus();
  }

  #navigate(dir) {
    if (this.#navTimeout) clearTimeout(this.#navTimeout);

    const pos  = this.#visible.indexOf(this.#current);
    const next = this.#visible[(pos + dir + this.#visible.length) % this.#visible.length];

    this.#img.style.opacity = '0';

    this.#navTimeout = setTimeout(() => {
      this.#navTimeout        = null;
      this.#current           = next;
      this.#img.style.opacity = '';
      this.#update();
    }, 200);
  }
}

// ─── Init ────────────────────────────────────────────────────────────────────

new Cover();
const gallery = new Gallery();
new FilterMobileMenu(gallery);
new Lightbox(gallery);
