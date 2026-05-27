import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
  AfterLoad,
} from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import { AcademicYear } from '../../academic-years/entities/academic-year.entity';
import type { SchoolLevel } from '../../school-levels/entities/school-level.entity';
import { AcademicTrack } from '../../academic-tracks/entities/academic-track.entity';

@Entity('classes')
export class Class {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenantId' })
  tenant: Tenant;

  @Column()
  name: string;

  @Column({ name: 'schoolLevelId', type: 'uuid', nullable: false })
  schoolLevelId: string;

  @ManyToOne(() => {
    const { SchoolLevel } = require('../../school-levels/entities/school-level.entity');
    return SchoolLevel;
  }, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'schoolLevelId' })
  schoolLevel: SchoolLevel;

  // Ancien champ level conservé pour compatibilité (déprécié) - virtuel
  level: string;

  @Column({ nullable: true })
  academicYearId: string;

  @ManyToOne(() => AcademicYear, { nullable: true })
  @JoinColumn({ name: 'academicYearId' })
  academicYear: AcademicYear;

  @Column({ nullable: true, type: 'int' })
  capacity: number;

  @Column({ nullable: true })
  mainTeacherId: string;

  @Column({ nullable: true })
  roomId: string;

  /**
   * Academic Track (FR/EN) - NULLABLE pour compatibilité
   * NULL = track par défaut (FR)
   * Exemples : CP1 (FR), Nursery 1 (EN)
   */
  @Column({ type: 'uuid', nullable: true })
  academicTrackId: string | null;

  @ManyToOne(() => AcademicTrack, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'academicTrackId' })
  academicTrack: AcademicTrack | null;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @BeforeInsert()
  @BeforeUpdate()
  syncFields() {
    if (this.level && !this.schoolLevelId) {
      this.schoolLevelId = this.level;
    } else if (this.schoolLevelId && !this.level) {
      this.level = this.schoolLevelId;
    }
  }

  @AfterLoad()
  populateVirtualFields() {
    this.level = this.schoolLevelId;
  }

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}


