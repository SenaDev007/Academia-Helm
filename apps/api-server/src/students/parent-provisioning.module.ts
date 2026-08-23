/**
 * ============================================================================
 * PARENT PROVISIONING MODULE — minimal module to break circular dependency
 * ============================================================================
 *
 * ⭐ Why this module exists:
 * `ParentUserProvisioningService` is needed by both `CommunicationModule`
 * (for the chat with parents flow) and `FinanceModule` (for the receipt
 * + recovery notifications). Both modules need to import the module that
 * provides this service.
 *
 * However, putting it inside `StudentsModule` creates a circular import:
 *   - StudentsModule imports CommunicationModule (for AdmissionNotificationService)
 *   - CommunicationModule imports StudentsModule (for ParentUserProvisioningService)
 *   → NestJS throws "Cannot access 'X' before initialization" on startup
 *
 * This dedicated module breaks the cycle: it has NO imports other than
 * `DatabaseModule` (which provides `PrismaService`). Both CommunicationModule
 * and FinanceModule can safely import this module without creating cycles.
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { ParentUserProvisioningService } from './services/parent-user-provisioning.service';

@Module({
  imports: [DatabaseModule],
  providers: [ParentUserProvisioningService],
  exports: [ParentUserProvisioningService],
})
export class ParentProvisioningModule {}
