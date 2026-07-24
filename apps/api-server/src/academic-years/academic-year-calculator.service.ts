/**
 * ============================================================================
 * ACADEMIC YEAR CALCULATOR SERVICE
 * ============================================================================
 *
 * Calendrier type Bénin :
 * - Pré-rentrée : 2e lundi de septembre (lundi de la 2e semaine de septembre)
 * - Rentrée : 3e lundi de septembre (lundi suivant les 2 premières semaines)
 * - Fin d'année : dernier vendredi de juin
 *
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';

export interface AcademicYearDates {
  preEntryDate: Date;  // Date de prérentrée (lundi 2ème semaine septembre)
  startDate: Date;     // Date de rentrée officielle (lundi suivant prérentrée)
  endDate: Date;       // Date de fin d'année (fin juin ou 1ère semaine juillet)
  label: string;       // Ex: "2024-2025"
  name: string;        // Ex: "Année scolaire 2024-2025"
}

@Injectable()
export class AcademicYearCalculatorService {
  /**
   * Calcule les dates d'une année scolaire pour une année donnée
   * @param year L'année de début (ex: 2024 pour l'année 2024-2025)
   */
  calculateAcademicYearDates(year: number): AcademicYearDates {
    // 1. Calculer la date de prérentrée : Lundi de la 2ème semaine de septembre
    const preEntryDate = this.calculatePreEntryDate(year);
    
    // 2. Calculer la date de rentrée officielle : Lundi suivant la prérentrée
    const startDate = this.calculateStartDate(preEntryDate);
    
    // 3. Calculer la date de fin : Fin juin ou 1ère semaine de juillet de l'année suivante
    const endDate = this.calculateEndDate(year + 1);
    
    // 4. Générer le label et le nom
    const label = `${year}-${year + 1}`;
    const name = `Année scolaire ${year}-${year + 1}`;
    
    return {
      preEntryDate,
      startDate,
      endDate,
      label,
      name,
    };
  }

  /**
   * Pré-rentrée : lundi de la 2e semaine de septembre.
   *
   * Règle (calendrier Bénin) :
   *   - Si le 1er septembre est un lundi → la 1re semaine = 1-7 sept,
   *     la 2e semaine commence le 8 → pré-rentrée = 8 septembre.
   *   - Si le 1er septembre n'est PAS un lundi → la 1re semaine (partielle)
   *     va du 1er au premier dimanche, la 2e semaine commence le 1er lundi
   *     de septembre → pré-rentrée = 1er lundi de septembre.
   *
   * Exemples :
   *   2026 : 1 sept = mardi → pré-rentrée = lundi 7 sept 2026 ✅
   *   2025 : 1 sept = lundi → pré-rentrée = lundi 8 sept 2025 ✅
   *   2024 : 1 sept = dimanche → pré-rentrée = lundi 2 sept 2024 ✅
   */
  private calculatePreEntryDate(year: number): Date {
    const sept1 = new Date(year, 8, 1);
    const dayOfWeek = sept1.getDay(); // 0=dim, 1=lun, ..., 6=sam

    if (dayOfWeek === 1) {
      // Le 1er est lundi → 1re semaine = 1-7, 2e semaine commence le 8
      return new Date(year, 8, 8);
    }

    // Le 1er n'est pas lundi → 1re semaine (partielle) = 1er au 1er dimanche
    // La 2e semaine commence le 1er lundi de septembre
    const daysUntilFirstMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
    return new Date(year, 8, 1 + daysUntilFirstMonday);
  }

  /**
   * Calcule la date de rentrée officielle : Lundi suivant la prérentrée
   */
  private calculateStartDate(preEntryDate: Date): Date {
    const startDate = new Date(preEntryDate);
    startDate.setDate(preEntryDate.getDate() + 7); // Lundi suivant
    return startDate;
  }

  /**
   * Fin d'année : dernier vendredi de juin.
   */
  private calculateEndDate(year: number): Date {
    return this.findLastFridayOfMonth(year, 5); // 5 = juin (0-indexed)
  }

  /**
   * Trouve le dernier vendredi d'un mois donné
   */
  private findLastFridayOfMonth(year: number, month: number): Date {
    // Dernier jour du mois
    const lastDay = new Date(year, month + 1, 0);
    
    // Remonter jusqu'au dernier vendredi
    let currentDate = new Date(lastDay);
    while (currentDate.getDay() !== 5) { // 5 = vendredi
      currentDate.setDate(currentDate.getDate() - 1);
    }
    
    return currentDate;
  }

  /**
   * Calcule l'année scolaire courante basée sur la date actuelle
   */
  getCurrentAcademicYear(): number {
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11
    const currentYear = now.getFullYear();
    
    // Si on est entre janvier et août, l'année scolaire en cours a commencé l'année précédente
    // Si on est entre septembre et décembre, l'année scolaire en cours a commencé cette année
    if (currentMonth < 8) { // Avant septembre
      return currentYear - 1;
    } else {
      return currentYear;
    }
  }

  /**
   * Vérifie si une année scolaire est terminée
   */
  isAcademicYearEnded(endDate: Date): boolean {
    const now = new Date();
    return now > endDate;
  }
}

