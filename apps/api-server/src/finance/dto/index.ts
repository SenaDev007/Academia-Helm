/**
 * ============================================================================
 * FINANCE MODULE — ALL DTOs
 * ============================================================================
 * Single source of truth for every request-body DTO in the Finance module.
 * The global ValidationPipe is configured with:
 *   whitelist: true, forbidNonWhitelisted: true
 * so only explicitly-decorated fields will pass through.
 * ============================================================================
 */

import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsIn,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── 1. FeeStructure ────────────────────────────────────────────────────────

export class CreateFeeStructureDto {
  @IsString()
  academicYearId: string;

  @IsString()
  name: string;

  @IsIn(['INSCRIPTION', 'REINSCRIPTION', 'TUITION', 'CANTEEN', 'EXAMEN', 'GENERAL', 'OTHER'])
  feeType: string;

  @IsOptional()
  @IsString()
  customFeeTypeLabel?: string;

  @IsNumber()
  totalAmount: number;

  @IsBoolean()
  isInstallment: boolean;

  @IsBoolean()
  isMandatory: boolean;

  @IsOptional()
  @IsString()
  levelId?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  /// Classe officielle (AcademicClass) — ex: "CE1", "CM2", "6ème".
  /// Utilisée pour configurer les frais au niveau officiel (pas physique).
  @IsOptional()
  @IsString()
  academicClassId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  installments?: any[];
}

export class UpdateFeeStructureDto {
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['INSCRIPTION', 'REINSCRIPTION', 'TUITION', 'CANTEEN', 'EXAMEN', 'GENERAL', 'OTHER'])
  feeType?: string;

  @IsOptional()
  @IsString()
  customFeeTypeLabel?: string;

  @IsOptional()
  @IsNumber()
  totalAmount?: number;

  @IsOptional()
  @IsBoolean()
  isInstallment?: boolean;

  @IsOptional()
  @IsBoolean()
  isMandatory?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  levelId?: string | null;

  @IsOptional()
  @IsString()
  classId?: string | null;

  /// Classe officielle (AcademicClass) — ex: "CE1", "CM2", "6ème".
  @IsOptional()
  @IsString()
  academicClassId?: string | null;

  @IsOptional()
  @IsArray()
  installments?: any[];
}

// ─── 2. FeeCategory ─────────────────────────────────────────────────────────

export class CreateFeeCategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  code?: string;
}

// ─── 3. FeeDefinition ───────────────────────────────────────────────────────

export class CreateFeeDefinitionDto {
  @IsString()
  name: string;

  @IsString()
  feeCategoryId: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  schoolLevelId?: string;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateFeeDefinitionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  feeCategoryId?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  classId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

// ─── 4. StudentFee ──────────────────────────────────────────────────────────

export class CreateStudentFeeDto {
  @IsString()
  studentId: string;

  @IsString()
  feeDefinitionId: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  schoolLevelId?: string;
}

// ─── 5. Payment ─────────────────────────────────────────────────────────────

export class CreatePaymentDto {
  @IsString()
  academicYearId?: string;

  @IsString()
  studentFeeId: string;

  @IsNumber()
  amount: number;

  @IsIn(['CASH', 'MOBILE_MONEY', 'FEDAPAY', 'WIRE', 'FEDAPAY'])
  paymentMethod: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;
}

// ─── 6. Transaction ─────────────────────────────────────────────────────────

export class CreateTransactionDto {
  @IsString()
  academicYearId: string;

  @IsString()
  studentAccountId: string;

  @IsNumber()
  amount: number;

  @IsIn(['CASH', 'MOBILE_MONEY', 'FEDAPAY', 'WIRE', 'FEDAPAY'])
  paymentMethod: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;

  /**
   * Caisse associée au paiement (obligatoire pour les espèces, optionnelle
   * pour les autres méthodes). Le frontend NewPaymentModal l'envoie pour
   * permettre le suivi du solde par caisse.
   */
  @IsOptional()
  @IsString()
  cashRegisterId?: string;

  /**
   * Montant remis par le client en espèces (uniquement pour paymentMethod = CASH).
   * Ex: client donne 50000 FCFA pour un paiement de 45000 FCFA → tenderedAmount = 50000.
   * Le frontend envoie cette valeur saisie par l'utilisateur.
   */
  @IsOptional()
  @IsNumber()
  tenderedAmount?: number;

