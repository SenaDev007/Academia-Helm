import { Controller, Get, Post, Body, Param, UseGuards, Req, Patch } from '@nestjs/common';
import { StudentTransferService } from './student-transfer.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('students/transfers')
@UseGuards(JwtAuthGuard)
export class StudentTransferController {
  constructor(private readonly transferService: StudentTransferService) {}

  @Post()
  async createRequest(@Req() req: any, @Body() data: any) {
    return this.transferService.createTransferRequest(req.user.userId, req.user.tenantId, data);
  }

  @Get('outgoing')
  async getOutgoing(@Req() req: any) {
    return this.transferService.getOutgoingTransfers(req.user.tenantId);
  }

  @Get('incoming')
  async getIncoming(@Req() req: any) {
    return this.transferService.getIncomingTransfers(req.user.tenantId);
  }

  @Get('search-schools')
  async searchSchools(@Query('q') q: string) {
    return this.transferService.searchSchools(q);
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @Req() req: any) {
    return this.transferService.approveTransfer(id, req.user.userId);
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string, @Req() req: any, @Body('reason') reason: string) {
    return this.transferService.rejectTransfer(id, req.user.userId, reason);
  }

  @Post(':id/request-complement')
  async requestComplement(@Param('id') id: string, @Req() req: any, @Body('message') message: string) {
    return this.transferService.requestComplement(id, req.user.userId, message);
  }

  @Post(':id/confirm-exit')
  async confirmExit(@Param('id') id: string) {
    return this.transferService.confirmSourceExit(id);
  }

  @Post(':id/execute')
  async execute(@Param('id') id: string) {
    return this.transferService.executeTransfer(id);
  }

  @Get(':id/dossier')
  async getDossier(@Param('id') id: string, @Query('level') level: 'FULL' | 'MASKED' = 'MASKED') {
    return this.transferService.compileFullDossier(id, level);
  }
}
