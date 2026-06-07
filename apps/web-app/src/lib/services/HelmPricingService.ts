// Service de pricing HELM — source de vérité frontend
// Aligné sur SPEC_Cursor_Pricing_LandingPage_v1.pdf

export const HELM_PLANS = {
  SEED: {
    key: 'SEED',
    name: 'HELM SEED',
    tagline: 'Démarrer',
    taglineEn: 'Get Started',
    color: '#0D1F6E',
    maxStudents: 150,
    monthlyPrice: 14900,
    annualPrice: 149000,
    setupFee: 75000,
    highlighted: false,
    badge: null as string | null,
  },
  GROW: {
    key: 'GROW',
    name: 'HELM GROW',
    tagline: 'Piloter',
    taglineEn: 'Grow',
    color: '#F5A623',
    maxStudents: 400,
    monthlyPrice: 24900,
    annualPrice: 249000,
    setupFee: 100000,
    highlighted: true, // Plan recommandé — badge 'Le plus choisi'
    badge: 'Le plus choisi',
  },
  LEAD: {
    key: 'LEAD',
    name: 'HELM LEAD',
    tagline: 'Dominer',
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
    name: 'HELM NETWORK',
    tagline: 'Scaler',
    taglineEn: 'Scale',
    color: '#070F40',
    maxStudents: Infinity,
    monthlyPrice: null as number | null, // Sur devis
    annualPrice: null as number | null,
    setupFee: 200000,
    highlighted: false,
    badge: 'Groupes scolaires',
  },
} as const;

export type HelmPlanKey = keyof typeof HELM_PLANS;

// Modules inclus dans TOUS les plans (affichage landing page)
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

// Détermine le plan recommandé selon l'effectif actuel
export function getRecommendedPlan(studentCount: number): HelmPlanKey {
  if (studentCount <= 150) return 'SEED';
  if (studentCount <= 400) return 'GROW';
  if (studentCount <= 800) return 'LEAD';
  return 'NETWORK';
}

// Vérifie si un upgrade est nécessaire
export function needsUpgrade(currentPlan: HelmPlanKey, studentCount: number): boolean {
  const recommended = getRecommendedPlan(studentCount);
  const order: HelmPlanKey[] = ['SEED', 'GROW', 'LEAD', 'NETWORK'];
  return order.indexOf(recommended) > order.indexOf(currentPlan);
}

