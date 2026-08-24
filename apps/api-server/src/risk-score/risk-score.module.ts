import { Module } from '@nestjs/common';
import { RiskScoreController } from './risk-score.controller';
import { DropoutIndicatorController } from './dropout-indicator.controller';
import { RiskScoreCalculatorService } from './risk-score-calculator.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [RiskScoreController, DropoutIndicatorController],
  providers: [RiskScoreCalculatorService],
  exports: [RiskScoreCalculatorService],
})
export class RiskScoreModule {}
