import { Module } from '@nestjs/common';
import { AcademicYearsController } from './academic-years.controller';
import { AcademicYearsService } from './academic-years.service';
import { AcademicYearsRepository } from './academic-years.repository';
import { DatabaseModule } from '../database/database.module';
import { AcademicYearCalculatorService } from './academic-year-calculator.service';
import { AcademicYearsPrismaService } from './academic-years-prisma.service';

@Module({
  imports: [
    DatabaseModule, // Pour PrismaService
  ],
  controllers: [AcademicYearsController],
  providers: [
    AcademicYearsService,
    AcademicYearsRepository,
    AcademicYearCalculatorService,
    AcademicYearsPrismaService,
  ],
  exports: [
    AcademicYearsService,
    AcademicYearsPrismaService,
    AcademicYearCalculatorService,
  ],
})
export class AcademicYearsModule {}

