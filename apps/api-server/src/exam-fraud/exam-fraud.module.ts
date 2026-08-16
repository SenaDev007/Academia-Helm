import { Module } from '@nestjs/common';
import { ExamFraudController } from './exam-fraud.controller';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ExamFraudController],
})
export class ExamFraudModule {}
