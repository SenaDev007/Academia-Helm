/**
 * ============================================================================
 * TOAST HELPERS — wrappers sonner avec icônes Lucide (pas d'emojis)
 * ============================================================================
 *
 * Au lieu de `toast.success('✅ Évaluation créée')` qui contient un emoji,
 * on utilise `toastSuccess('Évaluation créée')` qui affiche une icône Lucide
 * CheckCircle2 en vert à gauche du message.
 *
 * Avantages :
 *  - Cohérence visuelle (icônes vectorielles, pas d'emojis qui varient selon l'OS)
 *  - Pas de duplication (l'icône est automatique selon le type)
 *  - Style moderne et professionnel
 * ============================================================================
 */

'use client';

import { toast, type ToastOptions } from 'sonner';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  type LucideIcon,
} from 'lucide-react';
import { createElement } from 'react';

interface IconToastOptions extends ToastOptions {
  /** Permet de surcharger l'icône par défaut */
  icon?: LucideIcon;
}

const SUCCESS_ICON = CheckCircle2;
const ERROR_ICON = XCircle;
const WARNING_ICON = AlertTriangle;
const INFO_ICON = Info;

/**
 * Toast succès — icône CheckCircle2 (vert) à gauche
 */
export function toastSuccess(message: string, options?: IconToastOptions) {
  const Icon = options?.icon || SUCCESS_ICON;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { icon, ...rest } = options || {};
  return toast.success(message, {
    ...rest,
    icon: createElement(Icon, { className: 'w-4 h-4 text-emerald-500' }),
  });
}

/**
 * Toast erreur — icône XCircle (rouge) à gauche
 */
export function toastError(message: string, options?: IconToastOptions) {
  const Icon = options?.icon || ERROR_ICON;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { icon, ...rest } = options || {};
  return toast.error(message, {
    ...rest,
    icon: createElement(Icon, { className: 'w-4 h-4 text-red-500' }),
  });
}

/**
 * Toast avertissement — icône AlertTriangle (orange) à gauche
 */
export function toastWarning(message: string, options?: IconToastOptions) {
  const Icon = options?.icon || WARNING_ICON;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { icon, ...rest } = options || {};
  return toast.warning(message, {
    ...rest,
    icon: createElement(Icon, { className: 'w-4 h-4 text-amber-500' }),
  });
}

/**
 * Toast info — icône Info (bleu) à gauche
 */
export function toastInfo(message: string, options?: IconToastOptions) {
  const Icon = options?.icon || INFO_ICON;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { icon, ...rest } = options || {};
  return toast.info(message, {
    ...rest,
    icon: createElement(Icon, { className: 'w-4 h-4 text-blue-500' }),
  });
}

export { toast };
