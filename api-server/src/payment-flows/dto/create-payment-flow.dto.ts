import { IsEnum, IsNumber, IsString, IsOptional, IsUUID, Min, IsObject } from 'class-validator';
import { PaymentFlowType, PaymentServiceProvider } from '../entities/payment-flow.entity';

export class CreatePaymentFlowDto {
  @IsEnum(PaymentFlowType)
  flowType: PaymentFlowType;

  @IsUUID()
  @IsOptional()
  studentId?: string;

  @IsUUID()
  @IsOptional()
  academicYearId?: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsEnum(PaymentServiceProvider)
  psp: PaymentServiceProvider;

  @IsString()
  @IsOptional()
  reason?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsUUID()
  @IsOptional()
  paymentId?: string; // Pour lier au paiement scolaire existant
}

