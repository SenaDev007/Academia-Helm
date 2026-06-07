/**
 * ============================================================================
 * SCHOOL PAYMENT ACCOUNT ENTITY - COMPTES DE PAIEMENT DES ÉCOLES
 * ============================================================================
 * 
 * Chaque école peut configurer ses comptes de paiement pour recevoir
 * directement les frais de scolarité des parents.
 * 
 * PRINCIPE :
 * - Academia Hub initie les paiements
 * - Les fonds vont directement vers le compte de l'école
 * - Academia Hub ne détient jamais ces fonds
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
  Unique,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { PaymentServiceProvider } from './payment-flow.entity';

@Entity('school_payment_accounts')
@Unique(['tenantId', 'psp', 'accountIdentifier'])
export class SchoolPaymentAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

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
   * Identifiant du compte côté PSP
   * Ex: numéro de compte Fedapay, numéro Mobile Money, etc.
   */
  @Column({ type: 'varchar', length: 255 })
  accountIdentifier: string;

  /**
   * Nom du compte (pour affichage)
   */
  @Column({ type: 'varchar', length: 255 })
  accountName: string;

  /**
   * Type de compte
   */
  @Column({ type: 'varchar', length: 50, nullable: true })
  accountType: string | null; // Ex: "MOBILE_MONEY", "BANK_ACCOUNT", etc.

  /**
   * Compte vérifié et actif
   */
  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  /**
   * Date de vérification
   */
  @Column({ type: 'timestamptz', nullable: true })
  verifiedAt: Date | null;

  /**
   * Utilisateur qui a vérifié le compte
   */
  @Column({ type: 'uuid', nullable: true })
  verifiedBy: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'verified_by' })
  verifiedByUser: User | null;

  /**
   * Compte actif (peut recevoir des paiements)
   */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /**
   * Métadonnées du compte (configuration spécifique au PSP)
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  /**
   * Utilisateur qui a créé le compte
   */
  @Column({ type: 'uuid', nullable: true })
  createdBy: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

