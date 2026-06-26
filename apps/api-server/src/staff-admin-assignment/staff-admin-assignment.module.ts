import { Module } from '@nestjs/common';
import { StaffAdminAssignmentController } from './staff-admin-assignment.controller';
import { StaffAdminAssignmentService } from './staff-admin-assignment.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { AdminStructureModule } from '../admin-structure/admin-structure.module';

@Module({
  imports: [DatabaseModule, AuthModule, AdminStructureModule],
  controllers: [StaffAdminAssignmentController],
  providers: [StaffAdminAssignmentService],
  exports: [StaffAdminAssignmentService],
})
export class StaffAdminAssignmentModule {}
