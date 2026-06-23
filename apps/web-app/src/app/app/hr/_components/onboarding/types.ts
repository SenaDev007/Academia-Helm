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
  };

  // Step 5: Preview
  articles: Array<{ title: string; content: string }>;
  articlesSaved: boolean;
  previewHtml: string | null;
  pdfGenerated: boolean;

  // Step 6: Signatures
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
  },

  articles: [],
  articlesSaved: false,
  previewHtml: null,
  pdfGenerated: false,

  employerSigned: false,
  employeeSigned: false,
  employerSignatureData: null,
  employeeSignatureData: null,

  sendEmail: true,
  completed: false,
};

export const REQUIRED_DOCUMENTS = ['CV', 'CNI', 'DIPLOMA'];

export const DOCUMENT_CONFIG: Record<string, { label: string; category: string; required: boolean }> = {
  CV: { label: 'Curriculum Vitae (CV)', category: 'EXPERIENCE', required: true },
  CNI: { label: "Pièce d'Identité / Passeport", category: 'IDENTITE', required: true },
  BIRTH_CERTIFICATE: { label: 'Acte de Naissance', category: 'IDENTITE', required: false },
  DIPLOMA: { label: 'Diplôme le plus élevé', category: 'DIPLOMES', required: true },
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
  | { type: 'SET_ARTICLES'; articles: Array<{ title: string; content: string }> }
  | { type: 'SET_ARTICLES_SAVED'; saved: boolean }
  | { type: 'SET_PREVIEW_HTML'; html: string | null }
  | { type: 'SET_PDF_GENERATED'; generated: boolean }
  | { type: 'SET_EMPLOYER_SIGNED'; signed: boolean; signatureData: string | null }
  | { type: 'SET_EMPLOYEE_SIGNED'; signed: boolean; signatureData: string | null }
  | { type: 'SET_SEND_EMAIL'; sendEmail: boolean }
  | { type: 'SET_COMPLETED'; completed: boolean }
  | { type: 'RESET' };
