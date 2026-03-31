/**
 * ============================================================================
 * SCHOOL LEVEL ENTITY - NIVEAU SCOLAIRE STRUCTURANT
 * ============================================================================
 * 
 * Entité fondamentale pour structurer le système par niveau scolaire.
 * Chaque donnée métier (élève, classe, enseignant, opération financière)
 * DOIT être liée à un niveau scolaire explicite.
 * 
 * Niveaux :
 * - MATERNELLE
 * - PRIMAIRE
 * - SECONDAIRE
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
  OneToMany,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { Student } from '../../students/entities/student.entity';
// ✅ Import de type uniquement pour éviter la référence circulaire
import type { Class } from '../../classes/entities/class.entity';
// ✅ Import de type uniquement pour éviter la référence circulaire
import type { Teacher } from '../../teachers/entities/teacher.entity';
// ✅ Import de type uniquement pour éviter la référence circulaire
import type { Subject } from '../../subjects/entities/subject.entity';

export enum SchoolLevelType {
  MATERNELLE = 'MATERNELLE',
  PRIMAIRE = 'PRIMAIRE',
  SECONDAIRE = 'SECONDAIRE',
}

@Entity('school_levels')
export class SchoolLevel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({
    type: 'varchar',
    length: 50,
    enum: SchoolLevelType,
  })
  type: SchoolLevelType;

  @Column({ type: 'varchar', length: 255 })
  name: string; // Ex: "Maternelle", "Primaire", "Secondaire"

  @Column({ type: 'varchar', length: 50, nullable: true })
  abbreviation: string; // Ex: "MAT", "PRI", "SEC"

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'int', default: 0 })
  order: number; // Ordre d'affichage (0 = Maternelle, 1 = Primaire, 2 = Secondaire)

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null; // Configuration spécifique par niveau

  // Relations avec les entités métier
  @OneToMany(() => Student, (student) => student.schoolLevel)
  students: Student[];

  @OneToMany(() => {
    // ✅ Lazy import pour éviter la référence circulaire
    const { Class } = require('../../classes/entities/class.entity');
    return Class;
  }, (classEntity: any) => classEntity.schoolLevel)
  classes: Class[];

  @OneToMany(() => {
    // ✅ Lazy import pour éviter la référence circulaire
    const { Teacher } = require('../../teachers/entities/teacher.entity');
    return Teacher;
  }, (teacher: any) => teacher.schoolLevel)
  teachers: Teacher[];

  @OneToMany(() => {
    // ✅ Lazy import pour éviter la référence circulaire
    const { Subject } = require('../../subjects/entities/subject.entity');
    return Subject;
  }, (subject: any) => subject.schoolLevel)
  subjects: Subject[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

