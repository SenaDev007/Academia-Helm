/**
 * ============================================================================
 * API ROUTE: /api/dashboard/tuition-personalizations
 * ============================================================================
 *
 * Carte des personnalisations de frais de scolarité par niveau scolaire.
 *
 * Récupère toutes les FeeOverride du tenant pour l'année académique courante
 * et agrège les montants par niveau scolaire (Maternelle, Primaire, Secondaire).
 *
 * Retourne :
 * {
 *   totalOverrides: number,          // nombre total d'élèves avec personnalisation
 *   totalOriginalAmount: number,    // montant total standard (avant personnalisation)
 *   totalCustomAmount: number,      // montant total après personnalisation
 *   totalReductionAmount: number,   // total de la réduction accordée
 *   byLevel: [
 *     {
 *       levelCode: 'MATERNELLE',
 *       levelLabel: 'Maternelle',
 *       studentCount: 5,             // nombre d'élèves avec personnalisation
 *       originalAmount: 500000,      // ce qu'ils auraient dû payer
 *       customAmount: 375000,        // ce qu'ils vont payer après personnalisation
 *       reductionAmount: 125000,     // réduction accordée
 *       reductionPercentage: 25,    // % de réduction moyen
 *     },
 *     ...
 *   ]
 * }
 *
 * Source backend : GET /finance/fee-structures/overrides (déjà existe, retourne
 * déjà totalOriginal, totalCustom, totalReduction).
 *
 * ⭐ Si l'endpoint backend ne supporte pas le filtre par schoolLevelId, on
 *    récupère tout et on agrège côté frontend en groupant par schoolLevelCode.
 *
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';
import { getApiBaseUrlForRoutes, normalizeApiUrl } from '@/lib/utils/api-urls';
import { getProxyAuthHeaders } from '@/lib/api/proxy-auth';

const LEVEL_ORDER = ['MATERNELLE', 'PRIMAIRE', 'SECONDAIRE', 'COLLEGE', 'LYCEE'];

interface LevelAggregation {
  levelCode: string;
  levelLabel: string;
  studentCount: number;
  originalAmount: number;
  customAmount: number;
  reductionAmount: number;
}

function getLevelLabel(code: string): string {
  const map: Record<string, string> = {
    MATERNELLE: 'Maternelle',
    PRIMAIRE: 'Primaire',
    SECONDAIRE: 'Secondaire',
    COLLEGE: 'Collège',
    LYCEE: 'Lycée',
  };
  return map[code] || code;
}

function sortByLevel(levels: LevelAggregation[]): LevelAggregation[] {
  return [...levels].sort((a, b) => {
    const aIdx = LEVEL_ORDER.indexOf(a.levelCode);
    const bIdx = LEVEL_ORDER.indexOf(b.levelCode);
    if (aIdx === -1 && bIdx === -1) return a.levelLabel.localeCompare(b.levelLabel);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const academicYearId = searchParams.get('academicYearId');

    if (!academicYearId) {
      return NextResponse.json(
        { error: 'academicYearId is required' },
        { status: 400 },
      );
    }

    const headers = await getProxyAuthHeaders(request);
    const baseUrl = getApiBaseUrlForRoutes();

    // ─── Récupérer TOUTES les personnalisations de l'année ─────────────────
    //    On demande une grande limite pour tout avoir d'un coup.
    let overrides: any[] = [];
    let totals: { totalOriginal?: number; totalCustom?: number; totalReduction?: number } = {};

    try {
      const url = new URL(`${baseUrl}/finance/fee-structures/overrides`);
      url.searchParams.append('academicYearId', academicYearId);
      url.searchParams.append('limit', '1000'); // récupérer tout

      const res = await fetchWithTimeout(
        normalizeApiUrl(url.toString()),
        { headers, cache: 'no-store' },
        12000,
      );

      if (res.ok) {
        const data = await res.json().catch(() => null);
        // L'API backend retourne soit un array direct, soit { items, total, totalOriginal, totalCustom, totalReduction }
        if (Array.isArray(data)) {
          overrides = data;
        } else if (data && Array.isArray(data.items)) {
          overrides = data.items;
          totals = {
            totalOriginal: data.totalOriginal,
            totalCustom: data.totalCustom,
            totalReduction: data.totalReduction,
          };
        } else if (data && Array.isArray(data.overrides)) {
          overrides = data.overrides;
          totals = {
            totalOriginal: data.totalOriginal,
            totalCustom: data.totalCustom,
            totalReduction: data.totalReduction,
          };
        }
      }
    } catch (e) {
      console.warn('[dashboard/tuition-personalizations] overrides fetch failed:', (e as Error).message);
    }

    // ─── Agréger par niveau scolaire ────────────────────────────────────────
    //    Chaque override a (au minimum) :
    //    - customAmount (montant personnalisé)
    //    - feeStructure.totalAmount (montant standard)
    //    - student.schoolLevel.code OU schoolLevelCode direct
    //    Si l'override n'a pas de niveau, on le met dans "AUTRE".
    const levelMap = new Map<string, LevelAggregation>();

    const getLevelFromOverride = (override: any): string => {
      // Plusieurs chemins possibles selon le backend
      const code =
        override.schoolLevelCode ||
        override.levelCode ||
        override.student?.schoolLevel?.code ||
        override.student?.enrollment?.schoolLevel?.code ||
        override.feeStructure?.schoolLevel?.code ||
        override.feeStructure?.level?.code ||
        '';
      return (code || 'AUTRE').toUpperCase();
    };

    const getOriginalAmount = (override: any): number => {
      // Montant standard = ce que l'élève aurait dû payer sans personnalisation
      return Number(
        override.originalAmount ||
        override.standardAmount ||
        override.feeStructure?.totalAmount ||
        override.feeStructure?.amount ||
        0
      );
    };

    const getCustomAmount = (override: any): number => {
      // Montant personnalisé = ce que l'élève va payer effectivement
      return Number(override.customAmount || override.adjustedAmount || 0);
    };

    for (const override of overrides) {
      const code = getLevelFromOverride(override);
      const original = getOriginalAmount(override);
      const custom = getCustomAmount(override);

      if (!levelMap.has(code)) {
        levelMap.set(code, {
          levelCode: code,
          levelLabel: getLevelLabel(code),
          studentCount: 0,
          originalAmount: 0,
          customAmount: 0,
          reductionAmount: 0,
        });
      }

      const entry = levelMap.get(code)!;
      entry.studentCount += 1;
      entry.originalAmount += original;
      entry.customAmount += custom;
      entry.reductionAmount += Math.max(0, original - custom);
    }

    // Totaux
    const byLevel = sortByLevel(Array.from(levelMap.values()));
    const totalOverrides = overrides.length;
    const totalOriginalAmount = totals.totalOriginal ?? byLevel.reduce((s, l) => s + l.originalAmount, 0);
    const totalCustomAmount = totals.totalCustom ?? byLevel.reduce((s, l) => s + l.customAmount, 0);
    const totalReductionAmount = totals.totalReduction ?? byLevel.reduce((s, l) => s + l.reductionAmount, 0);

    return NextResponse.json({
      totalOverrides,
      totalOriginalAmount,
      totalCustomAmount,
      totalReductionAmount,
      reductionPercentage: totalOriginalAmount > 0
        ? Math.round((totalReductionAmount / totalOriginalAmount) * 100)
        : 0,
      byLevel: byLevel.map(l => ({
        ...l,
        reductionPercentage: l.originalAmount > 0
          ? Math.round((l.reductionAmount / l.originalAmount) * 100)
          : 0,
      })),
      _source: overrides.length > 0 ? 'ok' : 'empty',
    }, {
      status: 200,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('Error in /api/dashboard/tuition-personalizations:', error);
    return NextResponse.json(
      {
        totalOverrides: 0,
        totalOriginalAmount: 0,
        totalCustomAmount: 0,
        totalReductionAmount: 0,
        reductionPercentage: 0,
        byLevel: [],
        _source: 'error',
        error: 'Internal server error',
      },
      { status: 500 },
    );
  }
}
