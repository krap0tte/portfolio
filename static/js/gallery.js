/* Galerie photo — HTML/CSS/JS vanilla, aucune dépendance, aucun build.
   Script classique (pas de module ES) : index.html s'ouvre même en file://. */
(function () {
  'use strict';

  // ─── Séries — source unique de vérité ──────────────────────────────────────
  // TOUTES les séries sont embarquées dans chaque page (templates/partials/
  // serie.html), dans l'ordre chronologique décroissant, ce qui permet de
  // basculer de l'une à l'autre sans aller chercher le serveur. Déjà triées et
  // déjà sous la forme {full, thumb, thumb2x} — dérivées de data/photos.toml,
  // régénéré par bin/add-photo.sh, jamais éditées à la main.
  function readJSON(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }

  var SERIES = readJSON('series-data') || [];
  var CURRENT_SLUG = readJSON('series-current') || '';

  function indexOfSlug(slug) {
    for (var i = 0; i < SERIES.length; i++) {
      if (SERIES[i].slug === slug) return i;
    }
    return -1;
  }

  // Chemin d'une URL de série, sans barre oblique finale. Comparer des
  // `pathname` normalisés plutôt que des suffixes de chaînes : deux slugs dont
  // l'un se termine comme l'autre (« her-friends » et « lotus-and-her-friends »)
  // se confondraient sur une comparaison de fin de chaîne.
  function pathOf(url) {
    var a = document.createElement('a');
    a.href = url;
    return a.pathname.replace(/\/+$/, '');
  }

  function indexOfPath(pathname) {
    var path = pathname.replace(/\/+$/, '');
    for (var i = 0; i < SERIES.length; i++) {
      if (pathOf(SERIES[i].url) === path) return i;
    }
    return -1;
  }

  var currentSerie = Math.max(0, indexOfSlug(CURRENT_SLUG));

  // Photos de la série affichée. Réaffectée à chaque bascule — d'où l'absence
  // d'un `TOTAL` figé : la lightbox lit `PHOTOS.length` à chaque usage.
  var PHOTOS = SERIES.length ? SERIES[currentSerie].photos : [];

  // Le `sizes` de la grille n'est pas écrit ici : il est posé par le template
  // sur `.gallery-grid__container` (`data-grid-sizes`) et relu au besoin. La
  // liste de paliers double déjà les points de rupture du CSS, la dupliquer en
  // plus entre template et script en ferait une troisième copie à maintenir.

  // Un clic « ordinaire », par opposition à ceux que le navigateur doit traiter
  // lui-même : Ctrl/Cmd/Maj ouvrent dans un nouvel onglet ou une nouvelle
  // fenêtre, le clic milieu aussi. Ne jamais les intercepter.
  function isPlainClick(e) {
    return !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0;
  }

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

      var hide = PHOTOS.length < 2;
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

      var next = (current + dir + PHOTOS.length) % PHOTOS.length;

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
        if (swipeDragging && PHOTOS.length > 1) {
          img.style.transform = 'translateX(' + delta + 'px)';
          img.style.opacity = String(Math.max(0, 1 - Math.abs(delta) / (window.innerWidth * 0.6)));
        }
      }, { passive: true });

      stage.addEventListener('touchend', function (e) {
        if (!swipeDragging) { img.style.transition = ''; swipeDragging = false; return; }
        var delta = e.changedTouches[0].clientX - swipeStartX;
        var threshold = window.innerWidth * 0.25;

        if (PHOTOS.length > 1 && Math.abs(delta) > threshold) {
          var dir = delta < 0 ? 1 : -1;
          var exit = delta < 0 ? '-110%' : '110%';
          img.style.transition = 'transform 0.22s ease-out, opacity 0.22s ease-out';
          img.style.transform = 'translateX(' + exit + ')';
          img.style.opacity = '0';
          swipeTimeout = setTimeout(function () {
            swipeTimeout = null;
            current = (current + dir + PHOTOS.length) % PHOTOS.length;
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

    // `close` est exposée pour la bascule de série : changer de série pendant
    // que la visionneuse est ouverte la laisserait sur les photos de l'ancienne.
    function closeIfOpen() {
      if (root && isOpen()) close();
    }

    return { init: init, open: open, closeIfOpen: closeIfOpen };
  })();

  // ─── Grille ─────────────────────────────────────────────────────────────────
  // La grille du chargement initial vient du TEMPLATE, pas d'ici : le scanner de
  // préchargement du navigateur ne voit que le HTML, pas ce que le JS créera.
  // `renderGrid()` ne sert donc plus qu'aux bascules de série.

  function markLoaded(img) {
    img.classList.add('is-loaded');
    if (img.parentNode) img.parentNode.classList.add('is-loaded');
  }

  // Lève le shimmer quand la miniature est arrivée. Vaut pour les cartes venues
  // du serveur comme pour celles créées ici. `complete` est le point clé : une
  // image rendue par le template peut avoir FINI de charger avant que ce script
  // s'exécute, auquel cas plus aucun `load` ne sera émis et la carte resterait
  // bloquée sous le shimmer. Il est vrai aussi après une erreur — voulu, le
  // shimmer doit disparaître dans les deux cas.
  function watchImages(root) {
    var imgs = root.querySelectorAll('.gallery-card__img');
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (img.complete) { markLoaded(img); continue; }
      img.addEventListener('load', function () { markLoaded(this); });
      img.addEventListener('error', function () { markLoaded(this); });
    }
  }

  // Ouverture de la lightbox par DÉLÉGATION sur le conteneur : un seul écouteur,
  // qui couvre indifféremment les cartes du template et celles regénérées à la
  // bascule. Poser un écouteur par carte à la création ne couvrait, par
  // construction, que les secondes.
  function wireGrid() {
    var container = document.querySelector('.gallery-grid__container');
    if (!container) return;
    container.addEventListener('click', function (e) {
      if (!isPlainClick(e)) return;
      var card = e.target.closest('.gallery-card');
      if (!card) return;
      e.preventDefault();
      var cards = container.querySelectorAll('.gallery-card');
      var i = Array.prototype.indexOf.call(cards, card);
      if (i >= 0) lightbox.open(i);
    });
  }

  // ATTENTION : produit le MÊME balisage que `partials/serie.html`. Toute
  // modification de l'un doit être reportée dans l'autre.
  function renderGrid() {
    var container = document.querySelector('.gallery-grid__container');
    if (!container) return;
    container.textContent = '';
    // Même valeur que celle posée par le template sur ses propres images.
    var sizes = container.getAttribute('data-grid-sizes') || '';
    var frag = document.createDocumentFragment();

    PHOTOS.forEach(function (p) {
      var card = document.createElement('a');
      card.className = 'gallery-card';
      card.href = p.full; // progressive enhancement : ouvre la photo si JS échoue

      var wrap = document.createElement('div');
      wrap.className = 'gallery-card__img-wrap';

      var img = document.createElement('img');
      img.className = 'gallery-card__img';
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      // La grille n'est jamais en plein écran : on sert la miniature, et son
      // doublon 2x aux écrans denses. La pleine résolution reste pour la
      // lightbox (`p.full`), qui elle occupe tout l'écran.
      img.srcset = p.thumb + ' 1200w, ' + p.thumb2x + ' 2400w';
      img.sizes = sizes;
      img.src = p.thumb;

      wrap.appendChild(img);
      card.appendChild(wrap);
      frag.appendChild(card);
    });

    container.appendChild(frag);
    watchImages(container);
  }

  // ─── Bascule de série, sans rechargement ────────────────────────────────────
  // Le site est un single-page : toutes les séries sont dans la page, on échange
  // le contenu et on pousse la nouvelle URL. Les liens Précédente/Suivante
  // restent de VRAIS liens vers des pages réellement générées par Zola — sans
  // JS, ou si quelque chose échoue ici, ils rechargent simplement la page.
  var serieNav = (function () {
    var heroImg, heroTitle, titleEl, intro, prevLink, nextLink;

    // Les deux liens existent toujours dans le DOM ; c'est l'attribut `hidden`
    // qui les fait apparaître ou non. Les garder présents évite de créer et
    // détruire des nœuds à chaque bascule, et le rendu serveur pose déjà le
    // `hidden` correct pour le cas sans JS.
    function setLink(el, i) {
      if (!el) return;
      var s = SERIES[i];
      if (!s) { el.hidden = true; return; }
      el.hidden = false;
      el.href = s.url;
    }

    function render(i) {
      var s = SERIES[i];
      if (!s) return;
      currentSerie = i;
      PHOTOS = s.photos;

      lightbox.closeIfOpen();

      heroImg.src = s.hero;
      heroTitle.textContent = s.title;
      titleEl.textContent = s.title + ' — krapotte';

      // Le texte d'intro vient d'un <template> et non du JSON : c'est du HTML,
      // l'embarquer en chaîne obligeait à échapper `</script>` à la main.
      // La section est vidée et masquée plutôt que supprimée, pour que la
      // bascule suivante la retrouve.
      if (intro) {
        var tpl = document.querySelector('[data-serie-intro="' + s.slug + '"]');
        intro.innerHTML = tpl ? tpl.innerHTML : '';
        intro.hidden = !tpl;
      }

      // Indices voisins : la liste est triée de la plus récente à la plus
      // ancienne, donc « précédente » (plus ancienne) est i + 1.
      setLink(prevLink, i + 1);
      setLink(nextLink, i - 1);

      renderGrid();
      window.scrollTo({ top: 0, behavior: 'auto' });
    }

    function go(i, url) {
      render(i);
      window.history.pushState({ slug: SERIES[i].slug }, '', url);
    }

    function init() {
      heroImg = document.querySelector('.hero__img');
      heroTitle = document.querySelector('.hero__title');
      intro = document.querySelector('.series-intro');
      prevLink = document.querySelector('[data-serie-nav="older"]');
      nextLink = document.querySelector('[data-serie-nav="newer"]');
      titleEl = document.querySelector('title');
      // Sans couverture ni titre, on n'est pas sur une vue de série : on laisse
      // les liens se comporter en liens ordinaires.
      if (!heroImg || !heroTitle || SERIES.length < 2) return;

      [[prevLink, 1], [nextLink, -1]].forEach(function (pair) {
        var el = pair[0];
        if (!el) return;
        el.addEventListener('click', function (e) {
          if (!isPlainClick(e)) return;
          e.preventDefault();
          go(currentSerie + pair[1], el.href);
        });
      });

      // Bouton Précédent/Suivant du navigateur : on retrouve la série par son
      // URL. `replaceState` initial pour que le premier retour ait un état.
      window.history.replaceState({ slug: SERIES[currentSerie].slug }, '', window.location.href);
      window.addEventListener('popstate', function () {
        var i = indexOfPath(window.location.pathname);
        // Aucune série à cette adresse : c'est la racine du site, qui affiche
        // la plus récente.
        render(i < 0 ? 0 : i);
      });
    }

    return { init: init };
  })();

  // ─── Invite au défilement ───────────────────────────────────────────────────
  // Sous le titre de la couverture. Mène au texte d'intro, ou à la grille quand
  // la série n'en a pas.
  function wireScrollDown() {
    var btn = document.querySelector('[data-scroll-down]');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var target = document.querySelector('.series-intro:not([hidden])') ||
                   document.querySelector('.gallery-grid');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // ─── Header ─────────────────────────────────────────────────────────────────
  // La marque est un vrai lien vers l'accueil. Si on y est déjà, on remonte en
  // haut en douceur plutôt que de recharger — progressive enhancement au-dessus
  // du lien.
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
  // `renderGrid()` n'est PAS appelée ici : la grille est déjà dans le HTML. La
  // rejouer détruirait un DOM identique et annulerait au passage les
  // téléchargements d'images déjà lancés par le navigateur.
  function boot() {
    lightbox.init();
    wireGrid();
    watchImages(document);
    serieNav.init();
    wireScrollDown();
    wireHeader();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
