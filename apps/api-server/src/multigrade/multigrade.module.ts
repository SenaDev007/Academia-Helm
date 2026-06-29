import { Module } from '@nestjs/common';
import { MultigradeController } from './multigrade.controller';
import { MultigradeService } from './multigrade.service';
import { DatabaseModule } from '../database/database.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [MultigradeController],
  providers: [MultigradeService],
  exports: [MultigradeService],
})
export class MultigradeModule {}
