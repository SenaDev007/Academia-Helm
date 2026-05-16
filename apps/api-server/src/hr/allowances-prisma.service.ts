/**
 * ============================================================================
 * ALLOWANCES PRISMA SERVICE - MODULE 5
 * ============================================================================
 * 
 * Service pour la gestion des indemnités et primes
 * 
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AllowancesPrismaService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // ALLOWANCE TYPES (Templates)
  // ============================================================================

  async createAllowanceType(data: {
    tenantId: string;
    name: string;
    code: string;
    description?: string;
    isTaxable?: boolean;
    isCnss?: boolean;
    amount?: number;
    isFixed?: boolean;
  }) {
    return this.prisma.allowanceType.create({
      data,
    });
  }

  async findAllAllowanceTypes(tenantId: string) {
    return this.prisma.allowanceType.findMany({
      where: { tenantId },
    });
  }

  // ============================================================================
  // STAFF ALLOWANCES (Assignments)
  // ============================================================================

  async assignAllowanceToStaff(data: {
    tenantId: string;
    staffId: string;
    allowanceTypeId: string;
    amount: number;
  }) {
    return this.prisma.staffAllowance.create({
      data: {
        ...data,
        status: 'ACTIVE',
      },
    });
  }

  async findStaffAllowances(staffId: string, tenantId: string) {
    return this.prisma.staffAllowance.findMany({
      where: { staffId, tenantId, status: 'ACTIVE' },
      include: {
        type: true,
      },
    });
  }

  async updateStaffAllowance(id: string, tenantId: string, data: any) {
    return this.prisma.staffAllowance.update({
      where: { id },
      data,
    });
  }

  async removeStaffAllowance(id: string, tenantId: string) {
    return this.prisma.staffAllowance.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
  }
}
