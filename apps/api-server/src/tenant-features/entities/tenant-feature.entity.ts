/**
 * ============================================================================
 * TENANT FEATURE ENTITY - GESTION DES FONCTIONNALITÉS PAR TENANT
 * ============================================================================
 * 
 * Système de feature flags par tenant pour activer/désactiver
 * des fonctionnalités optionnelles (ex: BILINGUAL_TRACK).
 * 
 * PRINCIPE :
 * - Chaque tenant peut activer/désactiver des features
 * - Impact sur le pricing et la facturation
 * - Audit complet des changements
 * - Extensible pour futures features
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

/**
 * Codes des features disponibles
 */
export enum FeatureCode {
  BILINGUAL_TRACK = 'BILINGUAL_TRACK', // Option bilingue FR/EN
  // Extensible : CAMBRIDGE_CURRICULUM, IB_PROGRAM, etc.
}

/**
 * Statut d'une feature
 */
export enum FeatureStatus {
  DISABLED = 'DISABLED', // Désactivée
  ENABLED = 'ENABLED',   // Activée
  PENDING = 'PENDING',   // En attente de validation
}

@Entity('tenant_features')
@Unique(['tenantId', 'featureCode'])
export class TenantFeature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenantId' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  /**
   * Code de la feature (BILINGUAL_TRACK, etc.)
   */
  @Column({
    type: 'varchar',
    length: 50,
    name: 'featureCode',
  })
  featureCode: FeatureCode;

  /**
   * Statut de la feature
   */
  @Column({
    type: 'varchar',
    length: 20,
    name: 'status',
    default: FeatureStatus.DISABLED,
  })
  status: FeatureStatus;

  /**
   * Date d'activation (si activée)
   */
  @Column({ type: 'timestamptz', nullable: true, name: 'enabledAt' })
  enabledAt: Date | null;

  /**
   * Utilisateur qui a activé la feature
   */
  @Column({ type: 'uuid', nullable: true, name: 'enabledBy' })
  enabledBy: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'enabledBy' })
  enabledByUser: User | null;

  /**
   * Date de désactivation (si désactivée)
   */
  @Column({ type: 'timestamptz', nullable: true, name: 'disabledAt' })
  disabledAt: Date | null;

  /**
   * Utilisateur qui a désactivé la feature
   */
  @Column({ type: 'uuid', nullable: true, name: 'disabledBy' })
  disabledBy: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'disabledBy' })
  disabledByUser: User | null;

  /**
   * Métadonnées optionnelles (configuration spécifique)
   * Ex: pour BILINGUAL_TRACK, stocker les tracks activés
   */
  @Column({ type: 'jsonb', nullable: true, name: 'metadata' })
  metadata: Record<string, any> | null;

  /**
   * Raison de l'activation/désactivation (pour audit)
   */
  @Column({ type: 'text', nullable: true, name: 'reason' })
  reason: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updatedAt' })
  updatedAt: Date;
}

