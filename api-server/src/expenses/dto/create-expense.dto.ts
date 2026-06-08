import { IsString, IsNumber, IsDateString, IsOptional, Min } from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  category: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsDateString()
  expenseDate: string;

  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  attachmentUrl?: string;
}

