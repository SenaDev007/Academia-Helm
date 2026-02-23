import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Country } from '../../countries/entities/country.entity';

/**
 * Tenant Entity
 * 
 * Représente une organisation/école dans la plateforme.
 * Chaque tenant est OBLIGATOIREMENT lié à un pays.
 * 
 * Architecture policy-driven :
 * - Les règles métier sont définies via les policies du pays
 * - Pas de logique métier conditionnée par country_code
 */
@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ nullable: true })
  schemaName: string;

  @Column({ type: 'uuid', name: 'countryId' })
  countryId: string; // OBLIGATOIRE : chaque école appartient à un pays

  @ManyToOne(() => Country, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'countryId' })
  country: Country;

  @Column({ default: 'active' })
  status: string;

  @Column({ default: 'free' })
  subscriptionPlan: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

