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
import { SchoolLevel } from '../../school-levels/entities/school-level.entity';

@Entity('discipline')
export class Discipline {
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

  @Column({ type: 'date' })
  incidentDate: Date;

  @Column({ nullable: true })
  severity: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ nullable: true, type: 'text' })
  actionTaken: string;

  @Column({ nullable: true })
  reportedBy: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reportedBy' })
  reporter: User;

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

