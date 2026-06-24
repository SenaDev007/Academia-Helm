import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString } from 'class-validator';

export enum DocumentType {
  FICHE_PEDAGOGIQUE = 'FICHE_PEDAGOGIQUE',
  CAHIER_JOURNAL = 'CAHIER_JOURNAL',
  CAHIER_TEXTE = 'CAHIER_TEXTE',
  SEMAINIER = 'SEMAINIER',
}

export class CreatePedagogicalDocumentDto {
  @IsEnum(DocumentType)
  @IsNotEmpty()
  documentType: DocumentType;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsString()
  @IsOptional()
  classId?: string;

  @IsString()
  @IsOptional()
  subjectId?: string;

  @IsString()
  @IsOptional()
  teacherId?: string;

  @IsString()
  @IsOptional()
  period?: string;

  @IsDateString()
  @IsOptional()
  weekStartDate?: string;

  @IsDateString()
  @IsOptional()
  weekEndDate?: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional() @IsString() schoolLevelId?: string;

  @IsString()
  @IsNotEmpty()
  academicYearId: string;
}