  /**
   * Reliquat / monnaie rendue au client (calculé côté frontend : tenderedAmount - amount).
   * Ex: 50000 - 45000 = 5000 FCFA. Re-vérifié côté backend par sécurité.
   */
  @IsOptional()
  @IsNumber()
  changeGiven?: number;

  /**
   * ⭐ Encaissement DÉDIÉ (sept. 2026 — exigence « frais généraux ») :
   * quand ce champ est fourni, le paiement est imputé UNIQUEMENT aux
   * AccountBreakdown de ce type de frais (ex: 'GENERAL' pour l'encaissement
   * dédié des frais généraux dans l'onglet Encaissements).
   *
   * Comportement :
   *  - l'allocation FIFO des arriérés des années antérieures est ignorée
   *    (le paiement cible les frais de l'année en cours pour ce type) ;
   *  - si le montant dépasse le restant dû pour ce type de frais, la
   *    requête est refusée (400) avec un message explicite — on ne crée
   *    JAMAIS de transaction non allouée.
   */
  @IsOptional()
  @IsIn(['INSCRIPTION', 'REINSCRIPTION', 'TUITION', 'CANTEEN', 'EXAMEN', 'GENERAL', 'OTHER'])
  targetFeeType?: string;

  /**
   * ⭐ RÉPARTITION MANUELLE (sept. 2026 — flexibilité encaissement) :
   * liste d'imputations EXPLICITES fournies par la comptable / secrétaire
   * comptable (ex. : parent qui paie frais d'inscription + uniforme mais pas
   * encore la scolarité, ou partiellement).
   *
   * Comportement (voir FinanceTransactionService.create) :
   *  - chaque ligne est imputée EXACTEMENT sur l'AccountBreakdown visé
   *    (validation : appartient au compte, montant > 0, ≤ restant dû) ;
   *  - l'allocation FIFO des arriérés antérieurs est ignorée (la
   *    comptable décide explicitement de la répartition) ;
   *  - le reliquat éventuel (amount - somme des lignes) est imputé via
   *    la cascade de priorité classique, sur les restants non couverts.
   *
   * Mutuellement exclusif avec targetFeeType.
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ManualAllocationItemDto)
  manualAllocations?: ManualAllocationItemDto[];

  /**
   * ⭐ FRAIS GÉNÉRAUX À LA CARTE (sept. 2026) : frais généraux choisis dans
   * le catalogue au moment de l'encaissement (pattern « articles boutique »).
   *
   * Chaque ligne référence une FeeStructure feeType=GENERAL (isActive) qui
   * n'est PAS nécessairement déjà sur le compte de l'élève : le backend crée
   * l'AccountBreakdown correspondant À LA VOLÉE (initial = montant de la
   * structure) puis impute le paiement dessus via la répartition explicite.
   *
   * Comportement (voir FinanceTransactionService.create) :
   *  - validation : structure GENERAL active du tenant, montant > 0 et ≤
   *    totalAmount de la structure (ou ≤ restant dû si ligne déjà existante) ;
   *  - le breakdown manquant est créé + totalDue/balance du compte ajustés ;
   *  - les montants sont fusionnés dans les imputations explicites (le reliquat
   *    éventuel part en cascade de priorité classique).
   *
   * Mutuellement exclusif avec targetFeeType.
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GeneralFeeAddOnItemDto)
  generalFeeAddOns?: GeneralFeeAddOnItemDto[];
}

/**
 * ⭐ ÉDITION D'UN ENCAISSEMENT (sept. 2026 — promoteur uniquement) :
 * permet au promoteur de rectifier un paiement saisi par erreur pour aligner
 * les données sur les documents papier fournis par les écoles.
 * Voir FinanceTransactionService.update() + FinanceTransactionController.
 */
export class UpdateTransactionDto {
  /** Nouveau montant du paiement (> 0). Les imputations sont recalculées
   *  proportionnellement (même répartition, montants rescaling). */
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  /** Nouveau mode de paiement. Bloqué pour les paiements FEDAPAY (origine
   *  passerelle en ligne — changer sa nature casserait la traçabilité). */
  @IsOptional()
  @IsIn(['CASH', 'MOBILE_MONEY', 'FEDAPAY', 'WIRE'])
  paymentMethod?: string;

