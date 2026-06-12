/**
 * ============================================================================
 * USE CURRENCY HOOK
 * ============================================================================
 *
 * Hook centralisé pour le formatage monétaire dans tout le système.
 * Utilise formatCurrency de lib/utils.ts avec le suffixe par défaut "F CFA".
 *
 * Usage :
 *   const { format, formatCompact } = useCurrency();
 *   <span>{format(12500)}</span>        → "12 500 F CFA"
 *   <span>{formatCompact(1500000)}</span> → "1,5 M F CFA"
 * ============================================================================
 */

'use client';

import { formatCurrency, formatCurrencyCompact } from '@/lib/utils';

export function useCurrency() {
  return {
    /** Formate un montant en F CFA : 12500 → "12 500 F CFA" */
    format: formatCurrency,
    /** Formate un montant compact : 1500000 → "1,5 M F CFA" */
    formatCompact: formatCurrencyCompact,
    /** Suffixe monétaire courant */
    suffix: 'F CFA',
    /** Code ISO de la devise */
    currencyCode: 'XOF',
  };
}
