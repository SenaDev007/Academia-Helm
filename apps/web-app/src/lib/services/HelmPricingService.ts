// Service de pricing HELM — source de vérité frontend
// MAINTENANT DYNAMIQUE — fetch depuis /api/public/pricing/plans (DB pricing_plans)
// Fallback sur les valeurs codées en dur si l'API ne répond pas.
//
// ⭐ PRICING MIS À JOUR — Août 2026
//
// Principe : TOUS les modules sont inclus quel que soit le plan.
// Le pricing dépend uniquement de la taille de l'école (nombre d'élèves).
//
// Règles additionnelles :
//   - Bilingue (FR/EN) : +5 000 FCFA/mois ou +50 000 FCFA/an (option payante)
//   - SMS / Email : à la charge de l'école (facturés en sus selon consommation)
//   - WhatsApp : gratuit (inclus dans tous les plans)
//   - Frais d'activation : facturés une fois à l'inscription
//
// ┌──────────────────┬────────────┬──────────┬──────────┬──────────┐
// │ Plan              │ Élèves     │ Mensuel  │ Annuel   │ Setup    │
// ├──────────────────┼────────────┼──────────┼──────────┼──────────┤
// │ Helm Essentiel    │ 1-50       │ 10 000   │ 100 000  │ 50 000   │
// │ Helm Croissance   │ 51-150     │ 15 000   │ 150 000  │ 75 000   │
// │ Helm Performance  │ 151-400    │ 25 000   │ 250 000  │ 100 000  │
// │ Helm Institution  │ 401+       │ 50 000   │ 500 000  │ 150 000  │
// └──────────────────┴────────────┴──────────┴──────────┴──────────┘

export const HELM_PLANS = {
  SEED: {
    key: 'SEED',
    name: 'Helm Essentiel',
    tagline: "L'essentiel pour bien démarrer",
    taglineEn: 'Get Started',
    color: '#0D1F6E',
    maxStudents: 50,
    monthlyPrice: 10000,
    annualPrice: 100000,
    setupFee: 50000,
    highlighted: false,
    badge: null as string | null,
  },
  GROW: {
    key: 'GROW',
    name: 'Helm Croissance',
    tagline: 'Pilotez votre croissance',
    taglineEn: 'Grow',
    color: '#F5A623',
    maxStudents: 150,
    monthlyPrice: 15000,
    annualPrice: 150000,
    setupFee: 75000,
    highlighted: true,
    badge: 'Populaire',
  },
  LEAD: {
    key: 'LEAD',
    name: 'Helm Performance',
    tagline: 'Dominez votre marché',
    taglineEn: 'Lead',
    color: '#1A3490',
    maxStudents: 400,
    monthlyPrice: 25000,
    annualPrice: 250000,
    setupFee: 100000,
    highlighted: false,
    badge: null as string | null,
  },
  NETWORK: {
    key: 'NETWORK',
    name: 'Helm Institution',
    tagline: 'La catégorie multi-école',
    taglineEn: 'Scale',
    color: '#070F40',
    maxStudents: Infinity,
    monthlyPrice: 50000,
    annualPrice: 500000,
    setupFee: 150000,
    highlighted: false,
    badge: 'Multi-école',
  },
} as const;

export type HelmPlanKey = keyof typeof HELM_PLANS;

// ⭐ Option bilingue (FR/EN) — payante, ajoutée au plan de base
export const BILINGUAL_ADDON = {
  monthly: 5000,    // 5 000 FCFA/mois
  annual: 50000,     // 50 000 FCFA/an
} as const;

