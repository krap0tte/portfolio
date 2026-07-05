import { isDevMode } from '@angular/core';

// ─── Photos — source unique de vérité ────────────────────────────────────────
// Noms de fichiers (sans extension) dans assets/images/photos/, triés par nom.
// L'ordre déterminé par ce tri est celui de la grille et de la navigation
// dans la lightbox.

const FILES = [
  'photo-01', 'photo-02', 'photo-03', 'photo-04', 'photo-05',
  'photo-06', 'photo-07', 'photo-08', 'photo-09',
].sort();

// En développement, les JPEG originaux sont servis directement ; en
// production, les variantes WebP générées par bin/build-webp.mjs.

export interface Photo {
  full: string;            // lightbox + href de la card
  thumb: string;           // miniature grille
  thumbSrcset: string | null; // srcset Retina (production uniquement)
}

const PROD = !isDevMode();

export const PHOTOS: Photo[] = FILES.map(name => {
  const base = `assets/images/photos/${name}`;
  return PROD
    ? {
        full: `${base}.webp`,
        thumb: `${base}-thumb.webp`,
        thumbSrcset: `${base}-thumb.webp 1200w, ${base}-thumb-2x.webp 2400w`,
      }
    : { full: `${base}.jpg`, thumb: `${base}.jpg`, thumbSrcset: null };
});
