/**
 * ============================================================================
 * SUBJECT ENTITY (STUB) — Preserve TypeORM compatibility
 * ============================================================================
 *
 * ⚠️ Phase 6 — Le module SubjectsModule legacy a été supprimé (remplacé par
 * SubjectsPrismaController dans PedagogyModule). Cette entité TypeORM est
 * conservée comme stub pour préserver la compatibilité des relations
 * @ManyToOne dans teacher.entity.ts et school-level.entity.ts.
 *
 * La source de vérité pour les matières est désormais le modèle Prisma
 * `Subject` (voir prisma/schema.prisma ligne 2452).
 * ============================================================================
 */

import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('subjects')
export class Subject {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  tenantId: string;

  @Column({ type: 'text', nullable: true })
  academicYearId: string;

  @Column({ type: 'text' })
  schoolLevelId: string;

  @Column({ type: 'text', nullable: true })
  academicTrackId: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  abbreviation: string;

  @Column({ type: 'text' })
  code: string;

  @Column({ type: 'float', default: 1.0 })
  coefficient: number;

  @Column({ type: 'text', nullable: true })
  language: string;

  @Column({ type: 'int', nullable: true, default: 0 })
  weeklyHours: number;

  @Column({ type: 'text', nullable: true })
  description: string;
}
