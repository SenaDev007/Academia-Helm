import { Module } from '@nestjs/common';
import { ParentPortalController } from './parent-portal.controller';

@Module({
  controllers: [ParentPortalController],
})
export class ParentPortalModule {}
