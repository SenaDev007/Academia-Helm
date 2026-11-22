/**
 * Onboarding Workflow Types
 * Professional 7-step employee onboarding with dual signature
 */

export interface OnboardingState {
  currentStep: number;
  staffId: string | null;
  contractId: string | null;
  loading: boolean;
  error: string | null;

  // ⭐ 158 — Calendrier des interventions (prestation) : sélection STRUCTURÉE
  // (jours + plages horaires + mois prédéfinis) — le texte professionnel du
  // contrat est GÉNÉRÉ automatiquement (jamais saisi à la main). La sélection
  // persiste pendant toute la session du wizard (retours arrière inclus).
  prestationCalendar: { days: string[]; slots: string[]; months: string[] };

  // ⭐ 158 — Statut contractuel DÉJÀ SAUVÉ sur la fiche du personnel (étape 2).
  // Permet de détecter un CHANGEMENT après retour arrière et de recréer le
  // contrat DRAFT avec le bon statut (au lieu de refuser/bloquer le RH).
  savedStatutContractuel: string;
  // ⭐ 158 — Signature du contrat DRAFT créé à l'étape 4 (statut + type + dates +
  // montants). Toute divergence après retour arrière → suppression du brouillon
  // non signé + recréation propre (le RH n'est jamais bloqué).
  contractDraftSignature: string | null;

  // Step 1: Identité
  identity: {
    firstName: string;
    lastName: string;
    gender: string;
    birthDate: string;
    nationality: string;
    maritalStatus: string;
    numberOfChildren: number;
    nationalId: string;
    email: string;
    phone: string;
    address: string;
  };

  // Step 2: Emploi
  employment: {
    position: string;
    department: string;
    roleType: string;
    hireDate: string;
    qualifications: string;
    // ⭐ Statut contractuel RH Bénin (choix BLOQUANT, avant tout champ financier) :
    //   SALARIE_DECLARE | SALARIE_NON_DECLARE | PRESTATAIRE_SERVICE
    // Détermine le gabarit de contrat, le document de paie (fiche/état) et la
    // branche du moteur de calcul. Verrouillé après création du profil.
    statutContractuel: string;
    // ⭐ Multi-poste : permet de préciser un poste enseignant en plus du
    //    poste principal. Le promoteur peut décider qu'un comptable enseigne
    //    aussi une matière. Le contrat reflétera les deux postes.
    secondaryPosition: string;
    isAlsoTeacher: boolean;
  };

  // Step 3: Documents
  documents: {
    [documentType: string]: File | null;
  };
  uploadedDocuments: {
    [documentType: string]: boolean;
  };

  // Step 4: Contrat
  contract: {
    contractType: string;
    templateId: string;
    startDate: string;
    endDate: string;
    baseSalary: string;
    paymentMode: string;
    bankName: string;
    accountNumber: string;
    accountHolder: string;
    mobileMoneyNumber: string;
    mobileMoneyOperator: string;
    cnssNumber: string;
    ifuNumber: string;
    // ⭐ Prestataire de services (statutContractuel = PRESTATAIRE_SERVICE)
    prestationPaymentMode: 'FORFAIT' | 'HORAIRE';
    prestationAmount: string;
    prestationDescription: string;
    prestationCalendrier: string;
    prestationRenouvelable: boolean;
    prestationConfidentialite: boolean;
    prestationPropriete: boolean;
    // ⭐ Refonte CDC « étape Contrat » — structure 2 niveaux + champs conditionnels
    /** Motif du CDD (obligatoire si CDD — suggestions paramétrables par école) */
    cddMotif: string;
    /** Période d'essai CDI en mois (défaut suggéré selon catégorie, modifiable) */
    periodeEssaiMois: string;
    /** Traçabilité de la décision de statut (§4.4 — optionnel, recommandé) */
    justificationStatut: string;
  };

  // ⭐ Indemnités liées au recrutement — communication onglet Indemnités ↔
  //    workflow d'embauche : les types viennent du catalogue complet (API) et
  //    les montants saisis ici sont créés (StaffAllowance) dès la validation
  //    de l'étape Contrat. Le contrat généré les relate (Article 5) et la paie
  //    les reprend chaque mois. Montants modifiables à tout moment ensuite.
  allowances: Array<{ allowanceTypeId: string; amount: string }>;
  /** Garde-fou anti-doublon : assignations d'indemnités déjà créées en base */
  allowancesSaved: boolean;

  // ⭐ 160 — Garde-fou anti-doublon : HrCandidate (ÉLIGIBLE) déjà créé pour ce
  //    recrutement — créé désormais à l'étape 4 (contrat), PAS à l'étape 1 :
  //    un brouillon interrompu avant le contrat ne laisse AUCUNE trace dans
  //    l'onglet Embauche.
  candidateSaved: boolean;

  // ⭐ Test d'aide à la qualification (CDC §5 — non bloquant, configurable)
  qualificationTest: {
    enabled: boolean;
    questions: Array<{ id: string; question: string; help?: string; options: [string, string]; firstOptionMeaning: 'subordination' | 'autonomie' }>;
    answers: Record<string, 0 | 1>;
    suggestion: string | null;
    showTest: boolean;
  };

  // Step 5: Preview
  articles: Array<{ title: string; content: string }>;
  articlesSaved: boolean;
  previewHtml: string | null;
  pdfGenerated: boolean;

