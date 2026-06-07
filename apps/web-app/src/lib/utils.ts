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

export function formatCurrency(value?: number | string | null): string {
  if (value == null || value === '') return '0 FCFA';
  const num = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(num)) return '0 FCFA';
  return `${num.toLocaleString('fr-FR')} FCFA`;
}

