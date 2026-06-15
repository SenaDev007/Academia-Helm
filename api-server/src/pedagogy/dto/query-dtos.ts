/**
 * ============================================================================
 * QUERY DTOs for Material Module Controllers
 * ============================================================================
 *
 * Extends PaginationDto with filter params for each controller's GET endpoint.
 * Required because `forbidNonWhitelisted: true` rejects any query param
 * not declared in the DTO class used with @Query().
 *
 * ============================================================================
 */

import { IsOptional, IsString, IsUUID } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

// ─── Material Movements Query ────────────────────────────────────────────────

export class MaterialMovementsQueryDto extends PaginationDto {
  @IsUUID()
  @IsOptional()
  academicYearId?: string;

  @IsUUID()
  @IsOptional()
  materialId?: string;

  @IsString()
  @IsOptional()
  movementType?: string;

  @IsUUID()
  @IsOptional()
  performedById?: string;

  /** Allow tenantId in query (set by MaterialContextGuard) */
  @IsUUID()
  @IsOptional()
  tenantId?: string;
}

// ─── Pedagogical Materials Query ─────────────────────────────────────────────

export class PedagogicalMaterialsQueryDto extends PaginationDto {
  @IsUUID()
  @IsOptional()
  schoolLevelId?: string;

  @IsUUID()
  @IsOptional()
  subjectId?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  isActive?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsUUID()
  @IsOptional()
  academicYearId?: string;

  @IsUUID()
  @IsOptional()
  tenantId?: string;
}

// ─── Material Stocks Query ───────────────────────────────────────────────────

export class MaterialStocksQueryDto extends PaginationDto {
  @IsUUID()
  @IsOptional()
  academicYearId?: string;

  @IsUUID()
  @IsOptional()
  materialId?: string;

  @IsUUID()
  @IsOptional()
  schoolLevelId?: string;

  @IsUUID()
  @IsOptional()
  classId?: string;

  @IsUUID()
  @IsOptional()
  tenantId?: string;
}

// ─── Annual Teacher Supplies Query ───────────────────────────────────────────

export class AnnualTeacherSuppliesQueryDto extends PaginationDto {
  @IsUUID()
  @IsOptional()
  academicYearId?: string;

  @IsUUID()
  @IsOptional()
  teacherId?: string;

  @IsUUID()
  @IsOptional()
  materialId?: string;

  @IsUUID()
  @IsOptional()
  schoolLevelId?: string;

  @IsUUID()
  @IsOptional()
  classId?: string;

  @IsUUID()
  @IsOptional()
  tenantId?: string;
}

// ─── Teacher Material Assignments Query ──────────────────────────────────────

export class TeacherMaterialAssignmentsQueryDto extends PaginationDto {
  @IsUUID()
  @IsOptional()
  academicYearId?: string;

  @IsUUID()
  @IsOptional()
  teacherId?: string;

  @IsUUID()
  @IsOptional()
  materialId?: string;

  @IsUUID()
  @IsOptional()
  schoolLevelId?: string;

  @IsUUID()
  @IsOptional()
  classId?: string;

  @IsString()
  @IsOptional()
  signed?: string;

  @IsUUID()
  @IsOptional()
  tenantId?: string;
}
