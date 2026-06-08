// ─── Gallery ─────────────────────────────────────────────────────────────────

// Gère la grille : filtrage par série avec animation, fondu des images
// au chargement. Étend EventTarget pour émettre `filterchange` — Lightbox
// et FilterMobileMenu s'abonnent sans que les classes se connaissent.
class Gallery extends EventTarget {
  #cards;
  #filterBtns;
  #seriesData;
  #indicator;

  constructor() {
    super();
    this.#cards      = document.querySelectorAll('.gallery-card');
    this.#filterBtns = document.querySelectorAll('.filter-pill__btn');

    const seriesEl   = document.getElementById('series-data');
    this.#seriesData = seriesEl ? JSON.parse(seriesEl.textContent) : {};

    // Positionner l'indicateur sans transition au chargement initial
    this.#indicator = document.querySelector('.filter-pill__indicator');
    if (this.#indicator) {
      this.#indicator.style.transition = 'none';
      const initial = document.querySelector('.filter-pill .filter-pill__btn.is-active');
      if (initial) this.#moveIndicator(initial);
      requestAnimationFrame(() => { this.#indicator.style.transition = ''; });
    }

    this.#bindFilters();
    this.#bindImageFadeIn();
  }

  // Exposé pour que Lightbox puisse attacher ses propres listeners de clic
  // sur les cards sans accéder directement au DOM global.
  get cards() { return this.#cards; }

  // Déplace l'indicateur sous le bouton donné. Ignoré si le bouton est dans
  // l'overlay mobile (hors .filter-pill) pour ne pas perturber la pill desktop.
  #moveIndicator(btn) {
    if (!this.#indicator) return;
    const pill = btn.closest('.filter-pill');
    if (!pill) return;
    const pillRect = pill.getBoundingClientRect();
    const btnRect  = btn.getBoundingClientRect();
    this.#indicator.style.transform = `translateX(${btnRect.left - pillRect.left}px)`;
    this.#indicator.style.width     = `${btnRect.width}px`;
  }

  #bindFilters() {
    const title = document.getElementById('gallery-heading-title');
    const desc  = document.getElementById('gallery-heading-desc');

    this.#filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.#filterBtns.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.#moveIndicator(btn);

        const filter = btn.dataset.filter;
        const label  = btn.textContent.trim();

        if (title) title.textContent = filter === 'all' ? 'Toutes les photos' : label;
        if (desc)  desc.textContent  = filter === 'all' ? '' : (this.#seriesData[filter] || '');

        // Fondu sortant des cards visibles (correspond à la transition CSS 0.2s).
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

          // filter et label sont inclus pour que les abonnés (ex. FilterMobileMenu)
          // puissent mettre à jour leur UI sans interroger le DOM.
          this.dispatchEvent(new CustomEvent('filterchange', { detail: { visible, filter, label } }));

          // Double rAF : le premier frame valide l'état opacity:0 dans le moteur
          // de rendu ; le second retire le style inline pour déclencher la
          // transition CSS vers l'opacité naturelle (1).
          requestAnimationFrame(() => requestAnimationFrame(() => {
            this.#cards.forEach(card => {
              if (card.style.display !== 'none') card.style.opacity = '';
            });
          }));
        }, 200);
      });
    });
  }

  // Ajoute `is-loaded` sur l'<img> et son conteneur dès que l'image est
  // disponible, ce qui déclenche la transition CSS opacity 0→1 et masque
  // le shimmer. Gère le cas des images déjà en cache (img.complete).
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

// ─── FilterMobileMenu ────────────────────────────────────────────────────────

// Gère le bouton trigger et l'overlay plein écran du filtre sur mobile.
// Écoute filterchange pour mettre à jour le label du trigger et fermer
// l'overlay après sélection — sans couplage direct avec Gallery.
class FilterMobileMenu {
  #trigger;
  #label;
  #menu;

  constructor(gallery) {
    this.#trigger = document.getElementById('filter-mobile-trigger');
    this.#label   = document.getElementById('filter-mobile-label');
    this.#menu    = document.getElementById('filter-mobile-menu');
    if (!this.#trigger || !this.#menu) return;

    this.#trigger.addEventListener('click', () => this.#toggle());

    document.getElementById('filter-mobile-close')
      ?.addEventListener('click', () => this.#close());

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
    document.getElementById('filter-mobile-close')?.focus();
  }

  #close() {
    this.#menu.classList.remove('is-open');
    this.#trigger.setAttribute('aria-expanded', 'false');
    this.#menu.setAttribute('aria-hidden', 'true');
    this.#trigger.focus();
  }
}

// ─── Lightbox ────────────────────────────────────────────────────────────────

// Visionneuse plein écran : ouverture au clic sur une card, navigation
// clavier (←/→/Escape) et au clic sur les boutons, fermeture sur le fond.
// Maintient #visible à jour via filterchange pour que la navigation
// respecte le filtre actif sans interroger le DOM.
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
    // Les listeners de clic sont ici plutôt que dans Gallery : e.preventDefault()
    // n'est appliqué que si la lightbox est entièrement initialisée ; les cards
    // restent des <a> fonctionnels si l'élément #lightbox est absent de la page.
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

  // Met à jour le contenu de la lightbox pour la photo courante.
  // Tente le WebP en priorité, bascule sur JPEG via onerror.
  // Si l'image est déjà en cache (complete && naturalWidth > 0), le
  // navigateur ne déclenche pas onload — on l'appelle manuellement.
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

  // Navigation cyclique dans la liste des photos visibles (filtre actif).
  #navigate(dir) {
    const pos     = this.#visible.indexOf(this.#current);
    this.#current = this.#visible[(pos + dir + this.#visible.length) % this.#visible.length];
    this.#update();
  }
}

// ─── ThemeToggle ─────────────────────────────────────────────────────────────

// Gère le bouton de bascule clair/sombre. Le thème initial est appliqué
// par un script inline dans <head> (default.html) avant le premier rendu
// pour éviter le flash de contenu non stylé — cette classe s'occupe
// uniquement de l'interaction et des changements de préférence système.
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
    // Si aucun override manuel, suit les changements de préférence système en direct.
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
new FilterMobileMenu(gallery);
new Lightbox(gallery);
new ThemeToggle();
