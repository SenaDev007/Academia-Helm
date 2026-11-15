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
import { PuppeteerPoolService } from '../../common/services/puppeteer-pool.service';

@Injectable()
export class StudentDossierService {
  private readonly logger = new Logger(StudentDossierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
  ) {}

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
            schools: true,
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
            // ⭐ 1.0.10 — adresse du responsable (dossier complet + PDF)
            address: true,
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

    // ⭐ 1.0.10 (refonte « dossier numérique de l'élève » — demande promoteur) :
    // PARCOURS RÉEL année par année — toutes les inscriptions de l'élève dans
    // l'établissement (année, niveau, classe officielle + section physique,
    // statut, dates, matricule local, type nouveau/ancien).
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { studentId },
      include: {
        academicYear: true,
        schoolLevel: true,
        class: true,
        academicClass: true,
      },
      orderBy: { academicYear: { startDate: 'desc' } },
    });

    // ⭐ 1.0.10 — ÉCOLE D'ORIGINE : l'admission convertie en dossier élève
    // porte previousSchool / previousLevel / changeReason (cursus hors
    // établissement) — remontée ici pour tracer le parcours complet.
    const originatingAdmission = await this.prisma.admission.findFirst({
      where: { convertedStudentId: studentId, tenantId },
      select: {
        admissionNumber: true,
        applicationDate: true,
        previousSchool: true,
        previousLevel: true,
        changeReason: true,
        isNewStudent: true,
      },
    });

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
        npi: student.npi ?? null,
        regimeType: student.regimeType ?? null,
        studentCode: student.studentCode ?? null,
        matricule: student.identifier?.globalMatricule || student.studentCode || null,
        status: student.status,
        address: student.address ?? null,
        photoUrl: student.photoUrl ?? null,
        institution: student.tenant.schools?.name || student.tenant.name,
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
      // ⭐ 1.0.10 — parcours réel + école d'origine (dossier numérique complet)
      studentEnrollments: enrollments,
      originatingAdmission,
    };
  }

  /**
   * ⭐ 1.0.10 (refonte « dossier numérique de l'élève » — demande promoteur) :
   * génère le DOSSIER SCOLAIRE COMPLET en PDF (imprimable / transférable),
   * structuré à la manière des dossiers scolaires européens :
   *   I.   Identité & situation administrative
   *   II.  Responsables légaux
   *   III. Parcours dans l'établissement (année par année) + école d'origine
   *   IV.  Résultats & bulletins (par année / période)
   *   V.   Assiduité & discipline
   *   VI.  Documents du dossier
   *   VII. Carte scolaire
   */
  async generateAcademicDossierPdf(
    tenantId: string,
    studentId: string,
    academicYearId?: string,
  ): Promise<Buffer> {
    const d = await this.getStudentDossier(tenantId, studentId, academicYearId);
    const idn = d.identity;

    // ── Helpers d'affichage ──
    const esc = (v: unknown): string =>
      String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const dfmt = (v?: Date | string | null): string =>
      v ? new Date(v).toLocaleDateString('fr-FR') : '—';
    const regLabel = (r?: string | null): string =>
      r === 'TEACHER_CHILD'
        ? 'Enfant enseignant'
        : r === 'SCHOLARSHIP'
          ? 'Boursier'
          : r === 'SPECIAL'
            ? 'Spécial'
            : 'Normal';
    const statusLabel: Record<string, string> = {
      ACTIVE: 'Actif', PRE_REGISTERED: 'Pré-inscrit', ADMITTED: 'Admis',
      ARCHIVED: 'Archivé', WITHDRAWN: 'Retiré', EXCLUDED: 'Exclu',
      INACTIVE: 'Inactif', PENDING: 'En attente',
    };
    const enrTypeLabel: Record<string, string> = {
      NEW: 'Nouvel élève', REPEAT: 'Ancien élève (réinscription)',
    };
    const rcStatusLabel: Record<string, string> = {
      DRAFT: 'Projet', PUBLISHED: 'Publié', VALIDATED: 'Validé',
      DIRECTOR_SIGNED: 'Signé (direction)', TEACHER_DISTRIBUTED: 'Distribué',
      TEACHER_SIGNED: 'Signé (enseignant)', PARENT_SENT: 'Envoyé aux parents',
    };
    const docTypeLabel: Record<string, string> = {
      BIRTH_CERTIFICATE: 'Acte de naissance', NPI_CARD: 'Carte NPI',
      SCHOOL_CERTIFICATE: 'Certificat de scolarité', PHOTO: "Photo d'identité",
      PREVIOUS_REPORT_CARD: 'Bulletin précédent', MEDICAL_RECORD: 'Fiche médicale',
      PARENTAL_AUTHORIZATION: 'Autorisation parentale',
      TRANSFER_CERTIFICATE: 'Certificat de transfert', OTHER: 'Autre document',
    };

    const guardiansRows =
      (d.guardians || [])
        .map(
          (sg: any) => `
        <tr>
          <td>${esc(sg.guardian?.lastName)} ${esc(sg.guardian?.firstName)}${sg.isPrimary ? ' <b>(principal)</b>' : ''}</td>
          <td>${esc(sg.relationship)}</td>
          <td>${esc(sg.guardian?.phone) || '—'}</td>
          <td>${esc(sg.guardian?.email) || '—'}</td>
          <td>${esc(sg.guardian?.address) || '—'}</td>
        </tr>`,
        )
        .join('') ||
      `<tr><td colspan="5" class="empty">Aucun responsable légal enregistré</td></tr>`;

    const enrollmentsRows =
      (d.studentEnrollments || [])
        .map(
          (e: any) => `
        <tr>
          <td>${esc(e.academicYear?.name || e.academicYear?.label)}</td>
          <td>${esc(e.schoolLevel?.name || e.schoolLevel?.label)}</td>
          <td>${esc(e.academicClass?.name || e.class?.name || 'Non affectée')}</td>
          <td>${esc(enrTypeLabel[e.enrollmentType] || e.enrollmentType)}</td>
          <td>${esc(statusLabel[e.status] || e.status)}</td>
          <td>${dfmt(e.enrollmentDate)}</td>
        </tr>`,
        )
        .join('') ||
      `<tr><td colspan="6" class="empty">Aucune inscription enregistrée</td></tr>`;

    const reportCardsRows =
      (d.reportCards || [])
        .map(
          (rc: any) => `
        <tr>
          <td>${esc(rc.academicYear?.name || rc.academicYear?.label)}</td>
          <td>${esc(rc.quarter?.name || rc.type)}</td>
          <td class="num">${rc.overallAverage != null ? Number(rc.overallAverage).toFixed(2) : '—'}</td>
          <td class="num">${rc.rank != null ? esc(rc.rank) : '—'}</td>
          <td>${esc(rcStatusLabel[rc.status] || rc.status)}</td>
        </tr>`,
        )
        .join('') ||
      `<tr><td colspan="5" class="empty">Aucun bulletin enregistré</td></tr>`;

    const academicRecordsRows =
      (d.academicRecords || [])
        .map(
          (r: any) => `
        <tr>
          <td>${esc(r.academicYear?.name || r.academicYear?.label)}</td>
          <td>${esc(r.class?.name || r.schoolLevel?.name || '')}</td>
          <td class="num">${r.averageScore != null ? Number(r.averageScore).toFixed(2) : '—'}</td>
          <td class="num">${r.rank != null ? esc(r.rank) : '—'}</td>
          <td class="num">${esc(r.totalAbsences ?? 0)}</td>
          <td class="num">${esc(r.totalIncidents ?? 0)}</td>
        </tr>`,
        )
        .join('');

    const academicRecordsBlock = academicRecordsRows
      ? `
    <div class="subsection">
      <h3>IV.2. Synthèse annuelle enregistrée</h3>
      <table>
        <thead>
          <tr><th>Année</th><th>Classe</th><th>Moyenne</th><th>Rang</th><th>Absences</th><th>Incidents</th></tr>
        </thead>
        <tbody>${academicRecordsRows}</tbody>
      </table>
    </div>`
      : '';

    const disciplinaryRows =
      (d.disciplinarySummaries || [])
        .map(
          (s: any) => `
        <tr>
          <td>${esc(s.academicYear?.name || s.academicYear?.label)}</td>
          <td class="num">${esc(s.absencesCount ?? 0)}</td>
          <td class="num">${esc(s.unjustifiedAbsences ?? 0)}</td>
          <td class="num">${esc(s.incidentsCount ?? 0)}</td>
          <td class="num">${esc(s.sanctionsCount ?? 0)}</td>
          <td class="num">${esc(s.suspensionsCount ?? 0)}</td>
        </tr>`,
        )
        .join('');

    const disciplinaryBlock = disciplinaryRows
      ? `
    <div class="subsection">
      <h3>V.2. Synthèse par année scolaire</h3>
      <table>
        <thead>
          <tr><th>Année</th><th>Absences</th><th>Absences non justifiées</th><th>Incidents</th><th>Sanctions</th><th>Suspensions</th></tr>
        </thead>
        <tbody>${disciplinaryRows}</tbody>
      </table>
    </div>`
      : '';

    const lastAbsencesRows =
      (d.recentAbsences || [])
        .slice(0, 15)
        .map(
          (a: any) => `
        <tr>
          <td>${dfmt(a.date)}</td>
          <td>${esc(a.absenceType || a.type || 'Absence')}</td>
          <td>${a.isJustified ? 'Justifiée' : 'Non justifiée'}</td>
          <td>${esc(a.reason) || '—'}</td>
        </tr>`,
        )
        .join('');

    const lastAbsencesBlock = lastAbsencesRows
      ? `
    <div class="subsection">
      <h3>V.3. Dernières absences (15 max)</h3>
      <table>
        <thead><tr><th>Date</th><th>Type</th><th>Justification</th><th>Motif</th></tr></thead>
        <tbody>${lastAbsencesRows}</tbody>
      </table>
    </div>`
      : '';

    const documentsRows =
      (d.documents || [])
        .map(
          (doc: any) => `
        <tr>
          <td>${esc(docTypeLabel[doc.documentType] || doc.documentType)}</td>
          <td>${esc(doc.fileName)}</td>
          <td>${dfmt(doc.createdAt)}</td>
        </tr>`,
        )
        .join('') ||
      `<tr><td colspan="3" class="empty">Aucun document dans le dossier</td></tr>`;

    const oa = d.originatingAdmission;
    const previousSchoolBlock = oa
      ? `
    <div class="subsection">
      <h3>III.2. École d'origine (avant l'entrée dans l'établissement)</h3>
      <table>
        <tbody>
          <tr><th>École d'origine</th><td>${esc(oa.previousSchool) || 'Non renseignée'}</td></tr>
          <tr><th>Niveau précédent</th><td>${esc(oa.previousLevel) || '—'}</td></tr>
          <tr><th>Motif du changement</th><td>${esc(oa.changeReason) || '—'}</td></tr>
          <tr><th>Candidature d'origine</th><td>${esc(oa.admissionNumber) || '—'} (${dfmt(oa.applicationDate)})</td></tr>
        </tbody>
      </table>
    </div>`
      : '';

    const card = d.currentIdCard;
    const cardBlock = `
    <div class="section">
      <h2>VII. Carte scolaire</h2>
      <table>
        <tbody>
          <tr><th>Numéro de carte</th><td>${card ? esc(card.cardNumber) : 'Non générée'}</td></tr>
          <tr><th>Émise le</th><td>${card ? dfmt(card.generatedAt) : '—'}</td></tr>
          <tr><th>Valide jusqu'au</th><td>${card ? dfmt(card.validUntil) : '—'}</td></tr>
        </tbody>
      </table>
    </div>`;

    const yearName =
      (d.studentEnrollments || [])[0]?.academicYear?.name ||
      (d.studentEnrollments || [])[0]?.academicYear?.label ||
      '';

    const html = `
<!DOCTYPE html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <title>Dossier scolaire — ${esc(idn.lastName)} ${esc(idn.firstName)}</title>
    <style>
      @page { size: A4; margin: 14mm 12mm; }
      body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10.5px; color: #1e293b; }
      .doc-header { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #0d1f6e; padding-bottom: 10px; margin-bottom: 14px; }
      .doc-header .logo { width: 46px; height: 46px; border-radius: 50%; border: 2px solid #0d1f6e; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #0d1f6e; font-size: 16px; }
      .doc-header h1 { font-size: 16px; margin: 0; color: #0d1f6e; text-transform: uppercase; letter-spacing: 0.5px; }
      .doc-header .sub { font-size: 10px; color: #475569; margin-top: 2px; }
      .doc-header .right { margin-left: auto; text-align: right; font-size: 9px; color: #64748b; }
      h2 { font-size: 12px; color: #0d1f6e; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; margin: 16px 0 6px; text-transform: uppercase; letter-spacing: 0.4px; }
      h3 { font-size: 10.5px; color: #334155; margin: 10px 0 4px; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border: 1px solid #cbd5e1; padding: 3.5px 6px; text-align: left; vertical-align: top; }
      thead th { background: #eef2f7; font-weight: 700; color: #0d1f6e; }
      tbody th { background: #f8fafc; font-weight: 600; width: 34%; color: #334155; }
      td.num { text-align: center; }
      td.empty, tr.empty td { text-align: center; color: #94a3b8; font-style: italic; }
      .kv { display: grid; grid-template-columns: 1fr 1fr; gap: 0 18px; }
      .kv table { margin-bottom: 0; }
      .footer { margin-top: 18px; padding-top: 8px; border-top: 1px solid #cbd5e1; display: flex; justify-content: space-between; font-size: 8.5px; color: #64748b; }
      .section { page-break-inside: avoid; }
      .subsection { page-break-inside: avoid; margin-top: 8px; }
    </style>
  </head>
  <body>
    <div class="doc-header">
      <div class="logo">AH</div>
      <div>
        <h1>${esc(idn.institution)}</h1>
        <div class="sub">Dossier scolaire de l'élève — document officiel interne</div>
      </div>
      <div class="right">
        Année scolaire : ${esc(yearName) || '—'}<br/>
        Édité le ${new Date().toLocaleDateString('fr-FR')}
      </div>
    </div>

    <div class="section">
      <h2>I. Identité &amp; situation administrative</h2>
      <div class="kv">
        <table>
          <tbody>
            <tr><th>Nom / Prénom</th><td><b>${esc(idn.lastName)} ${esc(idn.firstName)}</b></td></tr>
            <tr><th>Matricule</th><td>${esc(idn.matricule) || '—'}</td></tr>
            <tr><th>Date de naissance</th><td>${dfmt(idn.dateOfBirth)}</td></tr>
            <tr><th>Lieu de naissance</th><td>${esc(idn.placeOfBirth) || '—'}</td></tr>
            <tr><th>Sexe</th><td>${idn.gender === 'M' ? 'Masculin' : idn.gender === 'F' ? 'Féminin' : '—'}</td></tr>
            <tr><th>Nationalité</th><td>${esc(idn.nationality) || '—'}</td></tr>
          </tbody>
        </table>
        <table>
          <tbody>
            <tr><th>NPI</th><td>${esc(idn.npi) || 'Non renseigné'}</td></tr>
            <tr><th>Statut</th><td>${esc(statusLabel[idn.status] || idn.status)}</td></tr>
            <tr><th>Régime scolaire</th><td>${esc(regLabel(idn.regimeType))}</td></tr>
            <tr><th>Adresse</th><td>${esc(idn.address) || '—'}</td></tr>
            <tr><th>N° de dossier</th><td>${esc(idn.studentCode) || esc(idn.matricule) || '—'}</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="section">
      <h2>II. Responsables légaux</h2>
      <table>
        <thead>
          <tr><th>Nom</th><th>Lien de parenté</th><th>Téléphone</th><th>Email</th><th>Adresse</th></tr>
        </thead>
        <tbody>${guardiansRows}</tbody>
      </table>
    </div>

    <div class="section">
      <h2>III. Parcours dans l'établissement</h2>
      <div class="subsection">
        <h3>III.1. Inscriptions année par année</h3>
        <table>
          <thead>
            <tr><th>Année scolaire</th><th>Niveau</th><th>Classe</th><th>Type</th><th>Statut</th><th>Date d'inscription</th></tr>
          </thead>
          <tbody>${enrollmentsRows}</tbody>
        </table>
      </div>
      ${previousSchoolBlock}
    </div>

    <div class="section">
      <h2>IV. Résultats &amp; bulletins</h2>
      <div class="subsection">
        <h3>IV.1. Bulletins par année et période</h3>
        <table>
          <thead>
            <tr><th>Année</th><th>Période</th><th>Moyenne générale</th><th>Rang</th><th>Statut</th></tr>
          </thead>
          <tbody>${reportCardsRows}</tbody>
        </table>
      </div>
      ${academicRecordsBlock}
    </div>

    <div class="section">
      <h2>V. Assiduité &amp; discipline</h2>
      ${disciplinaryBlock}
      ${lastAbsencesBlock}
      ${
        !disciplinaryRows && !lastAbsencesRows
          ? '<p class="empty" style="color:#94a3b8;font-style:italic;text-align:center;">Aucun événement d\'assiduité ou de discipline enregistré.</p>'
          : ''
      }
    </div>

    <div class="section">
      <h2>VI. Documents du dossier</h2>
      <table>
        <thead><tr><th>Type de document</th><th>Fichier</th><th>Déposé le</th></tr></thead>
        <tbody>${documentsRows}</tbody>
      </table>
    </div>

    ${cardBlock}

    <div class="footer">
      <span>${esc(idn.institution)} — Dossier généré par Academia Helm (système de gestion scolaire)</span>
      <span>Élève : ${esc(idn.lastName)} ${esc(idn.firstName)} · ${esc(idn.matricule) || 'sans matricule'}</span>
    </div>
  </body>
</html>
    `;

    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
      return pdfBuffer;
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
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

