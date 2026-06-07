/**
 * ============================================================================
 * ACADEMIC TRACK ENTITY - PISTE ACADÉMIQUE
 * ============================================================================
 * 
 * Concept fondamental pour gérer les écoles bilingues (FR/EN)
 * et futures pistes académiques (Cambridge, IB, Montessori, etc.)
 * 
 * PRINCIPE :
 * - Un Academic Track n'est PAS une duplication d'école
 * - Un Academic Track n'est PAS une duplication d'élèves
 * - C'est une dimension pédagogique qui sépare :
 *   - Les matières
 *   - Les examens
 *   - Les notes
 *   - Les moyennes
 *   - Les bulletins
 *   - Les statistiques
 * 
 * Les élèves restent les MÊMES.
 * Les établissements restent les MÊMES.
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
  OneToMany,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';

/**
 * Codes standardisés des Academic Tracks
 * 
 * FR = Francophone (par défaut, toujours présent)
 * EN = Anglophone (optionnel)
 * 
 * Extensible pour : CAMBRIDGE, IB, MONTESSORI, etc.
 */
export enum AcademicTrackCode {
  FR = 'FR', // Francophone (par défaut)
  EN = 'EN', // Anglophone
}

@Entity('academic_tracks')
export class AcademicTrack {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  /**
   * Code unique du track (FR, EN, etc.)
   * Contrainte : unique par tenant
   */
  @Column({
    type: 'varchar',
    length: 20,
    enum: AcademicTrackCode,
  })
  code: AcademicTrackCode;

  /**
   * Nom affiché (ex: "Francophone", "Anglophone")
   */
  @Column({ type: 'varchar', length: 255 })
  name: string;

  /**
   * Description optionnelle
   */
  @Column({ type: 'text', nullable: true })
  description: string | null;

  /**
   * Ordre d'affichage (0 = FR par défaut, 1 = EN, etc.)
   */
  @Column({ type: 'int', default: 0 })
  order: number;

  /**
   * Actif ou non
   * Le track FR doit toujours être actif
   */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  /**
   * Indique si c'est le track par défaut pour ce tenant
   * Un seul track par défaut par tenant (généralement FR)
   */
  @Column({ type: 'boolean', default: false })
  isDefault: boolean;

  /**
   * Métadonnées optionnelles (configuration spécifique)
   * Ex: niveaux EN (Nursery, Primary, Secondary)
   */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

