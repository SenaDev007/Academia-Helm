import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatGradeLabel(value?: string | null): string {
  if (!value) return '';
  const s = String(value)
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  const lower = s.toLowerCase();
  
  // Enforce Maternelle 1 & 2 for any nursery related input
  if (lower.includes('maternelle 1') || lower === 'ps' || lower === 'ms' || lower.includes('petite section') || lower.includes('moyenne section')) {
    return 'Maternelle 1';
  }
  if (lower.includes('maternelle 2') || lower === 'gs' || lower.includes('grande section')) {
    return 'Maternelle 2';
  }
  
  // English mapping
  if (lower === 'nursery 1' || lower === 'k1') return 'Nursery 1';
  if (lower === 'nursery 2' || lower === 'k2') return 'Nursery 2';

  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Formatage monétaire standardisé pour tout le système.
 *
 * Affiche par défaut en **F CFA** (XOF) :
 *   formatCurrency(12500) → "12 500 F CFA"
 *   formatCurrency(0)      → "0 F CFA"
 *   formatCurrency(null)   → "0 F CFA"
 *
 * Le suffixe peut être personnalisé (ex: pour une future multi-devises) :
 *   formatCurrency(12500, { suffix: '€' }) → "12 500 €"
 */
export function formatCurrency(
  value?: number | string | null,
  options?: { suffix?: string },
): string {
  const suffix = options?.suffix ?? 'F CFA';
  if (value == null || value === '') return `0 ${suffix}`;
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) return `0 ${suffix}`;
  return `${num.toLocaleString('fr-FR')} ${suffix}`;
}

/**
 * Alias court pour formatCurrency — même comportement, nom plus sémantique
 * pour les contextes où on parle de « prix » ou « montant ».
 */
export const formatPrice = formatCurrency;

/**
 * Formatage compact pour les KPI / dashboards :
 *   formatCurrencyCompact(1500000) → "1,5 M F CFA"
 *   formatCurrencyCompact(12500)   → "12,5 k F CFA"
 */
export function formatCurrencyCompact(
  value?: number | string | null,
  options?: { suffix?: string },
): string {
  const suffix = options?.suffix ?? 'F CFA';
  if (value == null || value === '') return `0 ${suffix}`;
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) return `0 ${suffix}`;

  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Md ${suffix}`;
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M ${suffix}`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} k ${suffix}`;
  }
  return `${num.toLocaleString('fr-FR')} ${suffix}`;
}

