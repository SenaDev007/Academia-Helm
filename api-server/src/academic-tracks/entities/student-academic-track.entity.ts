/**
 * ============================================================================
 * STUDENT ACADEMIC TRACK ENTITY - LIAISON ÉLÈVE / TRACK
 * ============================================================================
 * 
 * Table de liaison pour gérer les élèves bilingues.
 * 
 * PRINCIPE :
 * - Un élève peut appartenir à plusieurs tracks (bilingue)
 * - Un élève peut n'appartenir qu'à un seul track (monolingue)
 * - Si un élève n'a AUCUNE entrée dans cette table :
 *   → Il appartient implicitement au track par défaut (FR)
 * 
 * Cette table est OPTIONNELLE :
 * - Les élèves non bilingues n'ont pas besoin d'entrée
 * - Le système fonctionne avec les données existantes
 * 
 * ============================================================================
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Student } from '../../students/entities/student.entity';
import { AcademicTrack } from './academic-track.entity';

@Entity('student_academic_tracks')
@Unique(['studentId', 'academicTrackId'])
export class StudentAcademicTrack {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  studentId: string;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ type: 'uuid' })
  academicTrackId: string;

  @ManyToOne(() => AcademicTrack, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'academic_track_id' })
  academicTrack: AcademicTrack;

  /**
   * Date d'inscription dans ce track
   */
  @Column({ type: 'date', nullable: true })
  enrollmentDate: Date | null;

  /**
   * Date de sortie du track (si l'élève change de track)
   */
  @Column({ type: 'date', nullable: true })
  exitDate: Date | null;

  /**
   * Actif ou non
   */
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