// ⭐ Tous les modules inclus quel que soit le plan
export const ALL_MODULES = [
  { icon: 'students', name: 'Élèves & Inscriptions', desc: 'Dossiers, admissions, export Educmaster' },
  { icon: 'pedagogie', name: 'Organisation Pédagogique', desc: 'EDT, matières, affectations, espace enseignant' },
  { icon: 'examens', name: 'Examens, Notes & Bulletins', desc: 'Saisie notes, moyennes, bulletins PDF' },
  { icon: 'finance', name: 'Finance & Économat', desc: 'Frais, recouvrement, dépenses, caisse' },
  { icon: 'rh', name: 'RH & Paie', desc: 'Contrats, congés, salaires CNSS conformes' },
  { icon: 'communication', name: 'Communication', desc: 'SMS (à la charge de l\'école), WhatsApp (gratuit), email, notifications parents' },
  { icon: 'qhse', name: 'QHSE & Incidents', desc: 'Hygiène, sécurité, traçabilité' },
  { icon: 'orion', name: 'ORION — IA Analytique', desc: 'Alertes intelligentes, KPIs, recommandations' },
  { icon: 'modules-complementaires', name: 'Modules Complémentaires', desc: 'Cantine, transport, infirmerie, bibliothèque' },
] as const;

// ⭐ Notes de pricing affichées sur la page tarif
export const PRICING_NOTES = [
  'Tous les modules sont inclus quel que soit le plan — aucune restriction',
  'Option bilingue (FR/EN) : +5 000 FCFA/mois ou +50 000 FCFA/an',
  'WhatsApp inclus gratuitement dans tous les plans',
  'SMS et email : à la charge de l\'école (facturés selon consommation)',
  'Frais d\'activation facturés une fois à l\'inscription',
] as const;

export function getRecommendedPlan(studentCount: number): HelmPlanKey {
  if (studentCount <= 50) return 'SEED';
  if (studentCount <= 150) return 'GROW';
  if (studentCount <= 400) return 'LEAD';
  return 'NETWORK';
}

export function needsUpgrade(currentPlan: HelmPlanKey, studentCount: number): boolean {
  const recommended = getRecommendedPlan(studentCount);
  const order: HelmPlanKey[] = ['SEED', 'GROW', 'LEAD', 'NETWORK'];
  return order.indexOf(recommended) > order.indexOf(currentPlan);
}

// ─── PLANS DYNAMIQUES (depuis l'API) ─────────────────────────────────────────

export interface DynamicPricingPlan {
  id: string;
  code: string;
  name: string;
  tagline: string | null;
  description: string | null;
  studentMin: number;
  studentMax: number | null;
  initialFee: number;
  monthlyAmount: number | null;
  yearlyAmount: number | null;
  bilingualMonthly: number | null;
  bilingualYearly: number | null;
  features: string[];
  isPopular: boolean;
}

let _cachedPlans: DynamicPricingPlan[] | null = null;

export async function fetchPricingPlans(): Promise<DynamicPricingPlan[]> {
  if (_cachedPlans) return _cachedPlans;

  try {
    const response = await fetch('/api/public/pricing/plans', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const plans = await response.json() as DynamicPricingPlan[];
    if (Array.isArray(plans) && plans.length > 0) {
      _cachedPlans = plans;
      return plans;
    }
    throw new Error('No plans returned');
  } catch (err) {
    console.warn('fetchPricingPlans: fallback to HELM_PLANS', err);
    return Object.values(HELM_PLANS).map((p) => ({
      id: p.key,
      code: p.key,
      name: p.name,
      tagline: p.tagline,
      description: null,
      studentMin: p.key === 'SEED' ? 1 : p.key === 'GROW' ? 51 : p.key === 'LEAD' ? 151 : 401,
      studentMax: p.maxStudents === Infinity ? null : p.maxStudents,
      initialFee: p.setupFee,
      monthlyAmount: p.monthlyPrice,
      yearlyAmount: p.annualPrice,
      bilingualMonthly: BILINGUAL_ADDON.monthly,
      bilingualYearly: BILINGUAL_ADDON.annual,
      features: [],
      isPopular: p.highlighted,
    }));
  }
}

export function getPlanForStudentCount(
  plans: DynamicPricingPlan[],
  studentCount: number,
): DynamicPricingPlan | null {
  for (const plan of plans) {
    const min = plan.studentMin || 0;
    const max = plan.studentMax ?? Infinity;
    if (studentCount >= min && studentCount <= max) {
      return plan;
    }
  }
  return plans[plans.length - 1] || null;
}
