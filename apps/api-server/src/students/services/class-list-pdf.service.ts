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
 * ⭐ Deux modes de génération :
 *   - 'physical' (défaut) : regroupe par classe PHYSIQUE (Class, table `classes`).
 *     Utilisé par l'onglet « Liste des élèves » (sections physiques : CE1-A, CE1-B...).
 *     Les élèves sont récupérés via StudentEnrollment.classId.
 *   - 'official' : regroupe par classe OFFICIELLE (AcademicClass, table `pedagogy_academic_classes`).
 *     Utilisé par l'onglet « Inscriptions » (classes officielles : CE1, CP, 6ème...).
 *     Les élèves sont récupérés via StudentEnrollment.academicClassId.
 *
 * Utilise PuppeteerPoolService (HTML → PDF) comme les autres services PDF.
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PuppeteerPoolService } from '../../common/services/puppeteer-pool.service';
import { ConfigService } from '@nestjs/config';

export type ClassListPdfMode = 'physical' | 'official';

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
   * @param classId - ID de la classe (Class si mode='physical', AcademicClass si mode='official')
   * @param tenantId - ID du tenant
   * @param academicYearId - ID de l'année académique
   * @param mode - 'physical' (défaut) ou 'official'
   * @returns Objet contenant le buffer PDF et les métadonnées (className, schoolName, studentsCount)
   */
  async generateClassListPdf(
    classId: string,
    tenantId: string,
    academicYearId: string,
    mode: ClassListPdfMode = 'physical',
  ): Promise<{ buffer: Buffer; className: string; schoolName: string; studentsCount: number }> {
    // 1. Récupérer les données selon le mode
    const ctx = await this.resolveClassContext(classId, tenantId, academicYearId, mode);

    // 2. Récupérer le branding du tenant
    const branding = await this.getTenantBranding(tenantId);

    // 3. Déterminer le niveau (Maternelle/Primaire vs Secondaire)
    const levelName = (ctx.schoolLevelName || '').toUpperCase();
    const isSecondary = levelName.includes('SECONDAIRE');

    // 4. Construire le HTML
    const html = this.buildHtml({
      className: ctx.className,
      classNameSubtitle: ctx.classNameSubtitle,
      schoolName: branding.schoolName,
      schoolLogo: branding.schoolLogo,
      schoolAddress: branding.schoolAddress,
      schoolPhone: branding.schoolPhone,
      schoolEmail: branding.schoolEmail,
      schoolSlogan: branding.schoolSlogan,
      academicYearName: ctx.academicYearName,
      isSecondary,
      students: ctx.students.map((s, i) => ({
        num: i + 1,
        name: `${s.lastName.toUpperCase()} ${s.firstName}`,
        matricule: s.matricule || s.studentCode || '—',
        gender: s.gender === 'M' ? 'M' : s.gender === 'F' ? 'F' : '—',
        dateOfBirth: s.dateOfBirth
          ? new Date(s.dateOfBirth).toLocaleDateString('fr-FR')
          : '—',
      })),
    });

    // 5. Générer le PDF via le pool Puppeteer partagé
    const { page } = await this.puppeteerPool.acquirePage();
    let pdfBuffer: Buffer;
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const rawPdf = await page.pdf({
        format: 'A4',
        margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
        printBackground: true,
      });
      pdfBuffer = Buffer.from(rawPdf);
    } finally {
      await this.puppeteerPool.releasePage(page);
    }

    this.logger.log(
      `Class list PDF generated (mode=${mode}): class=${ctx.className}, ${ctx.students.length} students, ${pdfBuffer.length} bytes`,
    );

    return {
      buffer: pdfBuffer,
      className: ctx.className,
      schoolName: branding.schoolName,
      studentsCount: ctx.students.length,
    };
  }

  /**
   * ⭐ Génère un PDF de TOUTES les classes officielles d'un niveau.
   * Chaque classe est sur une nouvelle page, avec en-tête officiel.
   * Les classes sont regroupées par niveau.
   *
   * @param tenantId
   * @param academicYearId
   * @param code Code du niveau (MATERNELLE/PRIMAIRE/SECONDAIRE)
   * @param schoolLevelId Fallback UUID
   */
  async generateAllClassesPdf(
    tenantId: string,
    academicYearId: string,
    code?: string,
    schoolLevelId?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    // 1. Résoudre le SchoolLevel
    const schoolLevel = await this.resolveSchoolLevelForAllClasses(tenantId, code, schoolLevelId);
    if (!schoolLevel) {
      throw new NotFoundException(
        `Niveau scolaire non trouvé${code ? ` (code=${code})` : ''}${schoolLevelId ? ` (id=${schoolLevelId})` : ''}`,
      );
    }

    // 2. Récupérer les classes officielles (AcademicClass) de ce niveau
    const schoolLevelCode = (schoolLevel.code || '').toUpperCase();
    const academicClasses = await this.prisma.academicClass.findMany({
      where: {
        tenantId,
        academicYearId,
        isActive: true,
        level: {
          name: { contains: schoolLevel.name, mode: 'insensitive' },
        },
      },
      orderBy: { name: 'asc' },
    });

    if (academicClasses.length === 0) {
      throw new NotFoundException(
        `Aucune classe officielle trouvée pour le niveau ${schoolLevel.code}.`,
      );
    }

    // 3. Récupérer le branding
    const branding = await this.getTenantBranding(tenantId);
    const isSecondary = schoolLevelCode.includes('SECONDAIRE');

    // 4. Récupérer l'année scolaire
    const academicYear = await this.prisma.academicYear.findFirst({
      where: { id: academicYearId, tenantId },
    });

    // 5. Construire un seul HTML avec toutes les classes (séparées par page-break)
    const allHtml: string[] = [];
    for (const ac of academicClasses) {
      // Récupérer les élèves de cette classe officielle
      const enrollments = await this.prisma.studentEnrollment.findMany({
        where: {
          tenantId,
          academicClassId: ac.id,
          academicYearId,
          status: { notIn: ['WITHDRAWN', 'TRANSFERRED'] },
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

      const html = this.buildHtml({
        className: ac.name,
        classNameSubtitle: `Classe officielle — ${enrollments.length} élève(s)`,
        schoolName: branding.schoolName,
        schoolLogo: branding.schoolLogo,
        schoolAddress: branding.schoolAddress,
        schoolPhone: branding.schoolPhone,
        schoolEmail: branding.schoolEmail,
        schoolSlogan: branding.schoolSlogan,
        academicYearName: academicYear?.name || '',
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
        // ⭐ Force un page-break après cette classe (sauf la dernière)
        pageBreakAfter: true,
      });
      allHtml.push(html);
    }

    // 6. Combiner tous les HTML en un seul document
    const combinedHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', Georgia, serif; color: #1a1a1a; font-size: 13px; }
  .class-section { page-break-after: always; }
  .class-section:last-child { page-break-after: auto; }
  ${allHtml.map((_, i) => i === 0 ? '' : '').join('')}
</style>
</head>
<body>
${allHtml.map((html, i) => `<div class="class-section">${this.extractBodyContent(html)}</div>`).join('\n')}
</body>
</html>`;

    // 7. Générer le PDF
    const { page } = await this.puppeteerPool.acquirePage();
    let pdfBuffer: Buffer;
    try {
      await page.setContent(combinedHtml, { waitUntil: 'networkidle0' });
      const rawPdf = await page.pdf({
        format: 'A4',
        margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
        printBackground: true,
      });
      pdfBuffer = Buffer.from(rawPdf);
    } finally {
      await this.puppeteerPool.releasePage(page);
    }

    // 8. Nom du fichier
    const niveauScolaire = this.levelNameForFile(schoolLevel.name || schoolLevel.code || 'Niveau');
    const nomEcole = (branding.schoolName || 'Ecole').replace(/[/\\:*?"<>|]/g, ' ').replace(/\s+/g, '_').trim().slice(0, 40);
    const filename = `Listes_${niveauScolaire}_${nomEcole}.pdf`;

    this.logger.log(
      `All-classes PDF generated: level=${schoolLevel.code}, ${academicClasses.length} classes, ${pdfBuffer.length} bytes`,
    );

    return { buffer: pdfBuffer, filename };
  }

  /**
   * Résout un SchoolLevel par code ou par id (pour generateAllClassesPdf).
   */
  private async resolveSchoolLevelForAllClasses(
    tenantId: string,
    code?: string,
    schoolLevelId?: string,
  ) {
    if (code && code.trim()) {
      const upperCode = code.trim().toUpperCase();
      const byCode = await this.prisma.schoolLevel.findFirst({
        where: { tenantId, code: upperCode },
      });
      if (byCode) return byCode;
      const byName = await this.prisma.schoolLevel.findFirst({
        where: {
          tenantId,
          OR: [
            { name: { equals: code, mode: 'insensitive' } },
            { label: { equals: code, mode: 'insensitive' } },
          ],
        },
      });
      if (byName) return byName;
    }
    if (schoolLevelId) {
      const byId = await this.prisma.schoolLevel.findFirst({
        where: { id: schoolLevelId, tenantId },
      });
      if (byId) return byId;
    }
    return null;
  }

  /** Extrait le contenu du <body> d'un document HTML. */
  private extractBodyContent(html: string): string {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    return bodyMatch ? bodyMatch[1] : html;
  }

  /** Libellé du niveau pour le nom de fichier. */
  private levelNameForFile(codeOrName: string): string {
    const upper = codeOrName.toUpperCase();
    if (upper === 'MATERNELLE') return 'Maternelle';
    if (upper === 'PRIMAIRE') return 'Primaire';
    if (upper === 'SECONDAIRE') return 'Secondaire';
    return codeOrName.trim() || 'Niveau';
  }

  /**
   * Résout le contexte de la classe (physique ou officielle) et récupère les élèves.
   */
  private async resolveClassContext(
    classId: string,
    tenantId: string,
    academicYearId: string,
    mode: ClassListPdfMode,
  ): Promise<{
    className: string;
    classNameSubtitle?: string;
    schoolLevelName: string;
    academicYearName: string;
    students: Array<{
      id: string;
      firstName: string;
      lastName: string;
      matricule: string | null;
      studentCode: string | null;
      gender: string | null;
      dateOfBirth: Date | null;
    }>;
  }> {
    if (mode === 'official') {
      // ── Mode OFFICIEL : AcademicClass + StudentEnrollment.academicClassId ──
      const ac = await this.prisma.academicClass.findFirst({
        where: { id: classId, tenantId },
        include: {
          level: true,
          academicYear: true,
        },
      });
      if (!ac) {
        throw new NotFoundException('Classe officielle non trouvée');
      }

      const enrollments = await this.prisma.studentEnrollment.findMany({
        where: {
          tenantId,
          academicClassId: classId,
          academicYearId,
          status: { notIn: ['WITHDRAWN', 'TRANSFERRED'] },
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

      // Sous-titre : indiquer qu'on affiche tous les élèves de la classe officielle
      // (toutes sections physiques confondues)
      const sectionsCount = await this.prisma.class.count({
        where: { tenantId, academicYearId, officialClassId: classId },
      });
      const classNameSubtitle =
        sectionsCount > 0
          ? `Classe officielle — ${sectionsCount} section${sectionsCount > 1 ? 's' : ''} physique${sectionsCount > 1 ? 's' : ''}`
          : 'Classe officielle';

      return {
        className: ac.name,
        classNameSubtitle,
        schoolLevelName: ac.level?.name || '',
        academicYearName: ac.academicYear?.name || '',
        students: enrollments.map((e) => ({
          id: e.student.id,
          firstName: e.student.firstName,
          lastName: e.student.lastName,
          matricule: e.student.matricule,
          studentCode: e.student.studentCode,
          gender: e.student.gender,
          dateOfBirth: e.student.dateOfBirth,
        })),
      };
    }

    // ── Mode PHYSIQUE (défaut) : Class + StudentEnrollment.classId ──
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, tenantId },
      include: {
        schoolLevel: true,
        academicYear: true,
        officialClass: true,
      },
    });
    if (!cls) throw new NotFoundException('Classe non trouvée');

    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: {
        tenantId,
        classId,
        academicYearId,
        status: { notIn: ['WITHDRAWN', 'TRANSFERRED'] },
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

    return {
      className: cls.name,
      classNameSubtitle: cls.officialClass?.name
        ? `Section physique — classe officielle : ${cls.officialClass.name}`
        : 'Section physique',
      schoolLevelName: cls.schoolLevel?.name || '',
      academicYearName: cls.academicYear?.name || '',
      students: enrollments.map((e) => ({
        id: e.student.id,
        firstName: e.student.firstName,
        lastName: e.student.lastName,
        matricule: e.student.matricule,
        studentCode: e.student.studentCode,
        gender: e.student.gender,
        dateOfBirth: e.student.dateOfBirth,
      })),
    };
  }

  /**
   * Construit le HTML de la liste de classe avec l'en-tête officiel.
   */
  private buildHtml(data: {
    className: string;
    classNameSubtitle?: string;
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
    /** ⭐ Si true, ajoute un page-break après ce bloc (utilisé par generateAllClassesPdf). */
    pageBreakAfter?: boolean;
  }): string {
    const ministry = data.isSecondary
      ? `Ministère de l'Enseignement Secondaire, de la Formation Technique et Professionnelle, de la Reconversion et de l'Insertion des Jeunes`
      : `Ministère des Enseignements Maternel et Primaire`;

    // Drapeau du Bénin en SVG data URL (vert | jaune/rouge)
    const beninFlagSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="40" viewBox="0 0 75 50"><rect width="30" height="50" fill="#008751"/><rect x="30" width="45" height="25" fill="#FCD116"/><rect x="30" y="25" width="45" height="25" fill="#E8112D"/></svg>`;
    const beninFlag = `data:image/svg+xml;base64,${Buffer.from(beninFlagSvg).toString('base64')}`;

    // Logo de l'école à droite (si disponible, sinon initiales)
    const schoolLogoBlock = data.schoolLogo
      ? `<img src="${data.schoolLogo}" alt="Logo" style="max-width:60px;max-height:60px;object-fit:contain;" />`
      : `<div style="width:55px;height:55px;border:2px solid #0D1F6E;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:bold;color:#0D1F6E;">${(data.schoolName || 'EC').substring(0, 2).toUpperCase()}</div>`;

    const contactInfo = [
      data.schoolSlogan ? `« ${data.schoolSlogan} »` : null,
      data.schoolAddress,
      data.schoolPhone ? `Tél : ${data.schoolPhone}` : null,
      data.schoolEmail ? `Email : ${data.schoolEmail}` : null,
    ].filter(Boolean).join(' · ');

    const rows = data.students.length > 0
      ? data.students.map(s => `
        <tr>
          <td style="text-align:center;padding:8px 10px;border:1px solid #ddd;">${s.num}</td>
          <td style="padding:8px 10px;border:1px solid #ddd;font-weight:600;">${s.name}</td>
          <td style="text-align:center;padding:8px 6px;border:1px solid #ddd;font-size:10px;white-space:nowrap;">${s.matricule}</td>
          <td style="text-align:center;padding:8px 10px;border:1px solid #ddd;">${s.gender}</td>
          <td style="text-align:center;padding:8px 10px;border:1px solid #ddd;">${s.dateOfBirth}</td>
        </tr>
      `).join('')
      : `<tr><td colspan="5" style="text-align:center;padding:20px;border:1px solid #ddd;color:#999;">Aucun élève inscrit dans cette classe</td></tr>`;

    const subtitleBlock = data.classNameSubtitle
      ? `<div style="text-align:center;font-size:11px;color:#666;margin-bottom:15px;font-style:italic;">${data.classNameSubtitle}</div>`
      : '';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', Georgia, serif; color: #1a1a1a; font-size: 13px; }

  /* ── En-tête officiel ── */
  .header { margin-bottom: 20px; padding-bottom: 12px; border-bottom: 3px double #0D1F6E; }
  .header-table { width: 100%; border-collapse: collapse; }
  .header-table td { vertical-align: middle; padding: 4px 8px; }
  .header-left { text-align: center; width: 18%; }
  .header-center { text-align: center; width: 64%; }
  .header-right { text-align: center; width: 18%; }

  .republique {
    font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;
  }
  .divider {
    margin: 6px auto; width: 55%;
    display: flex; align-items: center; justify-content: center; gap: 6px;
  }
  .divider-line { flex: 1; height: 1px; background: #0D1F6E; }
  .divider-diamond {
    width: 6px; height: 6px; background: #0D1F6E;
    transform: rotate(45deg); flex-shrink: 0;
  }
  .ministere {
    font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px;
    line-height: 1.4;
  }
  .school-name {
    font-size: 15px; font-weight: bold; text-transform: uppercase;
    margin-top: 6px; line-height: 1.3;
  }
  .school-info {
    font-size: 10px; color: #555; margin-top: 4px; line-height: 1.4;
  }

  /* ── Titre du document ── */
  .document-title {
    text-align: center; font-size: 18px; font-weight: bold;
    text-transform: uppercase; margin: 25px 0 15px; color: #0D1F6E;
    text-decoration: underline; text-underline-offset: 4px;
  }

  /* ── Infos classe (3 colonnes) ── */
  .class-info {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 13px; margin-bottom: 20px; padding: 0 5px;
  }
  .class-info-left { text-align: left; font-weight: 600; }
  .class-info-center { text-align: center; font-weight: 600; }
  .class-info-right { text-align: right; font-weight: 600; }
  .label-underlined {
    text-decoration: underline; text-underline-offset: 3px; font-weight: 700;
  }

  /* ── Tableau ── */
  table.students { width: 100%; border-collapse: collapse; margin-top: 5px; }
  table.students th {
    background: #0D1F6E; color: #fff; padding: 8px;
    border: 1px solid #0D1F6E; font-size: 12px; text-transform: uppercase;
  }
  table.students td { font-size: 12px; }
  table.students tr:nth-child(even) { background: #f8fafc; }

  /* ── Footer ── */
  .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
  .signature { margin-top: 50px; display: flex; justify-content: space-between; }
  .signature-block { text-align: center; font-size: 12px; }
  .signature-line { margin-top: 45px; border-top: 1px solid #333; width: 200px; margin-left: auto; margin-right: auto; }
</style>
</head>
<body>
  <!-- EN-TÊTE OFFICIEL -->
  <div class="header">
    <table class="header-table">
      <tr>
        <td class="header-left">
          <img src="${beninFlag}" alt="Drapeau du Bénin" style="width:50px;height:34px;" />
        </td>
        <td class="header-center">
          <div class="republique">République du Bénin</div>
          <div class="divider"><div class="divider-line"></div><div class="divider-diamond"></div><div class="divider-line"></div></div>
          <div class="ministere">${ministry}</div>
          <div class="divider"><div class="divider-line"></div><div class="divider-diamond"></div><div class="divider-line"></div></div>
          <div class="school-name">${data.schoolName || 'Établissement'}</div>
          ${contactInfo ? `<div class="school-info">${contactInfo}</div>` : ''}
        </td>
        <td class="header-right">
          ${schoolLogoBlock}
        </td>
      </tr>
    </table>
  </div>

  <!-- TITRE DU DOCUMENT -->
  <div class="document-title">Liste des Élèves</div>

  ${subtitleBlock}

  <!-- INFOS CLASSE — 3 colonnes alignées -->
  <div class="class-info">
    <span class="class-info-left"><span class="label-underlined">Classe</span> : ${data.className}</span>
    <span class="class-info-center"><span class="label-underlined">Effectif</span> : ${data.students.length} élève(s)</span>
    <span class="class-info-right"><span class="label-underlined">Année scolaire</span> : ${data.academicYearName}</span>
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