  // Step 6: Signatures
  // ⭐ signatureMode :
  //   - 'presentiel' (défaut) : les deux parties signent en présence, synchrone
  //     (employeur + employé signent dans le wizard, contrat → ACTIVE immédiatement)
  //   - 'differe' : seul l'employeur signe dans le wizard (contrat → PENDING),
  //     puis un email avec lien de signature est envoyé à l'employé qui signe
  //     à distance. Identique au flux de recrutement public.
  //   - 'manuel' (⭐ 22/11/2026 — retour promoteur) : le contrat a DÉJÀ été signé
  //     SUR PAPIER — le RH le déclare, le système l'enregistre comme signé
  //     (mention MANUSCRITE_PAPIER) et continue, SANS aucune signature
  //     électronique exigée.
  signatureMode: 'presentiel' | 'differe' | 'manuel';
  employerSigned: boolean;
  employeeSigned: boolean;
  employerSignatureData: string | null;
  employeeSignatureData: string | null;

  // Step 7: Completion
  sendEmail: boolean;
  completed: boolean;
}

export const INITIAL_STATE: OnboardingState = {
  currentStep: 1,
  staffId: null,
  contractId: null,
  loading: false,
  error: null,

  prestationCalendar: { days: [], slots: [], months: [] },
  savedStatutContractuel: '',
  contractDraftSignature: null,

  identity: {
    firstName: '',
    lastName: '',
    gender: 'MALE',
    birthDate: '',
    nationality: '',
    maritalStatus: 'SINGLE',
    numberOfChildren: 0,
    nationalId: '',
    email: '',
    phone: '',
    address: '',
  },

  employment: {
    position: '',
    department: '',
    roleType: 'TEACHER',
    hireDate: new Date().toISOString().split('T')[0],
    qualifications: '',
    statutContractuel: '',
    secondaryPosition: '',
    isAlsoTeacher: false,
  },

  documents: {
    CV: null,
    CNI: null,
    BIRTH_CERTIFICATE: null,
    DIPLOMA: null,
    CNSS_CERTIFICATE: null,
    MEDICAL_CERTIFICATE: null,
    PHOTO_ID: null,
  },
  uploadedDocuments: {},

  contract: {
    contractType: 'CDD',
    templateId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    baseSalary: '150000',
    paymentMode: 'BANK',
    bankName: '',
    accountNumber: '',
    accountHolder: '',
    mobileMoneyNumber: '',
    mobileMoneyOperator: '',
    cnssNumber: '',
    ifuNumber: '',
    prestationPaymentMode: 'FORFAIT',
    prestationAmount: '',
    prestationDescription: '',
    prestationCalendrier: '',
    prestationRenouvelable: false,
    prestationConfidentialite: true,
    prestationPropriete: true,
    cddMotif: '',
    periodeEssaiMois: '',
    justificationStatut: '',
  },

  allowances: [],
  allowancesSaved: false,
  candidateSaved: false,

  qualificationTest: {
    enabled: true,
    questions: [],
    answers: {},
    suggestion: null,
    showTest: false,
  },

  articles: [],
  articlesSaved: false,
  previewHtml: null,
  pdfGenerated: false,

  signatureMode: 'presentiel',
  employerSigned: false,
  employeeSigned: false,
  employerSignatureData: null,
  employeeSignatureData: null,

  sendEmail: true,
  completed: false,
};

export const REQUIRED_DOCUMENTS: string[] = [];

export const DOCUMENT_CONFIG: Record<string, { label: string; category: string; required: boolean }> = {
  CV: { label: 'Curriculum Vitae (CV)', category: 'EXPERIENCE', required: false },
  CNI: { label: "Pièce d'Identité / Passeport", category: 'IDENTITE', required: false },
  BIRTH_CERTIFICATE: { label: 'Acte de Naissance', category: 'IDENTITE', required: false },
  DIPLOMA: { label: 'Diplôme le plus élevé', category: 'DIPLOMES', required: false },
  CNSS_CERTIFICATE: { label: 'Attestation CNSS', category: 'ADMINISTRATIF', required: false },
  MEDICAL_CERTIFICATE: { label: 'Certificat Médical', category: 'MEDICAL', required: false },
  PHOTO_ID: { label: "Photo d'identité", category: 'IDENTITE', required: false },
};

export const STEP_LABELS = [
  'Identité',
  'Emploi',
  'Documents',
  'Contrat',
  'Aperçu',
  'Signatures',
  'Finalisation',
];

export type OnboardingAction =
  | { type: 'SET_STEP'; step: number }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'SET_STAFF_ID'; staffId: string }
  | { type: 'SET_CONTRACT_ID'; contractId: string }
  | { type: 'UPDATE_IDENTITY'; field: string; value: any }
  | { type: 'UPDATE_EMPLOYMENT'; field: string; value: any }
  | { type: 'SET_DOCUMENT'; documentType: string; file: File | null }
  | { type: 'MARK_DOCUMENT_UPLOADED'; documentType: string }
  | { type: 'UPDATE_CONTRACT'; field: string; value: any }
  | { type: 'UPDATE_QUALIFICATION'; patch: Partial<OnboardingState['qualificationTest']> }
  | { type: 'SET_ARTICLES'; articles: Array<{ title: string; content: string }> }
  | { type: 'SET_ARTICLES_SAVED'; saved: boolean }
  | { type: 'SET_PREVIEW_HTML'; html: string | null }
  | { type: 'SET_PDF_GENERATED'; generated: boolean }
  | { type: 'SET_SIGNATURE_MODE'; mode: 'presentiel' | 'differe' }
  | { type: 'SET_EMPLOYER_SIGNED'; signed: boolean; signatureData: string | null }
  | { type: 'SET_EMPLOYEE_SIGNED'; signed: boolean; signatureData: string | null }
  | { type: 'SET_SEND_EMAIL'; sendEmail: boolean }
  | { type: 'SET_COMPLETED'; completed: boolean }
  | { type: 'RESET' };
