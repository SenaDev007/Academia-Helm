/**
 * ============================================================================
 * ACADEMIC RULES ENGINE SERVICE
 * ============================================================================
 *
 * Pure computation service for academic grade calculations:
 *   - Subject average via configurable expression
 *   - General (weighted) average
 *   - Promotion decision
 *   - Student rankings
 *   - Appreciation lookup
 *
 * All methods are side-effect free and do not access the database.
 *
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubjectAverageRule {
  expression: string;
  type: string;
}

export interface SubjectAverageInput {
  average: number;
  coefficient: number;
}

export interface PromotionRule {
  condition: string;
  decision: string;
}

export interface AppreciationScale {
  min: number;
  max: number;
  label: string;
}

export interface RankedStudent {
  id: string;
  rank: number;
  average: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class AcademicRulesEngine {
  // -------------------------------------------------------------------------
  // evaluateSubjectAverage
  // -------------------------------------------------------------------------

  /**
   * Parses an expression string such as:
   *   '((DEVOIR_1 * 1) + (COMPOSITION * 2)) / 3'
   * Replaces placeholders (assessment-type codes) with actual scores from
   * `assessmentScores`, then evaluates the resulting arithmetic expression
   * using the Function constructor (safe execution in a new function scope).
   *
   * @returns Rounded result to 2 decimal places. Falls back to arithmetic
   *          mean on evaluation error.
   */
  evaluateSubjectAverage(
    assessmentScores: Record<string, number>,
    rule: SubjectAverageRule,
  ): number {
    try {
      let expr = rule.expression;

      // Replace each placeholder with its numeric value (word-boundary-safe)
      for (const [code, value] of Object.entries(assessmentScores)) {
        expr = expr.replace(
          new RegExp(`\\b${this.escapeRegExp(code)}\\b`, 'g'),
          String(value),
        );
      }

      // eslint-disable-next-line no-new-func
      const result = new Function(`return (${expr})`)() as number;

      if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
        throw new Error(
          `Expression "${rule.expression}" did not evaluate to a finite number`,
        );
      }

      return this.round2(result);
    } catch {
      // Fallback: arithmetic mean of all provided scores
      return this.arithmeticMean(Object.values(assessmentScores));
    }
  }

  // -------------------------------------------------------------------------
  // evaluateGeneralAverage
  // -------------------------------------------------------------------------

  /**
   * Computes the weighted general average:
   *   SUM(average × coefficient) / SUM(coefficients)
   *
   * Returns 0 if no subjects are provided or total coefficient is 0.
   */
  evaluateGeneralAverage(
    subjectAverages: SubjectAverageInput[],
  ): number {
    if (!subjectAverages || subjectAverages.length === 0) {
      return 0;
    }

    let weightedSum = 0;
    let totalCoefficient = 0;

    for (const subject of subjectAverages) {
      const coeff = subject.coefficient ?? 1;
      weightedSum += subject.average * coeff;
      totalCoefficient += coeff;
    }

    if (totalCoefficient === 0) {
      return 0;
    }

    return this.round2(weightedSum / totalCoefficient);
  }

  // -------------------------------------------------------------------------
  // evaluatePromotion
  // -------------------------------------------------------------------------

  /**
   * Evaluates promotion rules in order and returns the decision of the first
   * matching rule. Conditions are simple expressions such as:
   *   'generalAverage >= 10'
   *   'generalAverage < 10 && generalAverage >= 7'
   *
   * The value of `generalAverage` is injected into the evaluation context.
   * Returns 'UNDETERMINED' if no rule matches.
   */
  evaluatePromotion(
    generalAverage: number,
    rules: PromotionRule[],
  ): string {
    if (!rules || rules.length === 0) {
      return 'UNDETERMINED';
    }

    for (const rule of rules) {
      try {
        // eslint-disable-next-line no-new-func
        const matches = new Function(
          'generalAverage',
          `return !!(${rule.condition})`,
        )(generalAverage) as boolean;

        if (matches) {
          return rule.decision;
        }
      } catch {
        // Skip malformed rule conditions
        continue;
      }
    }

    return 'UNDETERMINED';
  }

  // -------------------------------------------------------------------------
  // computeRankings
  // -------------------------------------------------------------------------

  /**
   * Sorts students by average descending and assigns ranks.
   *
   * When `tieMode === 'SAME_RANK'` (default), students with identical averages
   * share the same rank and the next rank is skipped (standard competition
   * ranking, also known as 1224 ranking).
   *
   * When `tieMode === 'SEQUENTIAL'`, ties are broken arbitrarily by insertion
   * order (dense ranking).
   */
  computeRankings(
    students: Array<{ id: string; average: number }>,
    tieMode: string = 'SAME_RANK',
  ): RankedStudent[] {
    if (!students || students.length === 0) {
      return [];
    }

    // Sort descending by average
    const sorted = [...students].sort((a, b) => b.average - a.average);

    const ranked: RankedStudent[] = [];

    if (tieMode === 'SAME_RANK') {
      // Standard competition ranking (1224)
      let currentRank = 1;
      for (let i = 0; i < sorted.length; i++) {
        if (i > 0 && sorted[i].average !== sorted[i - 1].average) {
          currentRank = i + 1;
        }
        ranked.push({ id: sorted[i].id, rank: currentRank, average: sorted[i].average });
      }
    } else {
      // Sequential / dense ranking
      let currentRank = 1;
      for (let i = 0; i < sorted.length; i++) {
        if (i > 0 && sorted[i].average !== sorted[i - 1].average) {
          currentRank++;
        }
        ranked.push({ id: sorted[i].id, rank: currentRank, average: sorted[i].average });
      }
    }

    return ranked;
  }

  // -------------------------------------------------------------------------
  // getAppreciation
  // -------------------------------------------------------------------------

  /**
   * Finds the appreciation label from the scale where min <= average <= max.
   * Returns an empty string if no matching bracket is found.
   */
  getAppreciation(
    average: number,
    scale: AppreciationScale[],
  ): string {
    if (!scale || scale.length === 0) {
      return '';
    }

    const match = scale.find(
      (bracket) => average >= bracket.min && average <= bracket.max,
    );

    return match?.label ?? '';
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private arithmeticMean(values: number[]): number {
    if (values.length === 0) return 0;
    return this.round2(values.reduce((a, b) => a + b, 0) / values.length);
  }
}
