// Helpers partagés entre build-webp.mjs et normalize.mjs.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Équivalent de `find <dir> -name "*.jpg"` — descend récursivement.
function findJpgs(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...findJpgs(path));
    else if (entry.name.endsWith('.jpg')) out.push(path);
  }
  return out;
}

export const jpgsIn = dir => (existsSync(dir) ? findJpgs(dir).sort() : []);

const mtime = path => statSync(path).mtimeMs;

// Équivalent de `[ "$out" -nt "$src" ]` — strictement plus récent, pas égal.
export const isFresh = (src, outputs) =>
  outputs.every(existsSync) && outputs.every(out => mtime(out) > mtime(src));
