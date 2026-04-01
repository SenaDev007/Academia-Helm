export type AbVariant = 'a' | 'b';

export function getAbVariant(searchParams: URLSearchParams, cookieHeader?: string | null): AbVariant {
  const qp = searchParams.get('ab');
  if (qp === 'a' || qp === 'b') return qp;

  const m = cookieHeader?.match(/(?:^|;\s*)ab_v=([ab])(?:;|$)/);
  if (m?.[1] === 'a' || m?.[1] === 'b') return m[1];

  return Math.random() < 0.5 ? 'a' : 'b';
}

export function ctaLabelForVariant(variant: AbVariant) {
  return variant === 'b'
    ? 'Tester gratuitement Academia Helm — démo rapide'
    : 'Tester gratuitement Academia Helm';
}
