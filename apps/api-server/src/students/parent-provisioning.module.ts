/**
 * ============================================================================
 * PARENT PROVISIONING MODULE
 * ============================================================================
 *
 * ⭐ Why this module exists (circular dependency breaker):
 *
 * Before this module was introduced, ParentUserProvisioningService was
 * registered in StudentsModule. But:
 *   - CommunicationModule needed ParentUserProvisioningService → imported
 *     StudentsModule
 *   - StudentsModule already imported CommunicationModule (for
 *     AdmissionNotificationService)
 *   → circular import: CommunicationModule ↔ StudentsModule
 *
 * The circular import caused Node.js to crash at startup:
 *   "ReferenceError: Cannot access 'CommunicationModule' before
 *    initialization"
 *   (see Railway logs 2026-08-23T17:49Z)
 *
 * Fix: extract ParentUserProvisioningService into its own small module
 * that depends ONLY on DatabaseModule (for PrismaService). Both
 * CommunicationModule and FinanceModule import this small module instead
 * of StudentsModule — no cycle.
 *
 * ParentUserProvisioningService itself only needs PrismaService (no other
 * dependency), so this module is self-contained.
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
