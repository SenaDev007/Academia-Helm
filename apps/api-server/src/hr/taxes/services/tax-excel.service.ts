/**
 * ============================================================================
 * TAX EXCEL SERVICE — Export Excel de tous les tableaux
 * ============================================================================
 * Génère des fichiers .xlsx pour: états financiers, notes annexes,
 * paie, déclarations fiscales, annuaire personnel.
 * ============================================================================
 */
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class TaxExcelService {
  private readonly logger = new Logger(TaxExcelService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Génère un export Excel d'un état financier.
   */
  async exportFinancialStatement(tenantId: string, academicYearId: string, type: string): Promise<Buffer> {
    const lines = await this.prisma.financialStatement.findMany({
      where: { tenantId, academicYearId, type },
      orderBy: { sortOrder: 'asc' },
    });
    const header = await this.prisma.financialReportHeader.findFirst({ where: { tenantId, academicYearId } });

    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Academia Helm';
    const ws = wb.addWorksheet(type);

    // En-tête
    ws.mergeCells('A1:E1');
    ws.getCell('A1').value = `${header?.denominationSociale || ''} — ${type}`;
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.mergeCells('A2:E2');
    ws.getCell('A2').value = `IFU: ${header?.numeroIF || ''} — Exercice clos le: ${header?.exerciceClosLe || ''}`;

    // Titre colonnes
    const titleRow = ws.getRow(4);
    titleRow.values = ['REF', 'LIBELLÉ', 'Note', 'EXERCICE N', 'EXERCICE N-1'];
    titleRow.font = { bold: true };
    titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B2F73' } };
    titleRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Données
    lines.forEach((line, i) => {
      const row = ws.getRow(5 + i);
      row.values = [line.lineCode, line.lineLabel, line.note, Number(line.amountN), Number(line.amountN1 || 0)];
      if (line.isSubtotal || line.isTotal) {
        row.font = { bold: true };
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F2F5' } };
      }
    });

    ws.columns.forEach(col => { col.width = 20; });
    ws.getColumn(2).width = 50;

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  /**
   * Génère un export Excel des fiches de paie.
   */
  async exportPayslips(tenantId: string, academicYearId: string, period: string): Promise<Buffer> {
    const payslips = await this.prisma.payslip.findMany({
      where: { tenantId, academicYearId, period },
      include: { staff: { select: { firstName: true, lastName: true, position: true, cnssNumber: true } } },
      orderBy: { staff: { lastName: 'asc' } },
    });

    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Academia Helm';
    const ws = wb.addWorksheet('Fiches de paie');

    ws.mergeCells('A1:L1');
    ws.getCell('A1').value = `État de paiement — ${period}`;
    ws.getCell('A1').font = { bold: true, size: 14 };

    const headers = ['Nom', 'Fonction', 'N° CNSS', 'Salaire base', 'Brut', 'CNSS Ouv.', 'ITS', 'Avance', 'Opposition', 'Taxes R/T', 'Retenues', 'Net à payer'];
    const titleRow = ws.getRow(3);
    titleRow.values = headers;
    titleRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B2F73' } };

    payslips.forEach((p, i) => {
      ws.getRow(4 + i).values = [
        `${p.staff.firstName} ${p.staff.lastName}`,
        p.staff.position,
        p.staff.cnssNumber,
        Number(p.salaireBase), Number(p.salaireBrut), Number(p.cnssOuvriere),
        Number(p.itsNet), Number(p.avanceAcompte), Number(p.opposition),
        Number(p.taxesRadioTele), Number(p.totalRetenues), Number(p.netAPayer),
      ];
    });

    // Totaux
    const totalRow = ws.getRow(4 + payslips.length);
    totalRow.values = ['TOTAL', '', '', '', { formula: `SUM(E4:E${3 + payslips.length})` }, { formula: `SUM(F4:F${3 + payslips.length})` }, '', '', '', '', { formula: `SUM(K4:K${3 + payslips.length})` }, { formula: `SUM(L4:L${3 + payslips.length})` }];
    totalRow.font = { bold: true };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F2F5' } };

    ws.columns.forEach(col => { col.width = 18; });
    ws.getColumn(1).width = 30;

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  /**
   * Génère un export Excel des notes annexes.
   */
  async exportFinancialNotes(tenantId: string, academicYearId: string): Promise<Buffer> {
    const notes = await this.prisma.financialNote.findMany({
      where: { tenantId, academicYearId },
      orderBy: [{ noteCode: 'asc' }, { sortOrder: 'asc' }],
    });

    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Academia Helm';

    // Grouper par noteCode
    const grouped: Record<string, any[]> = {};
    notes.forEach(n => {
      if (!grouped[n.noteCode]) grouped[n.noteCode] = [];
      grouped[n.noteCode].push(n);
    });

    for (const [code, lines] of Object.entries(grouped)) {
      const ws = wb.addWorksheet(code.replace(/[^a-zA-Z0-9]/g, '').substring(0, 30));
      ws.mergeCells('A1:C1');
      ws.getCell('A1').value = `${code} — ${lines[0]?.noteTitle || ''}`;
      ws.getCell('A1').font = { bold: true, size: 12 };

      const titleRow = ws.getRow(3);
      titleRow.values = ['Libellé', 'Année N', 'Année N-1'];
      titleRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B2F73' } };

      lines.forEach((line, i) => {
        ws.getRow(4 + i).values = [line.lineLabel, Number(line.amountN), Number(line.amountN1 || 0)];
      });

      ws.columns[1].width = 50;
      ws.columns[2].width = 20;
      ws.columns[3].width = 20;
    }

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  /**
   * Génère un export Excel de l'annuaire fiscal du personnel.
   */
  async exportStaffFiscal(tenantId: string): Promise<Buffer> {
    const staff = await this.prisma.staff.findMany({
      where: { tenantId, status: { not: 'ARCHIVED' } },
      select: { firstName: true, lastName: true, position: true, salary: true, cnssNumber: true, ifuNumber: true, contractType: true, tenantMatricule: true, hireDate: true, email: true, phone: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Academia Helm';
    const ws = wb.addWorksheet('Personnel fiscal');

    ws.mergeCells('A1:K1');
    ws.getCell('A1').value = 'Annuaire fiscal du personnel';
    ws.getCell('A1').font = { bold: true, size: 14 };

    const headers = ['Nom', 'Fonction', 'Type', 'N° Matricule', 'N° CNSS', 'N° IFU', 'Salaire', 'Email', 'Téléphone', 'Date embauche'];
    const titleRow = ws.getRow(3);
    titleRow.values = headers;
    titleRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    titleRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B2F73' } };

    staff.forEach((s, i) => {
      ws.getRow(4 + i).values = [
        `${s.firstName} ${s.lastName}`, s.position,
        s.contractType === 'VACATAIRE' ? 'VACATAIRE' : 'PERMANENT',
        s.tenantMatricule, s.cnssNumber, s.ifuNumber,
        Number(s.salary || 0), s.email, s.phone,
        s.hireDate ? new Date(s.hireDate).toLocaleDateString('fr-FR') : '',
      ];
    });

    ws.columns.forEach(col => { col.width = 20; });
    ws.getColumn(1).width = 30;

    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
