/**
 * Utility Functions
 * 
 * Fonctions utilitaires pour Academia Hub
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes
 * 
 * Combine les classes CSS de manière intelligente,
 * en résolvant les conflits Tailwind
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Libellé court pour l'affichage : "Terminale" → "Tle"
 * Utilisé partout où on affiche un nom de classe/grade (dropdowns, tableaux, structure).
 */
export function formatGradeLabel(name: string | null | undefined): string {
  if (name == null || name === '') return '';
  return name.replace(/\bTerminale\b/g, 'Tle');
}