  /** Nouvelle date/heure du paiement (alignement documents papier).
   *  Date ISO 8601 — le frontend envoie la date locale Bénin (UTC+1). */
  @IsOptional()
  @IsString()
  createdAt?: string;

  /** Nouvelle référence libre. */
  @IsOptional()
  @IsString()
  reference?: string;

  /** Nouvelle caisse (déplacement de l'encaissement). Bloqué pour FEDAPAY. */
  @IsOptional()
  @IsString()
  cashRegisterId?: string | null;

  /** Montant remis en espèces (si CASH) — recalculé si montant changé. */
  @IsOptional()
  @IsNumber()
  tenderedAmount?: number;

  /** Motif de la correction (obligatoire — trace d'audit). */
  @IsString()
  reason: string;
}

/**
 * ⭐ SUPPRESSION D'UN ENCAISSEMENT (sept. 2026 — promoteur uniquement) :
 * suppression physique exceptionnelle (imputations + soldes + caisses
 * réversés) — réservée aux paiements erronés/inexistants dans les documents.
 * Voir FinanceTransactionService.remove() + FinanceTransactionController.
 */
export class DeleteTransactionDto {
  /** Motif de la suppression (obligatoire — trace d'audit). */
  @IsString()
  reason: string;
}

export class ManualAllocationItemDto {
  @IsString()
  accountBreakdownId: string;

  @IsNumber()
  @Min(0.01)
  amount: number;
}

export class GeneralFeeAddOnItemDto {
  /** UUID de la FeeStructure feeType=GENERAL à ajouter au paiement. */
  @IsString()
  feeStructureId: string;

  /** Montant à encaisser MAINTENANT pour ce frais (> 0, ≤ totalAmount). */
  @IsNumber()
  @Min(0.01)
  amount: number;
}

// ─── 7. ExpenseCategory ─────────────────────────────────────────────────────

export class CreateExpenseCategoryDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsOptional()
  @IsString()
  schoolLevelId?: string;

  /** Numéro de compte OHADA pour l'export comptable (ex: 605000) */
  @IsOptional()
  @IsString()
  compteOhada?: string;

  /** Libellé du compte OHADA (facultatif) */
  @IsOptional()
  @IsString()
  compteOhadaLib?: string;
}

export class UpdateExpenseCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  code?: string;

  /** Numéro de compte OHADA pour l'export comptable (ex: 605000) */
  @IsOptional()
  @IsString()
  compteOhada?: string;

  /** Libellé du compte OHADA (facultatif) */
  @IsOptional()
  @IsString()
  compteOhadaLib?: string;
}

// ─── 8. Expense ─────────────────────────────────────────────────────────────

export class CreateExpenseDto {
  @IsOptional()
  @IsString()
  academicYearId?: string;

  @IsString()
  schoolLevelId: string;

  @IsString()
  categoryId: string;

  @IsString()
  description: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  expenseDate?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  expenseDate?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

// ─── 9. Treasury (Daily Closures) ───────────────────────────────────────────

export class CreateTreasuryClosureDto {
  @IsString()
  academicYearId: string;

  @IsString()
  schoolLevelId: string;

  @IsString()
  date: string;

  @IsNumber()
  openingBalance: number;

  @IsOptional()
  @IsNumber()
  totalCollected?: number;

  @IsOptional()
  @IsNumber()
  totalSpent?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ─── 10. Collection ─────────────────────────────────────────────────────────

export class CreateCollectionReminderDto {
  @IsString()
  arrearId: string;

  @IsIn(['WARNING', 'URGENT', 'FINAL_NOTICE'])
  level: string;

  @IsIn(['SMS', 'WHATSAPP', 'EMAIL'])
  channel: string;

  @IsOptional()
  @IsString()
  message?: string;
}

export class CreatePaymentPromiseDto {
  @IsString()
  arrearId: string;

  @IsNumber()
  promisedAmount: number;

