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
import { Subject } from '../../subjects/entities/subject.entity';
import { Class } from '../../classes/entities/class.entity';
import { AcademicYear } from '../../academic-years/entities/academic-year.entity';
import { Quarter } from '../../quarters/entities/quarter.entity';
import { SchoolLevel } from '../../school-levels/entities/school-level.entity';
import { AcademicTrack } from '../../academic-tracks/entities/academic-track.entity';

@Entity('exams')
export class Exam {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column()
  name: string;

  @Column({ type: 'uuid', nullable: false })
  schoolLevelId: string;

  @ManyToOne(() => SchoolLevel, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'school_level_id' })
  schoolLevel: SchoolLevel;

  @Column({ nullable: true })
  examType: string;

  @Column({ nullable: true })
  subjectId: string;

  @ManyToOne(() => Subject, { nullable: true })
  @JoinColumn({ name: 'subjectId' })
  subject: Subject;

  @Column({ nullable: true })
  classId: string;

  @ManyToOne(() => Class, { nullable: true })
  @JoinColumn({ name: 'classId' })
  class: Class;

  @Column({ nullable: true })
  academicYearId: string;

  @ManyToOne(() => AcademicYear, { nullable: true })
  @JoinColumn({ name: 'academicYearId' })
  academicYear: AcademicYear;

  @Column({ nullable: true })
  quarterId: string;

  @ManyToOne(() => Quarter, { nullable: true })
  @JoinColumn({ name: 'quarterId' })
  quarter: Quarter;

  @Column({ nullable: true, type: 'date' })
  examDate: Date;

  @Column({ nullable: true, type: 'decimal', precision: 5, scale: 2 })
  maxScore: number;

  /**
   * Academic Track (FR/EN) - NULLABLE pour compatibilité
   * NULL = track par défaut (FR)
   * OBLIGATOIRE pour les nouveaux examens dans un contexte bilingue
   */
  @Column({ type: 'uuid', nullable: true })
  academicTrackId: string | null;

  @ManyToOne(() => AcademicTrack, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'academic_track_id' })
  academicTrack: AcademicTrack | null;

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

