import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentsRepository } from './payments.repository';
import { Payment } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { PaginationDto, PaginatedResponse } from '../common/dto/pagination.dto';
import { createPaginatedResponse } from '../common/helpers/pagination.helper';

@Injectable()
export class PaymentsService {
  constructor(private readonly paymentsRepository: PaymentsRepository) {}

  async create(
    createPaymentDto: CreatePaymentDto,
    tenantId: string,
    schoolLevelId: string, // OBLIGATOIRE
    createdBy?: string,
  ): Promise<Payment> {
    const { toDate } = await import('../common/helpers/date.helper');
    return this.paymentsRepository.create({
      ...createPaymentDto,
      paymentDate: createPaymentDto.paymentDate ? toDate(createPaymentDto.paymentDate) : new Date(),
      tenantId,
      schoolLevelId, // OBLIGATOIRE
      createdBy,
    });
  }

  async findAll(
    tenantId: string,
    schoolLevelId: string, // OBLIGATOIRE
    pagination: PaginationDto,
    studentId?: string,
    status?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<PaginatedResponse<Payment>> {
    const [data, total] = await Promise.all([
      this.paymentsRepository.findAll(
      tenantId,
      schoolLevelId, // OBLIGATOIRE
        pagination,
        studentId,
        status,
        startDate,
        endDate,
      ),
      this.paymentsRepository.count(
        tenantId,
        schoolLevelId,
      studentId,
      status,
      startDate,
      endDate,
      ),
    ]);
    return createPaginatedResponse(data, total, pagination);
  }

  async findOne(id: string, tenantId: string, schoolLevelId: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne(id, tenantId, schoolLevelId);
    if (!payment) {
      throw new NotFoundException(`Payment with ID ${id} not found`);
    }
    return payment;
  }

  async update(
    id: string,
    updatePaymentDto: UpdatePaymentDto,
    tenantId: string,
    schoolLevelId: string, // OBLIGATOIRE
  ): Promise<Payment> {
    await this.findOne(id, tenantId, schoolLevelId);
    const { toDate } = await import('../common/helpers/date.helper');
    const updateData: any = { ...updatePaymentDto };
    if (updatePaymentDto.paymentDate) {
      updateData.paymentDate = toDate(updatePaymentDto.paymentDate);
    }
    return this.paymentsRepository.update(id, tenantId, schoolLevelId, updateData);
  }

  async delete(id: string, tenantId: string, schoolLevelId: string): Promise<void> {
    await this.findOne(id, tenantId, schoolLevelId);
    await this.paymentsRepository.delete(id, tenantId, schoolLevelId);
  }
}

