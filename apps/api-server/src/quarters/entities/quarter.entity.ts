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
import { AcademicYear } from '../../academic-years/entities/academic-year.entity';

@Entity('quarters')
export class Quarter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column()
  academicYearId: string;

  @ManyToOne(() => AcademicYear, (academicYear) => academicYear.quarters)
  @JoinColumn({ name: 'academicYearId' })
  academicYear: AcademicYear;

  @Column()
  name: string;

  @Column()
  number: number;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;

  @Column({ default: false })
  isCurrent: boolean;

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

