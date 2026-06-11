/**
 * ============================================================================
 * ANNOUNCEMENT ENTITY - COMMUNICATION MODULE
 * ============================================================================
 * 
 * Gestion des annonces et communications institutionnelles
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
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { SchoolLevel } from '../../school-levels/entities/school-level.entity';
import { Class } from '../../classes/entities/class.entity';

export enum AnnouncementType {
  GENERAL = 'GENERAL',           // Annonce générale
  URGENT = 'URGENT',             // Urgente
  ACADEMIC = 'ACADEMIC',         // Académique
  FINANCIAL = 'FINANCIAL',       // Financière
  EVENT = 'EVENT',               // Événement
  MAINTENANCE = 'MAINTENANCE',   // Maintenance
}

export enum AnnouncementStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED',
}

export enum AnnouncementTarget {
  ALL = 'ALL',                   // Tous
  STUDENTS = 'STUDENTS',         // Élèves uniquement
  PARENTS = 'PARENTS',           // Parents uniquement
  TEACHERS = 'TEACHERS',         // Enseignants uniquement
  STAFF = 'STAFF',               // Personnel uniquement
  SPECIFIC_CLASS = 'SPECIFIC_CLASS', // Classe spécifique
}

@Entity('announcements')
export class Announcement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'uuid' })
  schoolLevelId: string;

  @ManyToOne(() => SchoolLevel, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'school_level_id' })
  schoolLevel: SchoolLevel;

  @Column({ type: 'uuid', nullable: true })
  classId: string | null;

  @ManyToOne(() => Class, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'class_id' })
  class: Class | null;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'varchar',
    length: 50,
    enum: AnnouncementType,
    default: AnnouncementType.GENERAL,
  })
  type: AnnouncementType;

  @Column({
    type: 'varchar',
    length: 50,
    enum: AnnouncementStatus,
    default: AnnouncementStatus.DRAFT,
  })
  status: AnnouncementStatus;

  @Column({
    type: 'varchar',
    length: 50,
    enum: AnnouncementTarget,
    default: AnnouncementTarget.ALL,
  })
  target: AnnouncementTarget;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ type: 'boolean', default: false })
  isPinned: boolean;

  @Column({ type: 'boolean', default: false })
  requiresAcknowledgment: boolean;

  @Column({ type: 'jsonb', nullable: true })
  attachments: Array<{ url: string; name: string; type: string }> | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'uuid' })
  createdBy: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;
}

