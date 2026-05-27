/**
 * ============================================================================
 * MODULE ENTITY - MODULES FONCTIONNELS INDÉPENDANTS
 * ============================================================================
 * 
 * Entité pour structurer Academia Hub en modules indépendants.
 * Chaque module est associé à un tenant et peut être activé/désactivé
 * par niveau scolaire.
 * 
 * Modules Principaux :
 * - SCOLARITE : Gestion des élèves et inscriptions
 * - FINANCES : Gestion financière et comptabilité
 * - RH : Gestion du personnel et ressources humaines
 * - PEDAGOGIE : Études, planification et emplois du temps
 * - EXAMENS : Examens, notes et bulletins
 * - COMMUNICATION : SMS, emails et notifications
 * 
 * Modules Supplémentaires :
 * - BIBLIOTHEQUE : Gestion du catalogue et prêts de livres
 * - LABORATOIRE : Gestion des équipements et réservations
 * - TRANSPORT : Gestion des véhicules et itinéraires
 * - CANTINE : Gestion des repas et menus
 * - INFIRMERIE : Dossiers médicaux et visites
 * - QHSE : Qualité, Hygiène, Sécurité et Environnement
 * - EDUCAST : Diffusion de contenu éducatif
 * - BOUTIQUE : Vente de fournitures scolaires
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
  Index,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { SchoolLevel } from '../../school-levels/entities/school-level.entity';

export enum ModuleType {
  // Modules principaux
  SCOLARITE = 'SCOLARITE',
  FINANCES = 'FINANCES',
  RH = 'RH',
  PEDAGOGIE = 'PEDAGOGIE',
  EXAMENS = 'EXAMENS',
  COMMUNICATION = 'COMMUNICATION',
  // Modules supplémentaires
  BIBLIOTHEQUE = 'BIBLIOTHEQUE',
  LABORATOIRE = 'LABORATOIRE',
  TRANSPORT = 'TRANSPORT',
  CANTINE = 'CANTINE',
  INFIRMERIE = 'INFIRMERIE',
  QHSE = 'QHSE',
  EDUCAST = 'EDUCAST',
  BOUTIQUE = 'BOUTIQUE',
}

export enum ModuleStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance',
}

@Entity('modules')
@Index(['tenantId', 'type', 'schoolLevelId'], { unique: true })
export class Module {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({
    type: 'varchar',
    length: 50,
    enum: ModuleType,
  })
  type: ModuleType;

  @Column({ type: 'varchar', length: 255 })
  name: string; // Ex: "Scolarité", "Finances", "RH", etc.

  @Column({ type: 'varchar', length: 100, nullable: true })
  code: string; // Ex: "scolarite", "finances", "rh", etc.

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'uuid', nullable: false })
  schoolLevelId: string;

  @ManyToOne(() => SchoolLevel, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'schoolLevelId' })
  schoolLevel: SchoolLevel;

  @Column({
    type: 'varchar',
    length: 20,
    enum: ModuleStatus,
    default: ModuleStatus.ACTIVE,
  })
  status: ModuleStatus;

  @Column({ type: 'boolean', default: true })
  isEnabled: boolean; // Activation/désactivation du module

  @Column({ type: 'jsonb', default: '{}' })
  configuration: Record<string, any>; // Configuration spécifique du module

  @Column({ type: 'jsonb', default: '[]' })
  permissions: string[]; // Permissions requises pour accéder au module

  @Column({ type: 'jsonb', default: '[]' })
  dependencies: string[]; // Modules dont ce module dépend (ex: ['FINANCES'])

  @Column({ type: 'int', default: 0 })
  order: number; // Ordre d'affichage dans la sidebar

  @Column({ type: 'varchar', length: 255, nullable: true })
  route: string; // Route frontend (ex: '/dashboard/students')

  @Column({ type: 'varchar', length: 100, nullable: true })
  icon: string; // Nom de l'icône (ex: 'Users', 'Calculator')

  @CreateDateColumn({ type: 'timestamptz', name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updatedAt' })
  updatedAt: Date;
}

