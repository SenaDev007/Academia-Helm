// Service de pricing HELM — source de vérité frontend
// MAINTENANT DYNAMIQUE — fetch depuis /api/public/pricing/plans (DB pricing_plans)
// Fallback sur les valeurs codées en dur si l'API ne répond pas.
//
// ⭐ PRICING MIS À JOUR — Alignement contrat d'abonnement Academia Helm
//
// Principe : TOUS les modules (21 modules métier + 6 modules complémentaires)
// sont inclus quel que soit le plan. Le pricing dépend uniquement de la taille
// de l'école (nombre d'élèves).
//
// Règles du contrat (Article 4) :
//   - Facturation ANNUELLE uniquement (pas d'option mensuelle)
//   - Frais d'activation : 300 000 FCFA (uniforme, payables à la signature)
//   - Frais annuels : dus chaque année à la date d'échéance annuelle
//   - Pénalité de retard : 15 jours après échéance → suspension possible
//   - Réglement : virement bancaire, Mobile Money (FedaPay), espèces
//
// Add-ons (Article 4) :
//   - Option bilingue FR/EN : 50 000 FCFA/an (en supplément du plan)
//   - SMS / Email / Voice : facturés au prix coûtant selon consommation
//   - WhatsApp : GRATUIT et illimité, inclus dans tous les plans
//
// ┌──────────────────┬────────────┬──────────┬──────────┬──────────┐
// │ Plan              │ Élèves     │ Annuel   │ Setup    │ Total An │
// ├──────────────────┼────────────┼──────────┼──────────┼──────────┤
// │ Helm Essentiel    │ 1-50       │ 50 000   │ 300 000  │ 350 000  │
// │ Helm Croissance   │ 51-150     │ 75 000   │ 300 000  │ 375 000  │
// │ Helm Performance  │ 151-400    │ 100 000  │ 300 000  │ 400 000  │
// │ Helm Institution  │ 401+       │ 150 000  │ 300 000  │ 450 000  │
// └──────────────────┴────────────┴──────────┴──────────┴──────────┘

export const HELM_PLANS = {
  SEED: {
    key: 'SEED',
    name: 'Helm Essentiel',
    tagline: "L'essentiel pour bien démarrer",
    taglineEn: 'Get Started',
    color: '#0D1F6E',
    maxStudents: 50,
    monthlyPrice: null as number | null, // Plus d'option mensuelle — contrat en annuel uniquement
    annualPrice: 50000,
    setupFee: 300000, // Frais d'activation uniforme (Article 4)
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
    monthlyPrice: null as number | null,
    annualPrice: 75000,
    setupFee: 300000,
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
    monthlyPrice: null as number | null,
    annualPrice: 100000,
    setupFee: 300000,
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
    monthlyPrice: null as number | null,
    annualPrice: 150000,
    setupFee: 300000,
    highlighted: false,
    badge: 'Multi-école',
  },
} as const;

export type HelmPlanKey = keyof typeof HELM_PLANS;

// ⭐ Option bilingue (FR/EN) — payante, ajoutée au plan de base
// Tarif officiel : 5 000 FCFA/mois de référence → 50 000 FCFA/an, soit
// 2 mois offerts (12 × 5 000 = 60 000 → 50 000). Facturée annuellement
// (contrat Article 4).
// ⚠️ Ces constantes ne sont qu'un FALLBACK d'affichage : la valeur active est
// pilotée en base (pricing_plans code 'BILINGUAL') depuis le back-office
// /platform/subscriptions → carte « Option bilingue FR/EN », et servie par
// /api/public/pricing/plans (champs bilingualMonthly/bilingualYearly).
export const BILINGUAL_ADDON = {
  monthly: null as number | null, // Pas de facturation mensuelle (annuel uniquement)
  annual: 50000, // 50 000 FCFA/an (référence mensuelle : 5 000 FCFA)
} as const;

// ⭐ Tous les modules inclus quel que soit le plan
// Contrat : 21 modules métier + 6 modules complémentaires (27 modules au total)
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
// Alignées sur le contrat d'abonnement Academia Helm (Article 4)
export const PRICING_NOTES = [
  '21 modules métier + 6 modules complémentaires inclus dans TOUS les plans — aucune restriction',
  'Frais d\'activation uniques : 300 000 FCFA (payables à la signature)',
  'Frais annuels dus chaque année à la date d\'échéance annuelle',
  'Option bilingue FR/EN : 50 000 FCFA/an (en supplément du plan)',
  'WhatsApp inclus gratuitement et illimité dans tous les plans',
  'SMS, Email et Voice : facturés au prix coûtant selon consommation',
  'Web + Desktop + Mobile — Offline-first — Agents IA (ORION, SARA, ATLAS)',
  'Règlement : virement bancaire, Mobile Money (FedaPay), espèces contre reçu',
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
