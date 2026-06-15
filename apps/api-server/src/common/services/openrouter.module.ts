import { Module } from '@nestjs/common';
import { OpenRouterService } from './openrouter.service';
import { WebSearchService } from './web-search.service';

@Module({
  providers: [OpenRouterService, WebSearchService],
  exports: [OpenRouterService, WebSearchService],
})
export class OpenRouterModule {}
