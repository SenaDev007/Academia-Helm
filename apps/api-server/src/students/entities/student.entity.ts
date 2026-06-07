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
import { SchoolLevel } from '../../school-levels/entities/school-level.entity';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ type: 'uuid', nullable: false })
  schoolLevelId: string;

  @ManyToOne(() => SchoolLevel, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'schoolLevelId' })
  schoolLevel: SchoolLevel;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true, type: 'timestamp' })
  dateOfBirth: Date;

  @Column({ nullable: true })
  gender: string;

  email?: string; // Non mappé en base

  phone?: string; // Non mappé en base

  address?: string; // Non mappé en base

  createdBy?: string; // Non mappé en base

  @CreateDateColumn({ type: 'timestamp', name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updatedAt' })
  updatedAt: Date;
}
