#!/usr/bin/env node
// Génère les variantes WebP — miniatures + pleine résolution.
// À lancer avant le build de production.
// Usage : node bin/build-webp.mjs [--force]
import { existsSync } from 'node:fs';
import { basename } from 'node:path';
import sharp from 'sharp';
import { jpgsIn, isFresh } from './lib/images.mjs';

const PHOTOS_DIR = 'assets/images/photos';
const QUALITY = 82;

if (!existsSync(PHOTOS_DIR)) {
  console.error('Lancer depuis la racine du projet.');
  process.exit(1);
}

const force = process.argv.includes('--force');
let count = 0;
let skipped = 0;

// resize null      : réencodage seul, pleine résolution.
// resize { width } : "Wx>" ImageMagick — largeur cible, hauteur proportionnelle.
// resize { width, height, fit: 'inside' } : "WxH>" — boîte englobante.
// Dans tous les cas, réduction seule (withoutEnlargement).
function toWebp(src, out, resize) {
  let img = sharp(src);
  if (resize) img = img.resize({ withoutEnlargement: true, ...resize });
  return img.webp({ quality: QUALITY }).toFile(out);
}

// Photos : miniature WebP + WebP pleine résolution
for (const src of jpgsIn(PHOTOS_DIR)) {
  const base = src.slice(0, -4);
  const thumb = `${base}-thumb.webp`;
  const thumb2x = `${base}-thumb-2x.webp`;
  const full = `${base}.webp`;
  if (!force && isFresh(src, [thumb, thumb2x, full])) { skipped++; continue; }

  await toWebp(src, thumb, { width: 1200, height: 1200, fit: 'inside' });
  await toWebp(src, thumb2x, { width: 2400, height: 2400, fit: 'inside' });
  await toWebp(src, full, null);
  console.log(`  ✓ ${basename(src)}`);
  count++;
}

console.log(`Done — ${count} image(s) traitée(s), ${skipped} ignorée(s).`);
