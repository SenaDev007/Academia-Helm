import { IsNotEmpty, IsUUID } from 'class-validator';

export class DuplicateStructureDto {
  @IsUUID('4')
  @IsNotEmpty()
  fromAcademicYearId!: string;

  @IsUUID('4')
  @IsNotEmpty()
  toAcademicYearId!: string;
}
