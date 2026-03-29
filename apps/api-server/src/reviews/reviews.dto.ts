import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateReviewDto {
  @IsString()
  @IsNotEmpty()
  authorName!: string;

  @IsOptional()
  @IsString()
  authorRole?: string;

  @IsString()
  @IsNotEmpty()
  schoolName!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsString()
  @IsNotEmpty()
  comment!: string;

  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class UpdateReviewStatusDto {
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'ARCHIVED'])
  status!: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';

  @IsOptional()
  @IsBoolean()
  featured?: boolean;
}
