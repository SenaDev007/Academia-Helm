/**
 * ============================================================================
 * CLASS LIST PDF SERVICE — Génération de listes de classe en PDF
 * ============================================================================
 *
 * Génère des PDF de listes d'élèves par classe avec l'en-tête officiel :
 *   - Maternelle/Primaire : "Ministère des Enseignements Maternel et Primaire"
 *   - Secondaire : "Ministère de l'Enseignement Secondaire, de la Formation
 *     Technique et Professionnelle, de la Reconversion et de l'Insertion des Jeunes"
 *
 * Utilise PuppeteerPoolService (HTML → PDF) comme les autres services PDF.
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PuppeteerPoolService } from '../../common/services/puppeteer-pool.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ClassListPdfService {
  private readonly logger = new Logger(ClassListPdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Génère le PDF de la liste d'élèves d'une classe.
   *
   * @param classId - ID de la classe
   * @param tenantId - ID du tenant
   * @param academicYearId - ID de l'année académique
   * @returns Buffer du PDF
   */
  async generateClassListPdf(
    classId: string,
    tenantId: string,
    academicYearId: string,
  ): Promise<Buffer> {
    // 1. Récupérer les données
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, tenantId },
      include: {
        schoolLevel: true,
        academicYear: true,
      },
    });
    if (!cls) throw new NotFoundException('Classe non trouvée');

    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        tenantId,
        classId,
        academicYearId,
        status: { in: ['ACTIVE', 'VALIDATED', 'ADMITTED', 'RE_ENROLLED'] },
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            matricule: true,
            studentCode: true,
            gender: true,
            dateOfBirth: true,
          },
        },
      },
      orderBy: { student: { lastName: 'asc' } },
    });

    // 2. Récupérer le branding du tenant
    const branding = await this.getTenantBranding(tenantId);

    // 3. Déterminer le niveau (Maternelle/Primaire vs Secondaire)
    const levelName = (cls.schoolLevel?.name || '').toUpperCase();
    const isSecondary = levelName.includes('SECONDAIRE');

    // 4. Construire le HTML
    const html = this.buildHtml({
      className: cls.name,
      schoolName: branding.schoolName,
      schoolLogo: branding.schoolLogo,
      schoolAddress: branding.schoolAddress,
      schoolPhone: branding.schoolPhone,
      schoolEmail: branding.schoolEmail,
      schoolSlogan: branding.schoolSlogan,
      academicYearName: cls.academicYear?.name || '',
      isSecondary,
      students: enrollments.map((e, i) => ({
        num: i + 1,
        name: `${e.student.lastName.toUpperCase()} ${e.student.firstName}`,
        matricule: e.student.matricule || e.student.studentCode || '—',
        gender: e.student.gender === 'M' ? 'M' : e.student.gender === 'F' ? 'F' : '—',
        dateOfBirth: e.student.dateOfBirth
          ? new Date(e.student.dateOfBirth).toLocaleDateString('fr-FR')
          : '—',
      })),
    });

    // 5. Générer le PDF
    const pdfBuffer = await this.puppeteerPool.renderPdf(html, {
      format: 'A4',
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
      printBackground: true,
    });

    this.logger.log(
      `Class list PDF generated: class=${cls.name}, ${enrollments.length} students, ${pdfBuffer.length} bytes`,
    );

    return pdfBuffer;
  }

  /**
   * Construit le HTML de la liste de classe avec l'en-tête officiel.
   */
  private buildHtml(data: {
    className: string;
    schoolName: string;
    schoolLogo?: string | null;
    schoolAddress?: string | null;
    schoolPhone?: string | null;
    schoolEmail?: string | null;
    schoolSlogan?: string | null;
    academicYearName: string;
    isSecondary: boolean;
    students: Array<{
      num: number;
      name: string;
      matricule: string;
      gender: string;
      dateOfBirth: string;
    }>;
  }): string {
    const ministry = data.isSecondary
      ? `Ministère de l'Enseignement Secondaire, de la Formation Technique et Professionnelle, de la Reconversion et de l'Insertion des Jeunes`
      : `Ministère des Enseignements Maternel et Primaire`;

    const logoBlock = data.schoolLogo
      ? `<img src="${data.schoolLogo}" alt="Logo" style="max-height:70px;max-width:70px;object-fit:contain;" />`
      : `<div style="width:70px;height:70px;border:2px solid #ccc;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:bold;color:#999;">${(data.schoolName || 'EC').substring(0, 2).toUpperCase()}</div>`;

    const contactInfo = [
      data.schoolSlogan ? `<em>« ${data.schoolSlogan} »</em>` : null,
      data.schoolAddress,
      data.schoolPhone ? `Tél : ${data.schoolPhone}` : null,
      data.schoolEmail ? `Email : ${data.schoolEmail}` : null,
    ].filter(Boolean).join(' · ');

    const rows = data.students.length > 0
      ? data.students.map(s => `
        <tr>
          <td style="text-align:center;padding:6px 8px;border:1px solid #ddd;">${s.num}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;font-weight:600;">${s.name}</td>
          <td style="text-align:center;padding:6px 8px;border:1px solid #ddd;font-family:monospace;font-size:11px;">${s.matricule}</td>
          <td style="text-align:center;padding:6px 8px;border:1px solid #ddd;">${s.gender}</td>
          <td style="text-align:center;padding:6px 8px;border:1px solid #ddd;">${s.dateOfBirth}</td>
        </tr>
      `).join('')
      : `<tr><td colspan="5" style="text-align:center;padding:20px;border:1px solid #ddd;color:#999;">Aucun élève inscrit dans cette classe</td></tr>`;

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', Georgia, serif; color: #1a1a1a; font-size: 13px; }
  .header { text-align: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #0D1F6E; }
  .header-table { width: 100%; border-collapse: collapse; }
  .header-table td { vertical-align: middle; padding: 5px; }
  .header-left { text-align: left; width: 25%; }
  .header-center { text-align: center; width: 50%; }
  .header-right { text-align: right; width: 25%; }
  .republique { font-size: 14px; font-weight: bold; text-transform: uppercase; }
  .ministere { font-size: 11px; font-style: italic; margin-top: 2px; }
  .school-name { font-size: 16px; font-weight: bold; text-transform: uppercase; margin-top: 4px; }
  .school-info { font-size: 10px; color: #555; margin-top: 2px; }
  .document-title { text-align: center; font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 25px 0 15px; color: #0D1F6E; }
  .class-info { text-align: center; font-size: 14px; margin-bottom: 20px; }
  .class-info strong { font-size: 16px; }
  table.students { width: 100%; border-collapse: collapse; margin-top: 10px; }
  table.students th { background: #0D1F6E; color: #fff; padding: 8px; border: 1px solid #0D1F6E; font-size: 12px; text-transform: uppercase; }
  table.students td { font-size: 12px; }
  table.students tr:nth-child(even) { background: #f8fafc; }
  .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
  .signature { margin-top: 40px; display: flex; justify-content: space-between; }
  .signature-block { text-align: center; font-size: 12px; }
  .signature-line { margin-top: 50px; border-top: 1px solid #333; width: 200px; margin-left: auto; margin-right: auto; }
</style>
</head>
<body>
  <!-- EN-TÊTE OFFICIEL -->
  <div class="header">
    <table class="header-table">
      <tr>
        <td class="header-left">${logoBlock}</td>
        <td class="header-center">
          <div class="republique">République du Bénin</div>
          <div class="ministere">${ministry}</div>
          <div class="school-name">${data.schoolName || 'Établissement'}</div>
          <div class="school-info">${contactInfo}</div>
        </td>
        <td class="header-right">${logoBlock}</td>
      </tr>
    </table>
  </div>

  <!-- TITRE DU DOCUMENT -->
  <div class="document-title">Liste des Élèves</div>

  <!-- INFOS CLASSE -->
  <div class="class-info">
    Classe : <strong>${data.className}</strong><br/>
    Année scolaire : <strong>${data.academicYearName}</strong><br/>
    Effectif : <strong>${data.students.length}</strong> élève(s)
  </div>

  <!-- TABLEAU DES ÉLÈVES -->
  <table class="students">
    <thead>
      <tr>
        <th style="width:40px;">N°</th>
        <th>Nom et Prénom(s)</th>
        <th style="width:120px;">Matricule</th>
        <th style="width:50px;">Sexe</th>
        <th style="width:100px;">Date Naiss.</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <!-- SIGNATURES -->
  <div class="signature">
    <div class="signature-block">
      Le Responsable<br/>
      <div class="signature-line"></div>
    </div>
    <div class="signature-block">
      Le Directeur / La Directrice<br/>
      <div class="signature-line"></div>
    </div>
  </div>

  <!-- PIED DE PAGE -->
  <div class="footer">
    Document généré par Academia Helm — ${new Date().toLocaleDateString('fr-FR')}
  </div>
</body>
</html>`;
  }

  /**
   * Récupère le branding du tenant (logo, nom, contact).
   */
  private async getTenantBranding(tenantId: string): Promise<{
    schoolName: string;
    schoolLogo?: string | null;
    schoolAddress?: string | null;
    schoolPhone?: string | null;
    schoolEmail?: string | null;
    schoolSlogan?: string | null;
  }> {
    try {
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
        select: {
          schoolName: true,
          logoUrl: true,
          address: true,
          phonePrimary: true,
          email: true,
          slogan: true,
        },
      });

      if (profile?.schoolName) {
        const apiBaseUrl = this.configService.get<string>('APP_PUBLIC_URL')
          || 'https://academia-helm-api.fly.dev';
        const logoUrl = profile.logoUrl
          ? `${apiBaseUrl}/api/tenants/${tenantId}/logo`
          : null;
        return {
          schoolName: profile.schoolName,
          schoolLogo: logoUrl,
          schoolAddress: profile.address,
          schoolPhone: profile.phonePrimary,
          schoolEmail: profile.email,
          schoolSlogan: profile.slogan,
        };
      }

      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });
      return { schoolName: tenant?.name || 'Établissement' };
    } catch (err: any) {
      this.logger.warn(`getTenantBranding failed: ${err.message}`);
      return { schoolName: 'Établissement' };
    }
  }
}
