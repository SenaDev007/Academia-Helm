/**
 * ============================================================================
 * PAYMENT FLOW ENTITY - SÉPARATION STRICTE DES FLUX FINANCIERS
 * ============================================================================
 * 
 * PRINCIPE FONDAMENTAL :
 * Academia Hub n'est PAS une banque.
 * Academia Hub ne détient PAS les fonds des écoles.
 * 
 * SÉPARATION STRICTE :
 * - SAAS : Paiements vers Academia Hub (souscriptions, abonnements, options)
 * - TUITION : Paiements vers les écoles (frais scolaires)
 * 
 * Chaque flux est explicitement typé et traçable.
 * 
 * ============================================================================
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Student } from '../../students/entities/student.entity';
import { User } from '../../users/entities/user.entity';

/**
 * Type de flux de paiement
 */
export enum PaymentFlowType {
  SAAS = 'SAAS',       // Paiements vers Academia Hub
  TUITION = 'TUITION', // Paiements vers les écoles
}

/**
 * Destination du paiement
 */
export enum PaymentDestination {
  ACADEMIA = 'ACADEMIA', // Vers Academia Hub
  SCHOOL = 'SCHOOL',     // Vers l'école (tenant)
}

/**
 * Statut du paiement
 */
export enum PaymentFlowStatus {
  INITIATED = 'INITIATED',   // Paiement initié
  PENDING = 'PENDING',       // En attente de traitement
  PAID = 'PAID',             // Payé avec succès
  FAILED = 'FAILED',         // Échec du paiement
  CANCELLED = 'CANCELLED',   // Annulé
  REFUNDED = 'REFUNDED',     // Remboursé
}

/**
 * Provider de paiement (PSP)
 */
export enum PaymentServiceProvider {
  FEDAPAY = 'FEDAPAY',
  CELTIIS = 'CELTIIS',
  MOOV_MONEY = 'MOOV_MONEY',
  MTN_MONEY = 'MTN_MONEY',
  CASH = 'CASH',           // Espèces (pour TUITION uniquement)
  BANK_TRANSFER = 'BANK_TRANSFER', // Virement bancaire
}

@Entity('payment_flows')
export class PaymentFlow {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  /**
   * Type de flux (SAAS ou TUITION)
   * RÈGLE : SAAS → destination ACADEMIA, TUITION → destination SCHOOL
   */
  @Column({
    type: 'varchar',
    length: 20,
    enum: PaymentFlowType,
  })
  flowType: PaymentFlowType;

  /**
   * Destination du paiement
   * Dérivé automatiquement du flowType mais explicite pour clarté
   */
  @Column({
    type: 'varchar',
    length: 20,
    enum: PaymentDestination,
  })
  destination: PaymentDestination;

  /**
   * ID de l'élève (nullable, uniquement pour TUITION)
   */
  @Column({ type: 'uuid', nullable: true })
  studentId: string | null;

  @ManyToOne(() => Student, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'student_id' })
  student: Student | null;

  /**
   * ID de l'année scolaire (nullable, uniquement pour TUITION)
   */
  @Column({ type: 'uuid', nullable: true })
  academicYearId: string | null;

  /**
   * Montant du paiement
   */
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  /**
   * Devise (FCFA par défaut)
   */
  @Column({ type: 'varchar', length: 3, default: 'XOF' })
  currency: string;

  /**
   * Statut du paiement
   */
  @Column({
    type: 'varchar',
    length: 20,
    enum: PaymentFlowStatus,
    default: PaymentFlowStatus.INITIATED,
  })
  status: PaymentFlowStatus;

  /**
   * Provider de paiement (PSP)
   */
  @Column({
    type: 'varchar',
    length: 50,
    enum: PaymentServiceProvider,
  })
  psp: PaymentServiceProvider;

  /**
   * Référence du paiement côté PSP
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  pspReference: string | null;

  /**
   * URL de paiement (pour paiements en ligne)
   */
  @Column({ type: 'text', nullable: true })
  paymentUrl: string | null;

  /**
   * Lien avec le paiement existant (si TUITION)
   * Permet de lier au système de paiement scolaire existant
   */
  @Column({ type: 'uuid', nullable: true })
  paymentId: string | null;

  /**
   * Métadonnées du paiement
   * Ex: type de souscription, période, option activée, etc.
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  /**
   * Raison du paiement (pour traçabilité)
   */
  @Column({ type: 'text', nullable: true })
  reason: string | null;

  /**
   * Utilisateur qui a initié le paiement
   */
  @Column({ type: 'uuid', nullable: true })
  initiatedBy: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'initiated_by' })
  initiatedByUser: User | null;

  /**
   * Date de paiement effectif (quand status = PAID)
   */
  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  /**
   * Date d'expiration (pour paiements en ligne)
   */
  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  /**
   * Données de callback/webhook (pour audit)
   */
  @Column({ type: 'jsonb', nullable: true })
  webhookData: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

