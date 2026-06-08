import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Country } from '../../countries/entities/country.entity';

/**
 * GradingPolicy Entity
 * 
 * Définit les règles de notation pour un pays.
 * Architecture policy-driven : les règles métier sont dans la policy, pas dans le code.
 * 
 * Pour cette phase : UNIQUEMENT la policy béninoise (BJ)
 * 
 * Exemple de policy BJ :
 * - Système de notes sur 20
 * - Mentions : Excellent (18-20), Très Bien (16-17.99), Bien (14-15.99), etc.
 * - Calcul des moyennes avec coefficients
 * - Génération de bulletins conforme aux pratiques locales
 */
@Entity('grading_policies')
export class GradingPolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  countryId: string; // UN SEUL pays pour cette phase : BJ

  @ManyToOne(() => Country, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'country_id' })
  country: Country;

  @Column({ type: 'varchar', length: 100 })
  name: string; // Ex: "Système de notation béninois"

  @Column({ type: 'varchar', length: 50 })
  educationLevel: string; // 'preschool', 'primary', 'secondary', 'university'

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  maxScore: number; // Score maximum (ex: 20 pour le système béninois)

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  passingScore: number; // Score de passage (ex: 10)

  @Column({ type: 'jsonb' })
  gradeScales: {
    // Échelles de notes avec mentions
    // Ex: [{ min: 18, max: 20, mention: 'Excellent' }, ...]
    min: number;
    max: number;
    mention: string;
    emoji?: string;
    observation?: string;
    recommendation?: string;
  }[];

  @Column({ type: 'jsonb', nullable: true })
  calculationRules: {
    // Règles de calcul des moyennes
    useCoefficients: boolean;
    roundingMethod: 'floor' | 'ceil' | 'round';
    decimalPlaces: number;
    // Autres règles spécifiques au pays
  };

  @Column({ type: 'jsonb', nullable: true })
  reportCardConfig: {
    // Configuration pour la génération de bulletins
    template: string;
    includeRanking: boolean;
    includeClassAverage: boolean;
    includeComments: boolean;
    // Autres configurations
  };

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isDefault: boolean; // Policy par défaut pour ce pays

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

