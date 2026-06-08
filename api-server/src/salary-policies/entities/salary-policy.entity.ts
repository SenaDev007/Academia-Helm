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
 * SalaryPolicy Entity
 * 
 * Définit les règles de paie/salaires pour un pays.
 * Architecture policy-driven : les règles métier sont dans la policy, pas dans le code.
 * 
 * Pour cette phase : UNIQUEMENT la policy béninoise (BJ)
 * 
 * Exemple de policy BJ :
 * - Structure salariale béninoise
 * - Calcul des cotisations sociales
 * - Gestion des congés selon la législation locale
 * - Primes et avantages spécifiques
 */
@Entity('salary_policies')
export class SalaryPolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  countryId: string; // UN SEUL pays pour cette phase : BJ

  @ManyToOne(() => Country, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'country_id' })
  country: Country;

  @Column({ type: 'varchar', length: 100 })
  name: string; // Ex: "Politique salariale béninoise"

  @Column({ type: 'jsonb' })
  salaryStructure: {
    // Structure salariale
    baseSalary: {
      min: number;
      max: number;
      currency: string;
    };
    // Échelles salariales par catégorie
    scales: {
      category: string;
      min: number;
      max: number;
      steps: number;
    }[];
  };

  @Column({ type: 'jsonb' })
  socialContributions: {
    // Cotisations sociales selon la législation du pays
    employeeRate: number; // Taux employé (ex: 0.04 = 4%)
    employerRate: number; // Taux employeur (ex: 0.08 = 8%)
    contributions: {
      name: string;
      employeeRate: number;
      employerRate: number;
      description: string;
    }[];
  };

  @Column({ type: 'jsonb', nullable: true })
  leaveRules: {
    // Règles de congés selon la législation
    annualLeave: {
      daysPerYear: number;
      accrualRate: number;
      maxAccumulation: number;
    };
    sickLeave: {
      daysPerYear: number;
      requiresMedicalCertificate: boolean;
    };
    maternityLeave: {
      days: number;
      paidPercentage: number;
    };
    paternityLeave: {
      days: number;
      paidPercentage: number;
    };
  };

  @Column({ type: 'jsonb', nullable: true })
  bonuses: {
    // Primes et avantages
    types: {
      name: string;
      calculationMethod: 'fixed' | 'percentage' | 'custom';
      value: number;
      conditions: string[];
    }[];
  };

  @Column({ type: 'jsonb', nullable: true })
  taxRules: {
    // Règles fiscales
    taxBrackets: {
      min: number;
      max: number;
      rate: number;
    }[];
    exemptions: {
      type: string;
      amount: number;
      description: string;
    }[];
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

