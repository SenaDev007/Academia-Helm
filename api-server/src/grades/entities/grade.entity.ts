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
import { Exam } from '../../exams/entities/exam.entity';
import { Subject } from '../../subjects/entities/subject.entity';
import { Class } from '../../classes/entities/class.entity';
import { AcademicYear } from '../../academic-years/entities/academic-year.entity';
import { Quarter } from '../../quarters/entities/quarter.entity';
import { SchoolLevel } from '../../school-levels/entities/school-level.entity';
import { AcademicTrack } from '../../academic-tracks/entities/academic-track.entity';

@Entity('grades')
export class Grade {
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
  examId: string;

  @ManyToOne(() => Exam, { nullable: true })
  @JoinColumn({ name: 'examId' })
  exam: Exam;

  @Column()
  subjectId: string;

  @ManyToOne(() => Subject)
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

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  score: number;

  @Column({ nullable: true, type: 'decimal', precision: 5, scale: 2 })
  maxScore: number;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 1.0 })
  coefficient: number;

  /**
   * Academic Track (FR/EN) - NULLABLE pour compatibilité
   * NULL = track par défaut (FR)
   * Hérite généralement du track de l'examen ou de la matière
   */
  @Column({ type: 'uuid', nullable: true })
  academicTrackId: string | null;

  @ManyToOne(() => AcademicTrack, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'academic_track_id' })
  academicTrack: AcademicTrack | null;

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

