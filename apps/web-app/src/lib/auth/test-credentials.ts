/**
 * ============================================================================
 * IDENTIFIANTS DE TEST — TENANT DÉDIÉ « ACADEMIA HELM »
 * ============================================================================
 *
 * ⚠️ TEST UNIQUEMENT — ce module n'est actif QUE pour le tenant de test
 * « Academia Helm » (slug `academia-helm`). Les vraies écoles ne voient
 * jamais ces informations : le panneau d'identifiants est masqué partout
 * ailleurs (isTestCredentialsTenant renvoie false).
 *
 * Contexte : le promoteur a créé un tenant dédié aux tests/recette afin de
 * ne plus polluer les données des écoles réelles. Les comptes ci-dessous
 * vivent dans ce tenant avec des emails non délivrables (@academia-helm.test)
 * et un mot de passe commun connu — affichés directement sur les écrans de
 * connexion de l'école Academia Helm pour faciliter les vérifications de
 * chaque portail (École / Enseignant / Parent).
 *
 * ⚠️ ANONYMISATION (Task 78) : les comptes de test portent désormais des
 * identités ENTIÈREMENT FICTIVES (patronyme « HELM ») — aucun vrai nom ni
 * aucune vraie adresse du tenant CSPEB ne doit apparaître ici.
 *
 * Source de vérité : scripts/task77_set_credentials.py puis
 * scripts/task78_anonymize.py (anonymisation DB),
 * fiche download/academiahelm_comptes_de_test.md.
 * ============================================================================
 */

export type TestCredentialPortal = 'school' | 'teacher' | 'parent';

/** Slug canonique du tenant de test */
export const TEST_TENANT_SLUG = 'academia-helm';

/** Identifiant interne (UUID) du tenant de test — accepté comme clé alternative */
export const TEST_TENANT_UUID = '178d5b6b-d4f3-4246-bc8c-76a2e8fc2e4b';

/** Mot de passe commun à TOUS les comptes de test du tenant Academia Helm */
export const TEST_PASSWORD = 'HelmTest2026!';

export interface TestAccount {
  /** Portail de connexion concerné */
  portal: TestCredentialPortal;
  /** Libellé du rôle (affiché en gras) */
  roleLabel: string;
  /** Nom du titulaire du compte */
  name: string;
  /** Identifiant de connexion : email (école), matricule (enseignant), téléphone (parent) */
  identifier: string;
  /** Nature de l'identifiant (libellé affiché) */
  identifierLabel: string;
  /** Mot de passe du compte */
  password: string;
  /** Précision utile affichée sous la ligne du compte */
  note?: string;
}

/**
 * Comptes de test du tenant Academia Helm — identités fictives (Task 78 :
 * anonymisation complète, patronyme HELM ; Task 77 : mot de passe commun).
 */
export const TEST_ACCOUNTS: TestAccount[] = [
  // ── Portail École (email + mot de passe) ──
  {
    portal: 'school',
    roleLabel: 'Promoteur',
    name: 'Recette Promoteur',
    identifier: 'recette.promoteur@academia-helm.test',
    identifierLabel: 'Email',
    password: TEST_PASSWORD,
  },
  {
    portal: 'school',
    roleLabel: 'Promoteur',
    name: 'Placide HELM',
    identifier: 'recette.promoteur2@academia-helm.test',
    identifierLabel: 'Email',
    password: TEST_PASSWORD,
  },
  {
    portal: 'school',
    roleLabel: 'Directeur (Maternelle / Primaire)',
    name: 'Recette Directeur',
    identifier: 'recette.directeur@academia-helm.test',
    identifierLabel: 'Email',
    password: TEST_PASSWORD,
  },
  {
    portal: 'school',
    roleLabel: 'Directrice (Maternelle / Primaire)',
    name: 'Damienne HELM',
    identifier: 'recette.directrice@academia-helm.test',
    identifierLabel: 'Email',
    password: TEST_PASSWORD,
    note: 'Aussi connectable au Portail Enseignant avec le matricule AHE-26-00010.',
  },
  {
    portal: 'school',
    roleLabel: 'Secrétaire comptable',
    name: 'Recette Sec Comptable',
    identifier: 'recette.sec-comptable@academia-helm.test',
    identifierLabel: 'Email',
    password: TEST_PASSWORD,
  },
  {
    portal: 'school',
    roleLabel: 'Secrétaire comptable (Mat. / Prim.)',
    name: 'Sandra HELM',
    identifier: 'recette.sec-comptable2@academia-helm.test',
    identifierLabel: 'Email',
    password: TEST_PASSWORD,
    note: 'Aussi connectable au Portail Enseignant avec le matricule AHE-26-00006.',
  },
  {
    portal: 'school',
    roleLabel: 'Comptable',
    name: 'Recette Comptable',
    identifier: 'recette.comptable@academia-helm.test',
    identifierLabel: 'Email',
    password: TEST_PASSWORD,
  },
  {
    portal: 'school',
    roleLabel: 'Enseignant — double casquette',
    name: 'Karim HELM',
    identifier: 'karim.helm@academia-helm.test',
    identifierLabel: 'Email',
    password: TEST_PASSWORD,
    note: 'Anciennement rattaché à un compte externe. Aussi le Portail Enseignant avec le matricule AHE-26-00008.',
  },
  {
    portal: 'school',
    roleLabel: 'Enseignante — double casquette',
    name: 'Jade HELM',
    identifier: 'jade.helm@academia-helm.test',
    identifierLabel: 'Email',
    password: TEST_PASSWORD,
    note: 'Aussi le Portail Enseignant avec le matricule AHE-26-00011.',
  },

  // ── Portail Enseignant (matricule + mot de passe) ──
  {
    portal: 'teacher',
    roleLabel: 'Enseignant',
    name: 'Éric HELM',
    identifier: 'AHE-26-00007',
    identifierLabel: 'Matricule',
    password: TEST_PASSWORD,
  },
  {
    portal: 'teacher',
    roleLabel: 'Enseignante',
    name: 'Nadège HELM',
    identifier: 'AHE-26-00009',
    identifierLabel: 'Matricule',
    password: TEST_PASSWORD,
  },
  {
    portal: 'teacher',
    roleLabel: 'Enseignant',
    name: 'Blaise HELM',
    identifier: 'AHE-P-26-00014',
    identifierLabel: 'Matricule',
    password: TEST_PASSWORD,
  },
  {
    portal: 'teacher',
    roleLabel: 'Directrice — double casquette',
    name: 'Damienne HELM',
    identifier: 'AHE-26-00010',
    identifierLabel: 'Matricule',
    password: TEST_PASSWORD,
    note: 'Cumule direction et enseignement : aussi le Portail École par email.',
  },
  {
    portal: 'teacher',
    roleLabel: 'Secrétaire comptable — double casquette',
    name: 'Sandra HELM',
    identifier: 'AHE-26-00006',
    identifierLabel: 'Matricule',
    password: TEST_PASSWORD,
    note: 'Cumule administration et enseignement : aussi le Portail École par email.',
  },
  {
    portal: 'teacher',
    roleLabel: 'Enseignant',
    name: 'Karim HELM',
    identifier: 'AHE-26-00008',
    identifierLabel: 'Matricule',
    password: TEST_PASSWORD,
  },
  {
    portal: 'teacher',
    roleLabel: 'Enseignante',
    name: 'Jade HELM',
    identifier: 'AHE-26-00011',
    identifierLabel: 'Matricule',
    password: TEST_PASSWORD,
  },

  // ── Portail Parent / Élève (téléphone, connexion directe) ──
  {
    portal: 'parent',
    roleLabel: 'Parent',
    name: 'Pascal HELM',
    identifier: '+229 97 00 00 01',
    identifierLabel: 'Téléphone',
    password: TEST_PASSWORD,
    note: 'Connexion : téléphone + mot de passe (identifiants envoyés via Élèves → Familles → Création de compte). Par email : guardian-c2364fcd-2fa6-4d57-a1b8-329f9a6c4d55@academia-helm.test',
  },
  {
    portal: 'parent',
    roleLabel: 'Parent',
    name: 'Odile HELM',
    identifier: '+229 97 00 00 02',
    identifierLabel: 'Téléphone',
    password: TEST_PASSWORD,
    note: 'Connexion : téléphone + mot de passe (identifiants envoyés via Élèves → Familles → Création de compte). Par email : guardian-ddb43cd4-95d0-490e-b463-76c2d9d26997@academia-helm.test',
  },
];

