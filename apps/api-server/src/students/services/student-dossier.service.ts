/**
 * ============================================================================
 * STUDENT DOSSIER SERVICE - DOSSIER SCOLAIRE NUMÉRIQUE ÉLÈVE
 * ============================================================================
 * 
 * Service pour gérer le dossier scolaire numérique complet de l'élève
 * Centralise toute la vie scolaire : parcours, résultats, discipline, documents
 * 
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';

@Injectable()
export class StudentDossierService {
  private readonly logger = new Logger(StudentDossierService.name);
  private puppeteer: any = null;

  constructor(private readonly prisma: PrismaService) {}

  private async loadPuppeteer() {
    if (this.puppeteer !== null) return;
    try {
      this.puppeteer = await import('puppeteer');
      this.logger.log('Puppeteer loaded successfully for academic dossier PDF generation');
    } catch (error) {
      this.logger.warn(
        'Puppeteer not available. Academic dossier PDF generation will be limited. ' +
        'Install with: npm install puppeteer',
      );
      this.puppeteer = null;
    }
  }

  /**
   * Récupère le dossier scolaire complet d'un élève
   */
  async getStudentDossier(
    tenantId: string,
    studentId: string,
    academicYearId?: string,
  ): Promise<any> {
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId,
      },
      include: {
        identifier: true,
        idCards: {
          where: academicYearId ? { academicYearId } : undefined,
          orderBy: { generatedAt: 'desc' },
          take: 1,
        },
        tenant: {
          include: {
            schools: {
              take: 1,
            },
          },
        },
      },
    });

    if (!student) {
      throw new NotFoundException('Élève non trouvé');
    }

    // Récupérer les enregistrements académiques
    const academicRecords = await this.prisma.studentAcademicRecord.findMany({
      where: {
        studentId,
        ...(academicYearId && { academicYearId }),
      },
      include: {
        academicYear: true,
        class: true,
        schoolLevel: true,
      },
      orderBy: {
        academicYear: {
          startDate: 'desc',
        },
      },
    });

    // Récupérer les résumés disciplinaires
    const disciplinarySummaries = await this.prisma.studentDisciplinarySummary.findMany({
      where: {
        studentId,
        ...(academicYearId && { academicYearId }),
      },
      include: {
        academicYear: true,
      },
      orderBy: {
        academicYear: {
          startDate: 'desc',
        },
      },
    });

    // Récupérer les documents
    const documents = await this.prisma.studentDocument.findMany({
      where: {
        studentId,
        ...(academicYearId && { academicYearId }),
      },
      include: {
        academicYear: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Récupérer les bulletins
    const reportCards = await this.prisma.reportCard.findMany({
      where: {
        studentId,
        ...(academicYearId && { academicYearId }),
      },
      include: {
        academicYear: true,
        quarter: true,
      },
      orderBy: {
        academicYear: {
          startDate: 'desc',
        },
      },
    });

    // Récupérer les absences
    // Absence n'a pas de relation academicYear directe ni academicYearId
    const absences = await this.prisma.absence.findMany({
      where: {
        studentId,
      },
      include: {
      },
      orderBy: {
        date: 'desc',
      },
      take: 50, // Limiter à 50 dernières
    });

    // Récupérer les incidents disciplinaires
    const disciplinaryActions = await this.prisma.disciplinaryAction.findMany({
      where: {
        studentId,
        ...(academicYearId && { academicYearId }),
      },
      include: {
        academicYear: true,
      },
      orderBy: {
        actionDate: 'desc', // actionDate au lieu de date
      },
      take: 50, // Limiter à 50 derniers
    });

    // Module 1 — Parents / tuteurs (identité & relations)
    const guardians = await this.prisma.studentGuardian.findMany({
      where: { studentId },
      include: {
        guardian: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });

    // Récupérer le profil tarifaire pour l'année scolaire
    let feeProfile = null;
    if (academicYearId) {
      feeProfile = await this.prisma.studentFeeProfile.findUnique({
        where: {
          studentId_academicYearId: {
            studentId,
            academicYearId,
          },
        },
        include: {
          feeRegime: {
            include: {
              rules: true,
            },
          },
          validator: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });
    }

    // Module 1 — Identité légale complète (lieu de naissance, pièce, régime)
    return {
      identity: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        dateOfBirth: student.dateOfBirth,
        gender: student.gender,
        nationality: student.nationality,
        placeOfBirth: student.placeOfBirth ?? null,
        legalDocumentType: student.legalDocumentType ?? null,
        legalDocumentNumber: student.legalDocumentNumber ?? null,
        npi: student.npi ?? null,
        regimeType: student.regimeType ?? null,
        studentCode: student.studentCode ?? null,
        matricule: student.identifier?.globalMatricule || student.studentCode || null,
        status: student.status,
        institution: student.tenant.schools?.[0]?.name || student.tenant.name,
      },
      academicRecords,
      disciplinarySummaries,
      documents,
      reportCards,
      recentAbsences: absences,
      recentDisciplinaryActions: disciplinaryActions,
      currentIdCard: student.idCards?.[0] || null,
      feeProfile,
      guardians,
    };
  }

  /**
   * Génère un PDF consolidé "Dossier académique" pour un élève.
   * Contenu : identité, historique multi-année, classes, résultats, régime, arriérés.
   */
  async generateAcademicDossierPdf(
    tenantId: string,
    studentId: string,
    academicYearId?: string,
  ): Promise<Buffer> {
    await this.loadPuppeteer();

    if (!this.puppeteer) {
      throw new BadRequestException(
        'La génération de PDF n’est pas disponible (Puppeteer non installé). ' +
        'Veuillez installer puppeteer côté serveur.',
      );
    }

    const dossier = await this.getStudentDossier(tenantId, studentId, academicYearId);

    const title = 'Dossier académique consolidé';
    const identity = dossier.identity;

    const html = `
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>${title}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 12px; color: #111827; }
      h1, h2, h3 { color: #111827; margin-bottom: 4px; }
      h1 { font-size: 20px; }
      h2 { font-size: 16px; margin-top: 16px; }
      h3 { font-size: 14px; margin-top: 12px; }
      .section { margin-top: 12px; }
      .label { font-weight: 600; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border: 1px solid #e5e7eb; padding: 4px 6px; text-align: left; }
      th { background: #f9fafb; font-weight: 600; }
    </style>
  </head>
  <body>
    <h1>${title}</h1>
    <p class="section"><span class="label">Établissement :</span> ${identity.institution}</p>
    <div class="section">
      <h2>Identité</h2>
      <p><span class="label">Nom :</span> ${identity.lastName} ${identity.firstName}</p>
      <p><span class="label">Matricule :</span> ${identity.matricule || 'N/A'}</p>
      <p><span class="label">Statut :</span> ${identity.status}</p>
      ${identity.dateOfBirth ? `<p><span class="label">Date de naissance :</span> ${new Date(identity.dateOfBirth).toLocaleDateString('fr-FR')}</p>` : ''}
      ${identity.regimeType ? `<p><span class="label">Régime :</span> ${identity.regimeType}</p>` : ''}
    </div>

    <div class="section">
      <h2>Parcours académique</h2>
      <table>
        <thead>
          <tr>
            <th>Année</th>
            <th>Classe</th>
            <th>Niveau</th>
            <th>Moyenne</th>
            <th>Rang</th>
          </tr>
        </thead>
        <tbody>
          ${
            (dossier.academicRecords || [])
              .map((r: any) => `
                <tr>
                  <td>${r.academicYear?.label || ''}</td>
                  <td>${r.class?.name || ''}</td>
                  <td>${r.schoolLevel?.label || ''}</td>
                  <td>${r.averageScore ?? ''}</td>
                  <td>${r.rank ?? ''}</td>
                </tr>
              `)
              .join('') || '<tr><td colspan="5">Aucun enregistrement</td></tr>'
          }
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Résultats & bulletins</h2>
      <table>
        <thead>
          <tr>
            <th>Année</th>
            <th>Période</th>
            <th>Moyenne générale</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>
          ${
            (dossier.reportCards || [])
              .map((rc: any) => `
                <tr>
                  <td>${rc.academicYear?.label || ''}</td>
                  <td>${rc.quarter?.name || rc.type || ''}</td>
                  <td>${rc.overallAverage ?? ''}</td>
                  <td>${rc.status || ''}</td>
                </tr>
              `)
              .join('') || '<tr><td colspan="4">Aucun bulletin</td></tr>'
          }
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>Situation financière</h2>
      ${
        dossier.feeProfile
          ? `<p><span class="label">Régime :</span> ${dossier.feeProfile.feeRegime.label}</p>
             ${dossier.feeProfile.justification ? `<p><span class="label">Justification :</span> ${dossier.feeProfile.justification}</p>` : ''}`
          : '<p>Aucun régime spécial enregistré pour l’année sélectionnée.</p>'
      }
    </div>
  </body>
</html>
    `;

    const browser = await this.puppeteer.launch({ headless: 'new' as any });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    return pdfBuffer;
  }

  /**
   * Crée ou met à jour un enregistrement académique
   */
  async upsertAcademicRecord(
    tenantId: string,
    studentId: string,
    academicYearId: string,
    data: {
      classId?: string;
      schoolLevelId: string;
      level?: string;
      enrollmentStatus?: string;
      averageScore?: number;
      rank?: number;
      totalAbsences?: number;
      totalIncidents?: number;
      totalSanctions?: number;
      notes?: any;
    },
  ) {
    // Vérifier que l'élève existe
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId,
      },
    });

    if (!student) {
      throw new NotFoundException('Élève non trouvé');
    }

    return this.prisma.studentAcademicRecord.upsert({
      where: {
        studentId_academicYearId: {
          studentId,
          academicYearId,
        },
      },
      update: {
        ...data,
        updatedAt: new Date(),
      },
      create: {
        tenantId,
        studentId,
        academicYearId,
        schoolLevelId: data.schoolLevelId,
        classId: data.classId,
        level: data.level,
        enrollmentStatus: data.enrollmentStatus || 'ACTIVE',
        averageScore: data.averageScore ? data.averageScore : null,
        rank: data.rank || null,
        totalAbsences: data.totalAbsences || 0,
        totalIncidents: data.totalIncidents || 0,
        totalSanctions: data.totalSanctions || 0,
        notes: data.notes || null,
      },
    });
  }

  /**
   * Crée ou met à jour un résumé disciplinaire
   */
  async upsertDisciplinarySummary(
    tenantId: string,
    studentId: string,
    academicYearId: string,
    data: {
      absencesCount?: number;
      justifiedAbsences?: number;
      unjustifiedAbsences?: number;
      incidentsCount?: number;
      minorIncidents?: number;
      majorIncidents?: number;
      sanctionsCount?: number;
      warningsCount?: number;
      suspensionsCount?: number;
      expulsionsCount?: number;
      lastIncidentDate?: Date;
      lastSanctionDate?: Date;
      notes?: any;
    },
  ) {
    // Vérifier que l'élève existe
    const student = await this.prisma.student.findFirst({
      where: {
        id: studentId,
        tenantId,
      },
    });

    if (!student) {
      throw new NotFoundException('Élève non trouvé');
    }

    return this.prisma.studentDisciplinarySummary.upsert({
      where: {
        studentId_academicYearId: {
          studentId,
          academicYearId,
        },
      },
      update: {
        ...data,
        updatedAt: new Date(),
      },
      create: {
        tenantId,
        studentId,
        academicYearId,
        absencesCount: data.absencesCount || 0,
        justifiedAbsences: data.justifiedAbsences || 0,
        unjustifiedAbsences: data.unjustifiedAbsences || 0,
        incidentsCount: data.incidentsCount || 0,
        minorIncidents: data.minorIncidents || 0,
        majorIncidents: data.majorIncidents || 0,
        sanctionsCount: data.sanctionsCount || 0,
        warningsCount: data.warningsCount || 0,
        suspensionsCount: data.suspensionsCount || 0,
        expulsionsCount: data.expulsionsCount || 0,
        lastIncidentDate: data.lastIncidentDate || null,
        lastSanctionDate: data.lastSanctionDate || null,
        notes: data.notes || null,
      },
    });
  }

  /**
   * Synchronise automatiquement les résumés disciplinaires à partir des données réelles
   */
  async syncDisciplinarySummary(
    tenantId: string,
    studentId: string,
    academicYearId: string,
  ) {
    // Compter les absences
    // Absence n'a pas academicYearId directement, filtrer via student -> enrollment
    const absences = await this.prisma.absence.findMany({
      where: {
        studentId,
        // Filtrer par année scolaire via les enrollments si nécessaire
      },
    });

    const absencesCount = absences.length;
    const justifiedAbsences = absences.filter(a => a.isJustified).length;
    const unjustifiedAbsences = absencesCount - justifiedAbsences;

    // Compter les incidents et sanctions
    const disciplinaryActions = await this.prisma.disciplinaryAction.findMany({
      where: {
        studentId,
        academicYearId,
      },
    });

    const incidentsCount = disciplinaryActions.length;
    // DisciplinaryAction n'a pas severity, utiliser actionType pour catégoriser
    const minorIncidents = disciplinaryActions.filter(a => a.actionType === 'WARNING').length;
    const majorIncidents = disciplinaryActions.filter(a => ['SUSPENSION', 'EXPULSION'].includes(a.actionType)).length;

    const sanctionsCount = disciplinaryActions.filter(a => a.actionType !== 'WARNING').length;
    const warningsCount = disciplinaryActions.filter(a => a.actionType === 'WARNING').length;
    const suspensionsCount = disciplinaryActions.filter(a => a.actionType === 'SUSPENSION').length;
    const expulsionsCount = disciplinaryActions.filter(a => a.actionType === 'EXPULSION').length;

    const lastIncident = disciplinaryActions.length > 0
      ? disciplinaryActions.sort((a, b) => new Date(b.actionDate).getTime() - new Date(a.actionDate).getTime())[0]
      : null;

    return this.upsertDisciplinarySummary(tenantId, studentId, academicYearId, {
      absencesCount,
      justifiedAbsences,
      unjustifiedAbsences,
      incidentsCount,
      minorIncidents,
      majorIncidents,
      sanctionsCount,
      warningsCount,
      suspensionsCount,
      expulsionsCount,
      lastIncidentDate: lastIncident?.actionDate || null,
      lastSanctionDate: lastIncident?.actionDate || null,
    });
  }
}

