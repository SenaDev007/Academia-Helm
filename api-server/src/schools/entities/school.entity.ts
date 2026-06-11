import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';

@Entity('schools')
export class School {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column()
  name: string;

  @Column({ nullable: true })
  abbreviation: string;

  @Column({ type: 'simple-array', nullable: true })
  educationLevels: string[];

  @Column({ nullable: true, type: 'text' })
  motto: string;

  @Column({ nullable: true, type: 'text' })
  slogan: string;

  @Column({ nullable: true, type: 'text' })
  address: string;

  @Column({ nullable: true })
  primaryPhone: string;

  @Column({ nullable: true })
  secondaryPhone: string;

  @Column({ nullable: true })
  primaryEmail: string;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true })
  whatsapp: string;

  @Column({ nullable: true, type: 'text' })
  logo: string;

  @Column({ default: '#3b82f6' })
  primaryColor: string;

  @Column({ default: '#10b981' })
  secondaryColor: string;

  @Column({ nullable: true })
  founderName: string;

  @Column({ nullable: true })
  directorPrimary: string;

  @Column({ nullable: true })
  directorSecondary: string;

  @Column({ nullable: true })
  createdBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'createdBy' })
  creator: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

