import { Controller, Post, Get, Body, UseGuards, Req } from '@nestjs/common';
import { AtlasService } from './atlas.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('atlas')
@UseGuards(JwtAuthGuard)
export class AtlasController {
  constructor(private readonly atlasService: AtlasService) {}

  @Post('chat')
  async chat(@Req() req: any, @Body('message') message: string) {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    return this.atlasService.sendMessage(tenantId, userId, message);
  }

  @Get('history')
  async getHistory(@Req() req: any) {
    const tenantId = req.user.tenantId;
    const userId = req.user.id;
    return this.atlasService.getHistory(tenantId, userId);
  }
}
