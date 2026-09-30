import { readFile } from 'node:fs/promises';
import path from 'node:path';
import QRCode from 'qrcode';
import type { DistinctionInput, PreparedDistinction } from './types.js';
import { THEMES } from './themes.js';

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif',
};

/** Convertit une URL, un chemin local ou un data URI en data URI (rendu hors ligne et stable) */
export async function toDataUri(src?: string): Promise<string | undefined> {
  if (!src) return undefined;
  if (src.startsWith('data:')) return src;
  try {
    if (/^https?:\/\//i.test(src)) {
      const res = await fetch(src, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return undefined;
      const type = res.headers.get('content-type') ?? MIME[path.extname(new URL(src).pathname).toLowerCase()] ?? 'image/png';
      return `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
    }
    const buf = await readFile(src);
    const type = MIME[path.extname(src).toLowerCase()] ?? 'image/png';
    return `data:${type};base64,${buf.toString('base64')}`;
  } catch {
    // Une image manquante ne doit jamais bloquer la génération d'un certificat
    return undefined;
  }
}

export async function qrSvg(url: string, color: string): Promise<string> {
  return QRCode.toString(url, {
    type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: color, light: '#0000' },
  });
}

export async function prepare(input: DistinctionInput): Promise<PreparedDistinction> {
  const theme = THEMES[input.code];
  const [logoUrl, directorSignatureUrl, teacherSignatureUrl, photoUrl, svg] = await Promise.all([
    toDataUri(input.school.logoUrl),
    toDataUri(input.school.directorSignatureUrl),
    toDataUri(input.school.teacherSignatureUrl),
    toDataUri(input.student.photoUrl),
    qrSvg(input.verification.url, theme.palette.ink),
  ]);
  return {
    ...input,
    school: { ...input.school, logoUrl, directorSignatureUrl, teacherSignatureUrl },
    student: { ...input.student, photoUrl },
    qrSvg: svg,
  };
}
