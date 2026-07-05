import { isDevMode } from '@angular/core';

// ─── Séries — source unique de vérité ────────────────────────────────────────
// Ajouter une série = ajouter une entrée ici (slug = nom du dossier dans
// assets/images/photos/). L'ordre de la liste `photos` détermine l'ordre
// d'affichage dans la galerie et de navigation dans la lightbox.

export interface Series {
  slug: string;
  title: string;
  photos: string[];
}

export const SERIES: Series[] = [
  { slug: 'abstrait',     title: 'Abstrait',     photos: ['photo-04', 'photo-02', 'photo-07'] },
  { slug: 'architecture', title: 'Architecture', photos: ['photo-03', 'photo-04', 'photo-05'] },
  { slug: 'lumiere',      title: 'Lumière',      photos: ['photo-01', 'photo-09', 'photo-03'] },
  { slug: 'mer',          title: 'Mer',          photos: ['photo-06', 'photo-01', 'photo-08'] },
  { slug: 'nature',       title: 'Nature',       photos: ['photo-01', 'photo-07', 'photo-02'] },
  { slug: 'nuit',         title: 'Nuit',         photos: ['photo-09', 'photo-05', 'photo-07'] },
  { slug: 'paysage',      title: 'Paysage',      photos: ['photo-06', 'photo-01', 'photo-07'] },
  { slug: 'portrait',     title: 'Portrait',     photos: ['photo-08', 'photo-02', 'photo-09'] },
  { slug: 'rue',          title: 'Rue',          photos: ['photo-08', 'photo-05', 'photo-06'] },
  { slug: 'urbain',       title: 'Urbain',       photos: ['photo-03', 'photo-04', 'photo-06'] },
];

// Tri alphabétique par titre — même ordre que l'ancien `site.series | sort: "title"`.
export const SORTED_SERIES: Series[] = [...SERIES].sort((a, b) =>
  a.title.localeCompare(b.title, 'fr')
);

// ─── Photos aplaties (index global) ──────────────────────────────────────────
// En développement, les JPEG originaux sont servis directement ; en production,
// les variantes WebP générées par bin/build-webp.sh.

export interface Photo {
  series: string;
  full: string;            // lightbox + href de la card
  thumb: string;           // miniature grille
  thumbSrcset: string | null; // srcset Retina (production uniquement)
}

const PROD = !isDevMode();

export const PHOTOS: Photo[] = SORTED_SERIES.flatMap(s =>
  s.photos.map(name => {
    const base = `assets/images/photos/${s.slug}/${name}`;
    return PROD
      ? {
          series: s.slug,
          full: `${base}.webp`,
          thumb: `${base}-thumb.webp`,
          thumbSrcset: `${base}-thumb.webp 1200w, ${base}-thumb-2x.webp 2400w`,
        }
      : { series: s.slug, full: `${base}.jpg`, thumb: `${base}.jpg`, thumbSrcset: null };
  })
);
