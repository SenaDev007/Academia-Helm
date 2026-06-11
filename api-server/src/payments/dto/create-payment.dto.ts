import { IsString, IsNumber, IsDateString, IsOptional, Min } from 'class-validator';

export class CreatePaymentDto {
  @IsString()
  studentId: string;

  @IsString()
  @IsOptional()
  feeConfigurationId?: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsDateString()
  paymentDate: string;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  receiptNumber?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

