import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Country Entity
 * 
 * Représente un pays dans la plateforme Academia Hub.
 * Chaque tenant (école) est lié à un pays.
 * 
 * Architecture policy-driven :
 * - Les règles métier (notes, salaires) sont définies via des policies
 * - Les policies sont liées au pays
 * - Pas de logique métier conditionnée par country_code
 * 
 * Pour cette phase : UNIQUEMENT le Bénin (BJ) avec is_default = true
 */
@Entity('countries')
export class Country {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 2, unique: true })
  code: string; // ISO 3166-1 alpha-2 (ex: 'BJ' pour Bénin)

  @Column({ type: 'varchar', length: 255 })
  name: string; // Nom complet (ex: 'Bénin')

  @Column({ type: 'varchar', length: 3, nullable: true })
  code3: string; // ISO 3166-1 alpha-3 (ex: 'BEN')

  @Column({ type: 'varchar', length: 10, nullable: true })
  numericCode: string; // Code numérique ISO (ex: '204')

  @Column({ type: 'varchar', length: 10, nullable: true })
  currencyCode: string; // Code devise ISO (ex: 'XOF')

  @Column({ type: 'varchar', length: 10, nullable: true })
  currencySymbol: string; // Symbole devise (ex: 'CFA')

  @Column({ type: 'varchar', length: 10, nullable: true })
  phonePrefix: string; // Préfixe téléphonique (ex: '+229')

  @Column({ type: 'text', nullable: true })
  flagEmoji: string; // Emoji du drapeau (ex: '🇧🇯')

  @Column({ type: 'boolean', default: false })
  isDefault: boolean; // Pays par défaut (BJ pour cette phase)

  @Column({ type: 'boolean', default: true })
  isActive: boolean; // Pays actif dans la plateforme

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>; // Métadonnées additionnelles

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

