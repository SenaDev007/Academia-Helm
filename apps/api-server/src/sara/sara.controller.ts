import { Controller, Post, Body } from '@nestjs/common';
import { SaraService } from './sara.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller('sara')
export class SaraController {
  constructor(private readonly saraService: SaraService) {}

  @Public()
  @Post('query')
  async query(@Body() body: { query: string; visitorId?: string }) {
    return this.saraService.handleVisitorQuery(body.query, body.visitorId);
  }
}
