/* Galerie photo — HTML/CSS/JS vanilla, aucune dépendance, aucun build.
   Script classique (pas de module ES) : index.html s'ouvre même en file://. */
(function () {
  'use strict';

  // ─── Photos — source unique de vérité ──────────────────────────────────────
  // Fournie par le template Zola (templates/base.html, bloc `photos`), déjà
  // triée (plus récentes en premier) et déjà sous la forme {full, thumb, thumb2x}.
  // Ne pas éditer à la main : dérivée de data/photos.toml, régénéré par
  // bin/add-photo.sh.
  var PHOTOS = window.PHOTOS || [];

  var TOTAL = PHOTOS.length;

  // Largeur occupée par une miniature de la grille, par palier — doit suivre le
  // nombre de colonnes de `.gallery-grid__container` dans style.css (2 → 6).
  var GRID_SIZES = '(min-width: 2000px) 16vw, (min-width: 1600px) 19vw, ' +
                   '(min-width: 1280px) 24vw, (min-width: 1024px) 32vw, 46vw';

  // ─── Piège de focus Tab/Shift+Tab (dialog modale) ──────────────────────────
  function trapTabFocus(focusable, e) {
    if (focusable.length === 0) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    var atEdge = e.shiftKey
      ? document.activeElement === first
      : document.activeElement === last;
    if (atEdge) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    }
  }

  // ─── Lightbox ───────────────────────────────────────────────────────────────
  var lightbox = (function () {
    var root, stage, img, loader, navRow, prevBtn, nextBtn, gridBtn;
    var current = 0;
    var lastFocused = null;
    var navTimeout = null;   // nav clic/clavier
    var swipeTimeout = null; // nav swipe

    // Dérivé de la classe DOM — pas d'état à garder synchronisé séparément.
    function isOpen() {
      return root.classList.contains('is-open');
    }

    // Les deux timers sont annulés ensemble dès qu'une nouvelle navigation
    // démarre — sinon un swipe suivi d'un clic sur une flèche fait cohabiter
    // deux mises à jour de `current`.
    function clearTimeouts() {
      if (navTimeout) { clearTimeout(navTimeout); navTimeout = null; }
      if (swipeTimeout) { clearTimeout(swipeTimeout); swipeTimeout = null; }
    }

    function update() {
      var p = PHOTOS[current];

      img.classList.add('is-loading');
      loader.classList.add('is-visible');
      img.style.width = '';
      img.style.height = '';

      var onLoad = function () {
        img.onload = null;
        img.classList.remove('is-loading');
        loader.classList.remove('is-visible');
        // Dimensionnement DPR : n'agrandit jamais au-delà de la taille physique.
        var dpr = window.devicePixelRatio || 1;
        var physW = stage.clientWidth * dpr;
        var physH = stage.clientHeight * dpr;
        if (img.naturalWidth < physW && img.naturalHeight < physH) {
          img.style.width = (img.naturalWidth / dpr) + 'px';
          img.style.height = (img.naturalHeight / dpr) + 'px';
        }
      };
      img.onload = onLoad;
      img.onerror = function () {
        img.onload = null;
        img.onerror = null;
        img.classList.remove('is-loading');
        loader.classList.remove('is-visible');
      };

      img.alt = '';
      img.src = p.full;
      if (img.complete && img.naturalWidth) onLoad();

      var hide = TOTAL < 2;
      navRow.hidden = prevBtn.hidden = nextBtn.hidden = hide;
    }

    function open(index) {
      if (!root) return;
      lastFocused = document.activeElement;
      current = index;
      update();
      root.classList.add('is-open');
      root.removeAttribute('aria-hidden');
      document.body.style.overflow = 'hidden';
      gridBtn.focus();
    }

    function close() {
      clearTimeouts();
      root.classList.remove('is-open');
      root.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
    }

    function navigate(dir) {
      var hadPendingSwipe = swipeTimeout !== null;
      clearTimeouts();

      var next = (current + dir + TOTAL) % TOTAL;

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

      navTimeout = setTimeout(function () {
        navTimeout = null;
        current = next;
        img.style.opacity = '';
        update();
      }, 200);
    }

    function bind() {
      var swipeStartX = 0;
      var swipeDragging = false;

      function snapBack() {
        img.style.transition = 'transform 0.3s ease-out, opacity 0.3s ease-out';
        img.style.transform = '';
        img.style.opacity = '';
        setTimeout(function () { img.style.transition = ''; }, 300);
      }

      stage.addEventListener('touchstart', function (e) {
        // Annule toute navigation en cours pour qu'un nouveau swipe ne fasse pas
        // cohabiter deux mises à jour de `current`.
        clearTimeouts();
        swipeStartX = e.touches[0].clientX;
        swipeDragging = false;
        img.style.transition = 'none';
      }, { passive: true });

      stage.addEventListener('touchmove', function (e) {
        var delta = e.touches[0].clientX - swipeStartX;
        if (!swipeDragging && Math.abs(delta) > 6) swipeDragging = true;
        if (swipeDragging && TOTAL > 1) {
          img.style.transform = 'translateX(' + delta + 'px)';
          img.style.opacity = String(Math.max(0, 1 - Math.abs(delta) / (window.innerWidth * 0.6)));
        }
      }, { passive: true });

      stage.addEventListener('touchend', function (e) {
        if (!swipeDragging) { img.style.transition = ''; swipeDragging = false; return; }
        var delta = e.changedTouches[0].clientX - swipeStartX;
        var threshold = window.innerWidth * 0.25;

        if (TOTAL > 1 && Math.abs(delta) > threshold) {
          var dir = delta < 0 ? 1 : -1;
          var exit = delta < 0 ? '-110%' : '110%';
          img.style.transition = 'transform 0.22s ease-out, opacity 0.22s ease-out';
          img.style.transform = 'translateX(' + exit + ')';
          img.style.opacity = '0';
          swipeTimeout = setTimeout(function () {
            swipeTimeout = null;
            current = (current + dir + TOTAL) % TOTAL;
            img.style.transition = 'none';
            img.style.transform = '';
            img.style.opacity = '';
            update();
            requestAnimationFrame(function () { img.style.transition = ''; });
          }, 220);
        } else {
          snapBack();
        }
        swipeDragging = false;
      }, { passive: true });

      stage.addEventListener('touchcancel', function () {
        if (swipeDragging) snapBack();
        swipeDragging = false;
      }, { passive: true });

      // Clic sur le fond de la scène (hors image) = fermeture.
      stage.addEventListener('click', function (e) {
        if (e.target === stage) close();
      });

      document.addEventListener('keydown', function (e) {
        if (!isOpen()) return;
        if (e.key === 'Escape') { close(); return; }
        if (e.key === 'ArrowLeft') { navigate(-1); return; }
        if (e.key === 'ArrowRight') { navigate(1); return; }
        if (e.key === 'Tab') {
          // `offsetParent === null` couvre le `hidden` (total < 2) et le
          // `display: none` mobile sur la nav-row — un seul test de focusabilité.
          var focusable = [prevBtn, nextBtn, gridBtn].filter(function (el) {
            return el.offsetParent !== null;
          });
          trapTabFocus(focusable, e);
        }
      });

      prevBtn.addEventListener('click', function () { navigate(-1); });
      nextBtn.addEventListener('click', function () { navigate(1); });
      gridBtn.addEventListener('click', function () { close(); });
    }

    function init() {
      // Même garde que `renderGrid()` : une page peut légitimement n'avoir pas
      // de coquille lightbox. Sans ce test, l'accès à `root.querySelector`
      // faisait échouer TOUT le script — grille et header compris — au lieu de
      // ce seul module.
      root = document.querySelector('.lightbox');
      if (!root) return;
      stage = root.querySelector('.lightbox__stage');
      img = root.querySelector('.lightbox__img');
      loader = root.querySelector('.lightbox__loader');
      navRow = root.querySelector('.lightbox__nav-row');
      prevBtn = root.querySelector('[data-lb="prev"]');
      nextBtn = root.querySelector('[data-lb="next"]');
      gridBtn = root.querySelector('[data-lb="grid"]');
      bind();
    }

    return { init: init, open: open };
  })();

  // ─── Grille ─────────────────────────────────────────────────────────────────
  function renderGrid() {
    var container = document.querySelector('.gallery-grid__container');
    if (!container) return;
    var frag = document.createDocumentFragment();

    PHOTOS.forEach(function (p, i) {
      var card = document.createElement('a');
      card.className = 'gallery-card';
      card.href = p.full; // progressive enhancement : ouvre le JPEG si JS échoue

      var wrap = document.createElement('div');
      wrap.className = 'gallery-card__img-wrap';

      var img = document.createElement('img');
      img.className = 'gallery-card__img';
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';

      // Listeners posés avant `src` : couvre le cas d'une image déjà en cache.
      var markLoaded = function () {
        img.classList.add('is-loaded');
        wrap.classList.add('is-loaded');
      };
      img.addEventListener('load', markLoaded);
      img.addEventListener('error', markLoaded);
      // La grille n'est jamais en plein écran : on sert la miniature, et son
      // doublon 2x aux écrans denses. La pleine résolution reste pour la
      // lightbox (`p.full`), qui elle occupe tout l'écran.
      img.srcset = p.thumb + ' 1200w, ' + p.thumb2x + ' 2400w';
      img.sizes = GRID_SIZES;
      img.src = p.thumb;

      wrap.appendChild(img);
      card.appendChild(wrap);
      card.addEventListener('click', function (e) {
        e.preventDefault();
        lightbox.open(i);
      });
      frag.appendChild(card);
    });

    container.appendChild(frag);
  }

  // ─── Header ─────────────────────────────────────────────────────────────────
  // La marque est un vrai lien vers l'accueil (plusieurs pages désormais, avec
  // les catégories). Si on est déjà sur l'accueil, on remonte en haut en douceur
  // plutôt que de recharger la page — progressive enhancement au-dessus du lien.
  function wireHeader() {
    var brand = document.querySelector('.site-header__brand');
    if (brand) {
      brand.addEventListener('click', function (e) {
        if (brand.pathname === window.location.pathname) {
          e.preventDefault();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }
  }

  // ─── Amorçage ────────────────────────────────────────────────────────────────
  function boot() {
    lightbox.init();
    renderGrid();
    wireHeader();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
