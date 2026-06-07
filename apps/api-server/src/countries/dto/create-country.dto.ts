import { IsString, IsOptional, IsBoolean, IsObject, Length, Matches } from 'class-validator';

export class CreateCountryDto {
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/, { message: 'Code must be 2 uppercase letters (ISO 3166-1 alpha-2)' })
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  code3?: string;

  @IsOptional()
  @IsString()
  numericCode?: string;

  @IsOptional()
  @IsString()
  currencyCode?: string;

  @IsOptional()
  @IsString()
  currencySymbol?: string;

  @IsOptional()
  @IsString()
  phonePrefix?: string;

  @IsOptional()
  @IsString()
  flagEmoji?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

