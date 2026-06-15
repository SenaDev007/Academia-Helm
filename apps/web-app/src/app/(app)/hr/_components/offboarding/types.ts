/**
 * Offboarding Workflow Types
 * Professional multi-step employee termination with documents and signatures
 */

export const TERMINATION_TYPES = [
  { key: 'RESIGNATION', label: 'Démission', color: '#F59E0B', description: 'Le collaborateur quitte volontairement' },
  { key: 'DISMISSAL', label: 'Licenciement', color: '#EF4444', description: "Rupture à l'initiative de l'employeur" },
  { key: 'MUTUAL_AGREEMENT', label: 'Rupture conventionnelle', color: '#8B5CF6', description: 'Accord mutuel des deux parties' },
  { key: 'END_OF_CONTRACT', label: 'Fin de contrat', color: '#6B7280', description: "Arrivée à échéance du CDD/stage" },
  { key: 'RETIREMENT', label: 'Retraite', color: '#10B981', description: 'Départ à la retraite' },
  { key: 'DEATH', label: 'Décès', color: '#1F2937', description: 'Décès du collaborateur' },
  { key: 'ABANDONMENT', label: 'Abandon de poste', color: '#F97316', description: 'Départ sans préavis ni justification' },
  { key: 'OTHER', label: 'Autre', color: '#64748B', description: 'Autre motif de départ' },
] as const;

export const OFFBOARDING_STEPS = [
  'Type & Dates',
  'Motif & Détails',
  'Checklist',
  'Documents',
  'Signatures',
  'Confirmation',
] as const;

export interface OffboardingState {
  currentStep: number;
  loading: boolean;
  error: string | null;
  terminated: boolean;

  // Step 1: Type & Dates
  terminationType: string;
  effectiveDate: string;
  lastWorkingDate: string;
  noticePeriodDays: number;

  // Step 2: Reason & Details
  reason: string;
  detailedReason: string;
  authorizedBy: string;
  terminationLetterRef: string;

  // Step 3: Checklist
  exitInterviewConducted: boolean;
  exitInterviewNotes: string;
  equipmentReturned: boolean;
  exitDocumentsProvided: boolean;
  finalSettlementPaid: boolean;

  // Step 4: Documents
  generatedDocuments: {
    letter: boolean;
    certificate: boolean;
    settlement: boolean;
    attestation: boolean;
  };

  // Step 5: Signatures
  employerSigned: boolean;
  employeeSigned: boolean;

  // Step 6: Completed
  completed: boolean;
}

export const INITIAL_OFFBOARDING_STATE: OffboardingState = {
  currentStep: 1,
  loading: false,
  error: null,
  terminated: false,

  terminationType: 'RESIGNATION',
  effectiveDate: new Date().toISOString().split('T')[0],
  lastWorkingDate: '',
  noticePeriodDays: 0,

  reason: '',
  detailedReason: '',
  authorizedBy: '',
  terminationLetterRef: '',

  exitInterviewConducted: false,
  exitInterviewNotes: '',
  equipmentReturned: false,
  exitDocumentsProvided: false,
  finalSettlementPaid: false,

  generatedDocuments: {
    letter: false,
    certificate: false,
    settlement: false,
    attestation: false,
  },

  employerSigned: false,
  employeeSigned: false,

  completed: false,
};
