import { IsEnum, IsString, IsOptional, IsBoolean, IsObject } from 'class-validator';
import { PaymentServiceProvider } from '../entities/payment-flow.entity';

export class CreateSchoolPaymentAccountDto {
  @IsEnum(PaymentServiceProvider)
  psp: PaymentServiceProvider;

  @IsString()
  accountIdentifier: string;

  @IsString()
  accountName: string;

  @IsString()
  @IsOptional()
  accountType?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;
}

