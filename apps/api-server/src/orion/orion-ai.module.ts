import { Module } from '@nestjs/common';
import { OrionAiController } from './orion-ai.controller';
import { OrionAiService } from './orion-ai.service';
import { OrionModuleScanner } from './services/orion-module-scanner.service';
import { PrismaModule } from '../database/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [OrionAiController],
  providers: [OrionAiService, OrionModuleScanner],
  exports: [OrionAiService, OrionModuleScanner],
})
export class OrionAiModule {}