/**
 * Indique si l'école/portail courant correspond au tenant de test Academia Helm.
 * Accepte indifféremment un slug, un UUID, un id numérique ou un nom d'école.
 *
 * ⚠️ Correspondance stricte sur des mots ENTIERS : « academia-helms » ou
 * « academia-helm-examens » ne doivent PAS matcher (préfixe partiel).
 */
export function isTestCredentialsTenant(candidate?: string | null): boolean {
  if (!candidate || typeof candidate !== 'string') return false;
  const raw = candidate.trim().toLowerCase();
  if (!raw) return false;

  // Slug exact (« academia-helm », « Academia Helm », « ACADEMIA.HELM »…)
  const compact = raw.replace(/[\s\-_.]+/g, '');
  if (compact === 'academiahelm') return true;

  // UUID interne exact
  const uuidCompact = TEST_TENANT_UUID.replace(/[\s\-_.]+/g, '');
  if (compact === uuidCompact) return true;

  // Nom d'école contenant les mots entiers « academia » + « helm » adjacents
  // (frontières de mots : « Academia Helm », « École Academia Helm » ✓ ;
  //  « Academia Helms », « Academia-Helm-Examen » ✗)
  if (/(^|[^a-z0-9à-ÿ])academia[\s\-_.]+helm($|[^a-z0-9à-ÿ])/.test(raw)) return true;

  return false;
}

/**
 * Comptes de test pour un portail donné (null/undefined → tous, groupés).
 */
export function getTestAccounts(portal?: TestCredentialPortal | null): TestAccount[] {
  if (!portal) return TEST_ACCOUNTS;
  return TEST_ACCOUNTS.filter((account) => account.portal === portal);
}

/* ── Pré-remplissage inter-pages (sélecteur de portail → page de login) ──
 *
 * Le sélecteur d'école ne peut pas remplir directement le formulaire de la
 * page /login (navigation complète). On passe donc par le sessionStorage :
 * le compte choisi est mémorisé, la page de login le consomme au montage
 * pour pré-remplir le formulaire, puis l'efface.
 */

const PREFILL_KEY = 'ah_test_credential_prefill';

/** Mémorise le compte de test choisi (avant navigation vers /login). */
export function setTestCredentialPrefill(account: TestAccount): void {
  try {
    sessionStorage.setItem(PREFILL_KEY, JSON.stringify(account));
  } catch {
    // sessionStorage indisponible (mode privé strict) — silencieux
  }
}

/**
 * Lit puis EFFACE le compte de test mémorisé (à appeler au montage de la
 * page de login). Retourne null si aucun compte en attente.
 */
export function consumeTestCredentialPrefill(): TestAccount | null {
  try {
    const raw = sessionStorage.getItem(PREFILL_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(PREFILL_KEY);
    const parsed = JSON.parse(raw) as TestAccount;
    if (!parsed || !parsed.portal || !parsed.identifier) return null;
    return parsed;
  } catch {
    return null;
  }
}
