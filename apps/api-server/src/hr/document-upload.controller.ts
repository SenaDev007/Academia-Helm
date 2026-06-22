import { Controller, Get, Post, Body, Param, Query, UseGuards, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/guards/tenant.guard';
import { GetTenant } from '../common/decorators/tenant.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { DocumentUploadService, SendDocumentUploadDto, UploadDocumentDto } from './services/document-upload.service';

@Controller('hr/recruitment/document-upload')
@UseGuards(JwtAuthGuard, TenantGuard)
export class DocumentUploadController {
  constructor(private svc: DocumentUploadService) {}
  @Post('send') async send(@GetTenant() t: any, @Body() dto: SendDocumentUploadDto, @Query('tenantId') tid?: string) { return this.svc.sendUploadLink(t?.id ?? tid, dto); }
  @Get('list') async list(@GetTenant() t: any, @Query('candidateId') cid?: string, @Query('tenantId') tid?: string) { return this.svc.listUploadTokens(t?.id ?? tid, cid); }
}

@Controller('documents-public')
export class DocumentPublicController {
  constructor(private svc: DocumentUploadService) {}
  @Public() @Get(':token') async getInfo(@Param('token') token: string) { return this.svc.getUploadInfo(token); }
  @Public() @Post(':token/upload') async upload(@Param('token') token: string, @Body() dto: UploadDocumentDto) { return this.svc.uploadDocument(token, dto); }
  @Public() @Post(':token/submit') async submit(@Param('token') token: string) { return this.svc.submitDocuments(token); }
}
