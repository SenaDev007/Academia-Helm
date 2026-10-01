import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Level } from './types.js';

const require = createRequire(import.meta.url);
const cache = new Map<string, string>();

interface Face { pkg: string; family: string; weight: number; style?: 'normal' | 'italic' }

const FACES: Record<Level, Face[]> = {
  maternel: [400, 500, 600, 700].map((w) => ({ pkg: 'fredoka', family: 'Fredoka', weight: w })),
  primaire: [
    ...[400, 600, 700, 800].map((w) => ({ pkg: 'nunito', family: 'Nunito', weight: w })),
    { pkg: 'nunito', family: 'Nunito', weight: 700, style: 'italic' as const },
    { pkg: 'nunito', family: 'Nunito', weight: 800, style: 'italic' as const },
  ],
  secondaire: [
    ...[400, 500, 600, 700].map((w) => ({ pkg: 'lora', family: 'Lora', weight: w })),
    ...[400, 500, 600].map((w) => ({ pkg: 'lora', family: 'Lora', weight: w, style: 'italic' as const })),
    ...[600, 700, 800].map((w) => ({ pkg: 'playfair-display', family: 'Playfair Display', weight: w })),
    ...[500, 700].map((w) => ({ pkg: 'playfair-display', family: 'Playfair Display', weight: w, style: 'italic' as const })),
  ],
};

function faceCss(f: Face): string {
  const style = f.style ?? 'normal';
  const key = `${f.pkg}-${f.weight}-${style}`;
  let css = cache.get(key);
  if (!css) {
    const pkgDir = path.dirname(require.resolve(`@fontsource/${f.pkg}/package.json`));
    const file = path.join(pkgDir, 'files', `${f.pkg}-latin-${f.weight}-${style}.woff2`);
    const b64 = readFileSync(file).toString('base64');
    css = `@font-face{font-family:'${f.family}';font-style:${style};font-weight:${f.weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
    cache.set(key, css);
  }
  return css;
}

/** CSS @font-face avec polices intégrées en base64 : aucun accès réseau au moment du rendu */
export function fontCss(levels: Level[]): string {
  return [...new Set(levels)].flatMap((l) => FACES[l].map(faceCss)).join('\n');
}
