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
import { Student } from '../../students/entities/student.entity';
import { FeeConfiguration } from '../../fee-configurations/entities/fee-configuration.entity';
import { SchoolLevel } from '../../school-levels/entities/school-level.entity';

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column()
  studentId: string;

  @ManyToOne(() => Student)
  @JoinColumn({ name: 'studentId' })
  student: Student;

  @Column({ type: 'uuid', nullable: false })
  schoolLevelId: string;

  @ManyToOne(() => SchoolLevel, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'school_level_id' })
  schoolLevel: SchoolLevel;

  @Column({ nullable: true })
  feeConfigurationId: string;

  @ManyToOne(() => FeeConfiguration, { nullable: true })
  @JoinColumn({ name: 'feeConfigurationId' })
  feeConfiguration: FeeConfiguration;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ nullable: true })
  paymentMethod: string;

  @Column({ type: 'date' })
  paymentDate: Date;

  @Column({ nullable: true })
  reference: string;

  @Column({ nullable: true })
  receiptNumber: string;

  @Column({ default: 'completed' })
  status: string;

  /**
   * Lien avec le flux de paiement (si paiement en ligne)
   */
  @Column({ type: 'uuid', nullable: true })
  paymentFlowId: string | null;

  @Column({ nullable: true, type: 'text' })
  notes: string;

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

