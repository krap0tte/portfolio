// ─── Gallery ─────────────────────────────────────────────────────────────────

class Gallery extends EventTarget {
  #cards;
  #filterBtns;
  #seriesData;

  constructor() {
    super();
    this.#cards      = document.querySelectorAll('.gallery-card');
    this.#filterBtns = document.querySelectorAll('.filter-pill__btn');

    const seriesEl   = document.getElementById('series-data');
    this.#seriesData = seriesEl ? JSON.parse(seriesEl.textContent) : {};

    this.#bindFilters();
    this.#bindImageFadeIn();
  }

  get cards() { return this.#cards; }

  #bindFilters() {
    const title = document.getElementById('gallery-heading-title');
    const desc  = document.getElementById('gallery-heading-desc');

    this.#filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.#filterBtns.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');

        const filter = btn.dataset.filter;

        if (title) title.textContent = filter === 'all' ? 'Toutes les photos' : btn.textContent.trim();
        if (desc)  desc.textContent  = filter === 'all' ? '' : (this.#seriesData[filter] || '');

        this.#cards.forEach(card => {
          if (card.style.display !== 'none') card.style.opacity = '0';
        });

        setTimeout(() => {
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

          this.dispatchEvent(new CustomEvent('filterchange', { detail: { visible } }));

          requestAnimationFrame(() => requestAnimationFrame(() => {
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
      else img.addEventListener('load', markLoaded);
    });
  }
}

// ─── Lightbox ────────────────────────────────────────────────────────────────

class Lightbox {
  #photos;
  #el;
  #img;
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

  constructor(gallery) {
    const dataEl = document.getElementById('photo-data');
    if (!dataEl) return;

    this.#photos = JSON.parse(dataEl.textContent);
    this.#el     = document.getElementById('lightbox');
    if (!this.#el) return;

    this.#img      = document.getElementById('lightbox-img');
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

    this.#img.onload = () => {
      this.#img.classList.remove('is-loading');
      this.#loader.classList.remove('is-visible');
    };

    this.#img.alt = p.title;
    if (p.webp) {
      this.#img.onerror = () => { this.#img.onerror = null; this.#img.src = p.src; };
      this.#img.src = p.webp;
    } else {
      this.#img.src = p.src;
    }
    if (this.#img.complete && this.#img.naturalWidth) this.#img.onload();

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
    const pos     = this.#visible.indexOf(this.#current);
    this.#current = this.#visible[(pos + dir + this.#visible.length) % this.#visible.length];
    this.#update();
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

const gallery = new Gallery();
new Lightbox(gallery);
new ThemeToggle();
