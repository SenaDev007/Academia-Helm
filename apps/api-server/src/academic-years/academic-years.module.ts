import { Module } from '@nestjs/common';
import { AcademicYearsController } from './academic-years.controller';
import { AcademicYearsService } from './academic-years.service';
import { AcademicYearsRepository } from './academic-years.repository';
import { DatabaseModule } from '../database/database.module';
import { CommunicationModule } from '../communication/communication.module';
import { AcademicYearCalculatorService } from './academic-year-calculator.service';
import { AcademicYearsPrismaService } from './academic-years-prisma.service';
import { AcademicYearRolloverService } from './academic-year-rollover.service';

@Module({
  imports: [
    DatabaseModule, // Pour PrismaService
    CommunicationModule, // Pour EmailService (notifications de rollover)
  ],
  controllers: [AcademicYearsController],
  providers: [
    AcademicYearsService,
    AcademicYearsRepository,
    AcademicYearCalculatorService,
    AcademicYearsPrismaService,
    // Cron job d'auto-rollover des années scolaires (tourne chaque jour à 2h00)
    AcademicYearRolloverService,
  ],
  exports: [
    AcademicYearsService,
    AcademicYearsPrismaService,
    AcademicYearCalculatorService,
    AcademicYearRolloverService,
  ],
})
export class AcademicYearsModule {}


