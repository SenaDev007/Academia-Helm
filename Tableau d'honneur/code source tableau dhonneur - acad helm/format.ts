const nf = (d: number) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

export function fmtNumber(n: number, decimals = 2): string {
  return nf(decimals).format(n);
}

export function fmtAverage(average: number, base: number): string {
  return `${fmtNumber(average, 2)}/${base}`;
}

export function fmtPct(average: number, base: number): string {
  return `${Math.round((average / base) * 100)} %`;
}

export function fmtRank(rank: number, size?: number): string {
  const r = rank === 1 ? '1er' : `${rank}e`;
  return size ? `${r} sur ${size}` : r;
}

export function fmtDate(iso: string): string {
  const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
}

/** Ajuste la taille d'une police pour qu'un texte tienne dans une largeur donnée */
export function fitFont(text: string, maxWidthPx: number, maxSize: number, emPerChar = 0.6, minSize = 20): number {
  const size = maxWidthPx / Math.max(1, text.length * emPerChar);
  return Math.max(minSize, Math.min(maxSize, Math.floor(size)));
}

export function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}