  @IsString()
  promiseDate: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateCollectionActionDto {
  @IsString()
  arrearId: string;

  @IsString()
  actionType: string;

  @IsOptional()
  @IsString()
  description?: string;
}

// ─── 11. FeeRegime ──────────────────────────────────────────────────────────

export class CreateFeeRegimeDto {
  @IsString()
  academicYearId: string;

  @IsString()
  schoolLevelId: string;

  @IsIn(['STANDARD', 'ENFANT_ENSEIGNANT', 'REDUCTION', 'BOURSE'])
  code: string;

  @IsString()
  label: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateFeeRegimeDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreateFeeRegimeRuleDto {
  @IsString()
  feeType: string;

  @IsOptional()
  @IsNumber()
  reductionPercentage?: number;

  @IsOptional()
  @IsNumber()
  fixedAmount?: number;

  @IsOptional()
  @IsString()
  condition?: string;
}

// ─── 12. FinanceExpenseV2 ───────────────────────────────────────────────────

export class CreateFinanceExpenseDto {
  @IsString()
  academicYearId: string;

  @IsString()
  categoryId: string;

  @IsNumber()
  amount: number;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;

  @IsOptional()
  @IsString()
  expenseDate?: string;

  @IsOptional()
  @IsString()
  vendor?: string;

  @IsOptional()
  @IsString()
  invoiceRef?: string;

  /** ID de l'utilisateur qui fait la demande (défaut: utilisateur connecté) */
  @IsOptional()
  @IsString()
  requestedById?: string;

  /** ID de l'utilisateur qui doit approuver (ex: promoteur, directeur) */
  @IsOptional()
  @IsString()
  pendingApproverId?: string;

  /** ID de la caisse source (qui sera débitée à l'approbation) */
  @IsOptional()
  @IsString()
  cashRegisterId?: string;
}

// ─── 13. DailyClosure ───────────────────────────────────────────────────────

export class CreateDailyClosureDto {
  @IsString()
  academicYearId: string;

  @IsString()
  date: string;

  @IsOptional()
  @IsNumber()
  physicalAmount?: number;

  @IsOptional()
  @IsBoolean()
  validate?: boolean;
}

// ─── 14. FinancialSettings ──────────────────────────────────────────────────

export class UpdateFinancialSettingsDto {
  @IsOptional()
  @IsNumber()
  blockingThreshold?: number;

  @IsOptional()
  @IsNumber()
  reminderWarningDays?: number;

  @IsOptional()
  @IsNumber()
  reminderUrgentDays?: number;

  @IsOptional()
  @IsNumber()
  reminderFinalDays?: number;

  @IsOptional()
  @IsBoolean()
  autoClosureEnabled?: boolean;

  @IsOptional()
  @IsString()
  autoClosureTime?: string;

  @IsOptional()
  @IsNumber()
  budgetAlertThreshold?: number;

  @IsOptional()
  @IsBoolean()
  allowPartialPayment?: boolean;

  @IsOptional()
  @IsNumber()
  minimumInstallmentAmount?: number | null;

  @IsOptional()
  @IsNumber()
  cancellationDelayHours?: number;

  @IsOptional()
  @IsBoolean()
  fedapayEnabled?: boolean;

  @IsOptional()
  @IsString()
  fedapayPublicKey?: string;

  @IsOptional()
  @IsString()
  fedapaySecretKey?: string;

  // ─── Relance automatique ───
  @IsOptional()
  @IsBoolean()
  autoRecoveryEnabled?: boolean;

  @IsOptional()
  @IsString()
  autoRecoveryChannels?: string;

  @IsOptional()
  @IsString()
  autoRecoveryFrequency?: string;

  @IsOptional()
  @IsString()
  autoRecoveryTime?: string;

  @IsOptional()
  @IsString()
  autoRecoveryMaxLevel?: string;

  @IsOptional()
  @IsNumber()
  expenseReceiptThreshold?: number | null;

  // ─── Export comptable automatique mensuel ───
  @IsOptional()
  @IsBoolean()
  comptaAutoExportEnabled?: boolean;

  @IsOptional()
  @IsString()
  comptaAutoExportEmail?: string;

  @IsOptional()
  @IsString()
  comptaAutoExportFormat?: string;

  @IsOptional()
  @IsNumber()
  comptaAutoExportDay?: number;
}
