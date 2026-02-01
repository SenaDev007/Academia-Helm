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
// ✅ Import de type uniquement pour éviter la référence circulaire
import type { Department } from '../../departments/entities/department.entity';
import { Subject } from '../../subjects/entities/subject.entity';
import { AcademicYear } from '../../academic-years/entities/academic-year.entity';
// ✅ Import de type uniquement pour éviter la référence circulaire
import type { SchoolLevel } from '../../school-levels/entities/school-level.entity';

@Entity('teachers')
export class Teacher {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column({ type: 'uuid', nullable: false })
  schoolLevelId: string;

  @ManyToOne(() => {
    // ✅ Lazy import pour éviter la référence circulaire
    const { SchoolLevel } = require('../../school-levels/entities/school-level.entity');
    return SchoolLevel;
  }, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'school_level_id' })
  schoolLevel: SchoolLevel;

  @Column()
  matricule: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  gender: string;

  @Column({ nullable: true, type: 'date' })
  dateOfBirth: Date;

  @Column({ nullable: true, type: 'text' })
  address: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  departmentId: string;

  @ManyToOne(() => {
    // ✅ Lazy import pour éviter la référence circulaire
    const { Department } = require('../../departments/entities/department.entity');
    return Department;
  }, { nullable: true })
  @JoinColumn({ name: 'departmentId' })
  department: Department;

  @Column({ nullable: true })
  position: string;

  @Column({ nullable: true, type: 'text' })
  specialization: string;

  @Column({ nullable: true })
  subjectId: string;

  @ManyToOne(() => Subject, { nullable: true })
  @JoinColumn({ name: 'subjectId' })
  subject: Subject;

  @Column({ nullable: true })
  academicYearId: string;

  @ManyToOne(() => AcademicYear, { nullable: true })
  @JoinColumn({ name: 'academicYearId' })
  academicYear: AcademicYear;

  @Column({ nullable: true, type: 'date' })
  hireDate: Date;

  @Column({ nullable: true })
  contractType: string;

  @Column({ default: 'active' })
  status: string;

  @Column({ nullable: true, type: 'int' })
  workingHours: number;

  @Column({ nullable: true, type: 'decimal', precision: 10, scale: 2 })
  salary: number;

  @Column({ nullable: true, type: 'text' })
  bankDetails: string;

  @Column({ nullable: true, type: 'text' })
  emergencyContact: string;

  @Column({ nullable: true, type: 'text' })
  qualifications: string;

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

