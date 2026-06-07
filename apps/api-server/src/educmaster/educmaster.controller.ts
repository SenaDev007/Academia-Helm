import { Controller, Get, Query, Res, UseGuards, Req } from '@nestjs/common';
import { EducMasterService } from './educmaster.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Response } from 'express';

@Controller('educmaster')
@UseGuards(JwtAuthGuard)
export class EducMasterController {
  constructor(private readonly educMasterService: EducMasterService) {}

  @Get('export/students')
  async exportStudents(
    @Req() req: any,
    @Query('academicYearId') academicYearId: string,
    @Res() res: Response,
  ) {
    const tenantId = req.user.tenantId;
    const workbook = await this.educMasterService.exportStudents(tenantId, academicYearId);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=' + `educmaster_export_${new Date().getTime()}.xlsx`,
    );

    await workbook.xlsx.write(res);
    res.end();
  }
}
