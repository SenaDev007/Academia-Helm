import { IsOptional, IsString, IsDateString } from 'class-validator';

export class CommunicationDashboardQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  academicYearId?: string;
}
