#!/usr/bin/env node
// Redimensionne les JPEG photo > 4K en place.
// Usage : node bin/normalize.mjs
import { existsSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import sharp from 'sharp';
import { jpgsIn } from './lib/images.mjs';

const PHOTOS_DIR = 'assets/images/photos';
const MAX_W = 3840;
const MAX_H = 2160;

if (!existsSync(PHOTOS_DIR)) {
  console.error('Lancer depuis la racine du projet.');
  process.exit(1);
}

let resized = 0;

for (const src of jpgsIn(PHOTOS_DIR)) {
  const { width, height } = await sharp(src).metadata();
  if (width > MAX_W || height > MAX_H) {
    // sharp ne peut pas écrire vers son propre fichier source en flux :
    // on bufferise avant d'écraser l'original.
    const buffer = await sharp(src)
      .resize({ width: MAX_W, height: MAX_H, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 92 })
      .toBuffer();
    writeFileSync(src, buffer);
    console.log(`  ↓ ${basename(src)} réduit (${width}x${height} → ${MAX_W}x${MAX_H})`);
    resized++;
  }
}

console.log(`Done — ${resized} original(aux) réduit(s).`);
