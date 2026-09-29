'use client';

/**
 * ============================================================================
 * HELPER BILINGUE PARTAGÉ — L(fr, en)
 * ============================================================================
 *
 * ⭐ P4 (filtre Rôles × Pistes × Niveaux) — exigence utilisateur :
 *    « L'interface UI quand il s'agit de la piste anglophone doit être en
 *    anglais. Tout doit être en anglais pour ceux qui sont dans le système
 *    anglophone. »
 *
 * La locale UI suit le profil serveur (I18nContext applique scope.locale :
 *    mono-piste EN → 'en', mono-piste FR → 'fr', bi-piste → libre via le
 *    LanguageSwitcher). Ce helper permet à TOUS les composants de la coquille
 *    (sidebars, dashboards, onglets, sélecteurs) de rendre leurs libellés
 *    dans la langue de l'utilisateur sans réécrire chaque page en t()-keys.
 *
 * Usage :
 *   const L = useL();
 *   <h1>{L('Élèves & Scolarité', 'Students & Enrollment')}</h1>
 *
 * Pour les DATA-MAPS hors composants (admin-portal-map, hr-tabs…) :
 *   pickLabel(locale, 'Élèves & Scolarité', 'Students & Enrollment')
 *   (les data-maps portent les DEUX libellés — ex: label + labelEn —
 *    et le composant qui les consomme choisit selon sa locale).
 * ============================================================================
 */

import { useCallback } from 'react';
import { useI18n } from '@/contexts/I18nContext';

/**
 * Hook bilingue : retourne une fonction L(fr, en) qui rend le libellé
 * correspondant à la locale UI courante ('en' → en, sinon fr).
 * Les composants consommateurs doivent être des composants clients.
 */
export function useL(): (fr: string, en: string) => string {
  const { locale } = useI18n();
  return useCallback(
    (fr: string, en: string) => (locale === 'en' ? en : fr),
    [locale],
  );
}

/**
 * Version pure (sans hook) — pour choisir un libellé dans un data-map
 * quand on dispose déjà de la locale (ex: labelEn stocké à côté du label).
 */
export function pickLabel(locale: string | undefined | null, fr: string, en: string): string {
  return locale === 'en' ? en : fr;
}
