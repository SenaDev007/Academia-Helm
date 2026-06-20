// Service de pricing HELM — source de vérité frontend
// MAINTENANT DYNAMIQUE — fetch depuis /api/public/pricing/plans (DB pricing_plans)
// Fallback sur les valeurs codées en dur si l'API ne répond pas.

// Valeurs de fallback (alignées sur le seed DB)
export const HELM_PLANS = {
  SEED: {
    key: 'SEED',
    name: 'Helm Seed',
    tagline: "L'essentiel pour bien démarrer",
    taglineEn: 'Get Started',
    color: '#0D1F6E',
    maxStudents: 150,
    monthlyPrice: 19900,
    annualPrice: 199000,
    setupFee: 75000,
    highlighted: false,
    badge: null as string | null,
  },
  GROW: {
    key: 'GROW',
    name: 'Helm Grow',
    tagline: 'Pilotez votre croissance',
    taglineEn: 'Grow',
    color: '#F5A623',
    maxStudents: 400,
    monthlyPrice: 24900,
    annualPrice: 249000,
    setupFee: 100000,
    highlighted: true,
    badge: 'Populaire',
  },
  LEAD: {
    key: 'LEAD',
    name: 'Helm Lead',
    tagline: 'Dominez votre marché',
    taglineEn: 'Lead',
    color: '#1A3490',
    maxStudents: 800,
    monthlyPrice: 39900,
    annualPrice: 399000,
    setupFee: 150000,
    highlighted: false,
    badge: null as string | null,
  },
  NETWORK: {
    key: 'NETWORK',
    name: 'Helm Network',
    tagline: 'La catégorie multi-école',
    taglineEn: 'Scale',
    color: '#070F40',
    maxStudents: Infinity,
    monthlyPrice: null as number | null,
    annualPrice: null as number | null,
    setupFee: 200000,
    highlighted: false,
    badge: 'Multi-école',
  },
} as const;

export type HelmPlanKey = keyof typeof HELM_PLANS;

export const ALL_MODULES = [
  { icon: 'students', name: 'Élèves & Inscriptions', desc: 'Dossiers, admissions, export Educmaster' },
  { icon: 'pedagogie', name: 'Organisation Pédagogique', desc: 'EDT, matières, affectations, espace enseignant' },
  { icon: 'examens', name: 'Examens, Notes & Bulletins', desc: 'Saisie notes, moyennes, bulletins PDF' },
  { icon: 'finance', name: 'Finance & Économat', desc: 'Frais, recouvrement, dépenses, caisse' },
  { icon: 'rh', name: 'RH & Paie', desc: 'Contrats, congés, salaires CNSS conformes' },
  { icon: 'communication', name: 'Communication', desc: 'SMS, WhatsApp, email, notifications parents' },
  { icon: 'qhse', name: 'QHSE & Incidents', desc: 'Hygiène, sécurité, traçabilité' },
  { icon: 'orion', name: 'ORION — IA Analytique', desc: 'Alertes intelligentes, KPIs, recommandations' },
  { icon: 'modules-complementaires', name: 'Modules Complémentaires', desc: 'Cantine, transport, infirmerie, bibliothèque' },
] as const;

export function getRecommendedPlan(studentCount: number): HelmPlanKey {
  if (studentCount <= 150) return 'SEED';
  if (studentCount <= 400) return 'GROW';
  if (studentCount <= 800) return 'LEAD';
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
      studentMin: p.key === 'SEED' ? 1 : p.key === 'GROW' ? 151 : p.key === 'LEAD' ? 401 : 801,
      studentMax: p.maxStudents === Infinity ? null : p.maxStudents,
      initialFee: p.setupFee,
      monthlyAmount: p.monthlyPrice,
      yearlyAmount: p.annualPrice,
      bilingualMonthly: 10000,
      bilingualYearly: 100000,
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
