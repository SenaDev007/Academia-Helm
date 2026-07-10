/**
 * ============================================================================
 * STUDENT ID CARD SERVICE - MODULE 1
 * ============================================================================
 * 
 * Service pour génération de cartes d'identité scolaires officielles
 * Format PDF/PNG avec QR Code vérifiable
 * 
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StudentIdentifierService } from './student-identifier.service';
import { PuppeteerPoolService } from '../../common/services/puppeteer-pool.service';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as QRCode from 'qrcode';

@Injectable()
export class StudentIdCardService {
  private readonly logger = new Logger(StudentIdCardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly identifierService: StudentIdentifierService,
    private readonly puppeteerPool: PuppeteerPoolService,
  ) {}

  /**
   * Génère une carte d'identité scolaire officielle pour un élève
   * Règle : Une carte par année scolaire (historique conservé)
   */
  async generateIdCard(
    tenantId: string,
    academicYearId: string,
    schoolLevelId: string,
    studentId: string,
    generatedBy?: string,
  ) {
    // Vérifier que l'élève existe
    const student = await this.prisma.student.findFirst({
      where: { id: studentId, tenantId },
      include: {
        tenant: true,
        academicYear: true,
        schoolLevel: true,
        identifier: true,
        studentEnrollments: {
          where: {
            academicYearId,
            // ⚠️ Inclure plusieurs statuts possibles (ACTIVE, ADMITTED, ENROLLED)
            // car selon le workflow d'admission, le statut peut varier.
            status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED', 'PRE_REGISTERED'] },
          },
          include: {
            class: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${studentId} not found`);
    }

    // Vérifier que l'élève a un matricule global
    if (!student.identifier) {
      throw new BadRequestException(
        `Student must have a global matricule before generating ID card. Please generate matricule first.`,
      );
    }

    if (student.identifier.isOfflineGenerated && !student.identifier.synchronizedAt) {
      throw new BadRequestException(
        `Student has a temporary matricule. Please synchronize to get definitive matricule before generating ID card.`,
      );
    }

    // Vérifier qu'il n'y a pas déjà une carte pour cette année
    const existingCard = await this.prisma.studentIdCard.findFirst({
      where: {
        tenantId,
        academicYearId,
        studentId,
      },
    });

    if (existingCard && existingCard.isActive && !existingCard.isRevoked) {
      throw new BadRequestException(
        `Active ID card already exists for student ${studentId} in academic year ${academicYearId}`,
      );
    }

    // Générer le numéro de carte unique
    const cardNumber = await this.generateCardNumber(tenantId, academicYearId);

    // Générer le QR Code payload (matricule + tenant + hash de vérification)
    const qrPayload = this.generateQRPayload(
      student.identifier.globalMatricule,
      tenantId,
      studentId,
    );

    const qrHash = crypto
      .createHash('sha256')
      .update(qrPayload)
      .digest('hex')
      .substring(0, 16)
      .toUpperCase();

    // Récupérer la classe actuelle
    const currentClass = student.studentEnrollments[0]?.class;

    // Générer le HTML de la carte (face avant + arrière)
    const cardHtml = await this.generateCardHtml(student, currentClass, student.identifier.globalMatricule, qrPayload);

    // Générer le PDF
    let pdfPath: string | null = null;
    let frontImagePath: string | null = null;
    let backImagePath: string | null = null;

    try {
      const pdfBuffer = await this.renderPdfFromHtml(cardHtml);
      pdfPath = await this.savePdf(tenantId, academicYearId, cardNumber, pdfBuffer);

      // Extraire les images (face avant et arrière) depuis le PDF si nécessaire
      // Pour l'instant, on sauvegarde juste le PDF complet
    } catch (error) {
      this.logger.warn('PDF generation failed, skipping: ' + (error as Error).message);
    }

    // Date de validité : fin de l'année scolaire si définie, sinon +1 an à partir du début
    // ⚠️ Fix bug : avant, on ajoutait 1 an même si endDate existait (double extension)
    let validUntil: Date;
    if (student.academicYear.endDate) {
      validUntil = new Date(student.academicYear.endDate);
    } else {
      validUntil = new Date(student.academicYear.startDate);
      validUntil.setFullYear(validUntil.getFullYear() + 1);
    }

    // Créer la carte dans la base
    const idCard = await this.prisma.studentIdCard.create({
      data: {
        tenantId,
        academicYearId,
        schoolLevelId,
        studentId,
        cardNumber,
        qrPayload,
        qrHash,
        pdfPath,
        frontImagePath,
        backImagePath,
        validUntil,
        generatedBy,
        isActive: true,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
          },
        },
        generator: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    this.logger.log(`Generated ID card ${cardNumber} for student ${studentId}`);

    return idCard;
  }

  /**
   * Génère des cartes par lot (classe, niveau, ou TOUS les niveaux)
   *
   * ⭐ Si schoolLevelId n'est pas fourni (ou est 'ALL'), génère pour TOUS les
   * élèves actifs du tenant pour l'année, tous niveaux confondus.
   * C'est le comportement attendu quand l'admin clique sur "Générer les cartes"
   * sans vouloir filtrer par niveau.
   */
  async generateBulkIdCards(
    tenantId: string,
    academicYearId: string,
    schoolLevelId?: string,
    filters?: {
      classId?: string;
      status?: string;
    },
    generatedBy?: string,
  ) {
    const where: any = {
      tenantId,
      academicYearId,
      status: 'ACTIVE',
    };
    // ⭐ Ne filtrer par schoolLevelId que s'il est fourni ET différent de 'ALL'
    if (schoolLevelId && schoolLevelId !== 'ALL') {
      where.schoolLevelId = schoolLevelId;
    }

    const students = await this.prisma.student.findMany({
      where,
      include: {
        identifier: {
          where: {
            isOfflineGenerated: false,
          },
        },
        studentEnrollments: {
          where: {
            academicYearId,
            status: 'ACTIVE',
            ...(filters?.classId && { classId: filters.classId }),
          },
          include: {
            class: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    // Filtrer les élèves qui ont déjà une carte active
    const cardsForYear = await this.prisma.studentIdCard.findMany({
      where: {
        tenantId,
        academicYearId,
        isActive: true,
        isRevoked: false,
      },
      select: {
        studentId: true,
      },
    });

    const studentsWithCardIds = new Set(cardsForYear.map((c) => c.studentId));

    const studentsWithoutCard = students.filter((student) => {
      return !studentsWithCardIds.has(student.id) && student.identifier && !student.identifier.isOfflineGenerated;
    });

    // ⚠️ TRAITEMENT SÉQUENTIEL (pas Promise.allSettled) :
    // Le pool Puppeteer limite à MAX_CONCURRENT_PAGES = 3 pages simultanées.
    // Avec Promise.allSettled, toutes les générations étaient lancées en parallèle,
    // saturant le pool → les autres génération timeout/échouaient silencieusement
    // → résultat : 1 carte générée sur N élèves.
    // On traite maintenant une carte à la fois (plus lent mais fiable).
    const results: Array<{ status: 'fulfilled' | 'rejected'; value?: any; reason?: any }> = [];
    for (const student of studentsWithoutCard) {
      try {
        const card = await this.generateIdCard(tenantId, academicYearId, student.schoolLevelId, student.id, generatedBy);
        results.push({ status: 'fulfilled', value: card });
      } catch (e: any) {
        this.logger.error(`Generate card for ${student.firstName} ${student.lastName} (${student.id}): ${e.message}`);
        results.push({ status: 'rejected', reason: e });
      }
    }

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return {
      total: studentsWithoutCard.length,
      succeeded,
      failed,
      results: results.map((r, index) => ({
        student: studentsWithoutCard[index],
        status: r.status,
        ...(r.status === 'rejected' && { error: r.reason?.message || String(r.reason) }),
        ...(r.status === 'fulfilled' && { card: r.value }),
      })),
    };
  }

  /**
   * ⭐ Liste les cartes groupées par niveau scolaire puis par classe.
   * Retourne une structure hiérarchique pour l'affichage dans l'UI.
   */
  async listCardsGroupedByClass(
    tenantId: string,
    academicYearId: string,
  ) {
    // Récupérer toutes les cartes de l'année
    const cards = await this.prisma.studentIdCard.findMany({
      where: { tenantId, academicYearId },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            matricule: true,
            studentCode: true,
            photoUrl: true,
            dateOfBirth: true,
            gender: true,
            studentGuardians: {
              where: { isPrimary: true },
              take: 1,
              include: { guardian: { select: { firstName: true, lastName: true, phone: true, email: true, address: true } } },
            },
          },
        },
        academicYear: { select: { id: true, name: true, startDate: true, endDate: true } },
        schoolLevel: { select: { id: true, name: true, code: true, label: true } },
      },
      orderBy: { student: { lastName: 'asc' } },
    });

    // Récupérer les classes de chaque élève (via enrollment)
    const studentIds = cards.map(c => c.studentId);
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { tenantId, academicYearId, studentId: { in: studentIds } },
      include: { class: { select: { id: true, name: true } } },
    });
    const studentClassMap = new Map<string, { id: string; name: string }>();
    enrollments.forEach(e => {
      if (e.class) studentClassMap.set(e.studentId, e.class);
    });

    // Grouper par niveau → classe
    const byLevel = new Map<string, { level: any; classes: Map<string, { class: any; cards: any[] }> }>();

    cards.forEach(card => {
      const level = card.schoolLevel;
      const cls = studentClassMap.get(card.studentId) || { id: 'no-class', name: 'Non affecté' };
      if (!level) return;

      const levelKey = level.id;
      if (!byLevel.has(levelKey)) {
        byLevel.set(levelKey, { level, classes: new Map() });
      }
      const levelEntry = byLevel.get(levelKey)!;
      const classKey = cls.id;
      if (!levelEntry.classes.has(classKey)) {
        levelEntry.classes.set(classKey, { class: cls, cards: [] });
      }
      levelEntry.classes.get(classKey)!.cards.push({
        id: card.id,
        cardNumber: card.cardNumber,
        isActive: card.isActive,
        isRevoked: card.isRevoked,
        generatedAt: card.generatedAt,
        validUntil: card.validUntil,
        pdfPath: card.pdfPath,
        student: {
          id: card.student.id,
          firstName: card.student.firstName,
          lastName: card.student.lastName,
          matricule: card.student.matricule,
          studentCode: (card.student as any).studentCode,
          photoUrl: card.student.photoUrl,
          dateOfBirth: card.student.dateOfBirth,
          gender: card.student.gender,
        },
        // ⭐ Infos du parent/tuteur principal (pour affichage sur la carte)
        guardian: card.student.studentGuardians?.[0]?.guardian
          ? {
              firstName: card.student.studentGuardians[0].guardian.firstName || '',
              lastName: card.student.studentGuardians[0].guardian.lastName || '',
              phone: card.student.studentGuardians[0].guardian.phone || '',
              address: (card.student.studentGuardians[0].guardian as any).address || '',
            }
          : null,
        className: cls.name,
        levelName: level.label || level.name || level.code,
        levelCode: level.code || '',
      });
    });

    // Convertir Maps en arrays triés
    const result = Array.from(byLevel.values())
      .sort((a, b) => (a.level.code || '').localeCompare(b.level.code || ''))
      .map(entry => ({
        level: {
          id: entry.level.id,
          name: entry.level.label || entry.level.name || entry.level.code,
          code: entry.level.code,
        },
        classes: Array.from(entry.classes.values())
          .sort((a, b) => a.class.name.localeCompare(b.class.name))
          .map(c => ({
            class: c.class,
            cardsCount: c.cards.length,
            activeCount: c.cards.filter(card => card.isActive && !card.isRevoked).length,
            cards: c.cards,
          })),
      }));

    return { academicYearId, levels: result, totalCards: cards.length };
  }

  /**
   * ⭐ Génère un PDF groupé contenant toutes les cartes d'une classe.
   * Toutes les cartes (recto + verso) sont mises les unes sous les autres
   * dans un seul PDF A4.
   */
  async generateClassBundlePdf(
    tenantId: string,
    academicYearId: string,
    classId: string,
  ): Promise<{ buffer: Buffer; className: string; cardsCount: number }> {
    // Récupérer les inscriptions de cette classe
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { tenantId, academicYearId, classId, status: { in: ['ENROLLED', 'ACTIVE', 'PRE_REGISTERED'] } },
      include: {
        student: {
          include: {
            identifier: { where: { isOfflineGenerated: false } },
            studentGuardians: {
              where: { isPrimary: true },
              take: 1,
              include: { guardian: true },
            },
            academicYear: { select: { id: true, name: true, startDate: true, endDate: true } },
            schoolLevel: { select: { id: true, name: true, code: true, label: true } },
            tenant: true,
          },
        },
        class: { select: { id: true, name: true } },
      },
      orderBy: { student: { lastName: 'asc' } },
    });

    if (enrollments.length === 0) {
      throw new NotFoundException('Aucun élève trouvé dans cette classe');
    }

    // Pour chaque élève, générer le HTML de sa carte (avec QR code + photo)
    const cardHtmls: string[] = [];
    let className = enrollments[0]?.class?.name || 'Classe';

    for (const enr of enrollments) {
      const student = enr.student;
      if (!student.identifier?.globalMatricule) continue;

      const qrPayload = this.generateQRPayload(student.identifier.globalMatricule, tenantId, student.id);
      const cardHtml = await this.generateCardHtml(student, enr.class, student.identifier.globalMatricule, qrPayload);
      // Extraire uniquement le contenu de <body>...</body> (la card-container)
      const bodyMatch = cardHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) {
        cardHtmls.push(bodyMatch[1]);
      }
    }

    if (cardHtmls.length === 0) {
      throw new NotFoundException('Aucune carte à générer pour cette classe');
    }

    // Construire le HTML complet avec toutes les cartes
    const fullHtml = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Cartes Scolaires - ${className}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .bundle-header {
      text-align: center;
      padding: 8mm 0 4mm;
      font-size: 14pt;
      font-weight: bold;
      color: #0D1F6E;
      border-bottom: 2px solid #0D1F6E;
      margin-bottom: 4mm;
    }
    .bundle-subtitle {
      text-align: center;
      font-size: 10pt;
      color: #6b7280;
      margin-top: 2mm;
    }
    .card-container {
      display: flex;
      gap: 6mm;
      page-break-inside: avoid;
      margin: 4mm auto;
      max-width: 180mm;
    }
    @media print {
      .card-container { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="bundle-header">
    Cartes Scolaires — ${className}
    <div class="bundle-subtitle">${cardHtmls.length} élève(s) · Academia Helm</div>
  </div>
  ${cardHtmls.join('\n')}
</body>
</html>
    `;

    // Convertir en PDF via Puppeteer
    const buffer = await this.renderPdfFromHtml(fullHtml);
    return { buffer, className, cardsCount: cardHtmls.length };
  }

  /**
   * ⭐ Récupère la carte d'un élève pour une année scolaire
   */
  async getStudentIdCard(
    studentId: string,
    tenantId: string,
    academicYearId: string,
  ) {
    const card = await this.prisma.studentIdCard.findFirst({
      where: {
        studentId,
        tenantId,
        academicYearId,
        isActive: true,
        isRevoked: false,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            dateOfBirth: true,
            gender: true,
            identifier: true,
          },
        },
        academicYear: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
          },
        },
        schoolLevel: {
          select: {
            id: true,
            code: true,
            label: true,
          },
        },
      },
    });

    if (!card) {
      throw new NotFoundException(
        `No active ID card found for student ${studentId} in academic year ${academicYearId}`,
      );
    }

    return card;
  }

  /**
   * Récupère toutes les cartes d'un élève (historique)
   */
  async getStudentIdCardsHistory(studentId: string, tenantId: string) {
    return this.prisma.studentIdCard.findMany({
      where: { studentId, tenantId },
      include: {
        academicYear: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
          },
        },
        schoolLevel: {
          select: {
            id: true,
            code: true,
            label: true,
          },
        },
      },
      orderBy: { academicYear: { startDate: 'desc' } },
    });
  }

  /**
   * Révoque une carte (perdue, volée, etc.)
   */
  async revokeIdCard(
    cardId: string,
    tenantId: string,
    revokedBy: string,
    reason: string,
  ) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Revocation reason is mandatory');
    }

    const card = await this.prisma.studentIdCard.findFirst({
      where: { id: cardId, tenantId, isActive: true },
    });

    if (!card) {
      throw new NotFoundException(`Active ID card with ID ${cardId} not found`);
    }

    return this.prisma.studentIdCard.update({
      where: { id: cardId },
      data: {
        isActive: false,
        isRevoked: true,
        revokedAt: new Date(),
        revokedBy,
        revocationReason: reason,
      },
    });
  }

  /**
   * ⭐ Génère le HTML de prévisualisation d'une carte existante (recto + verso).
   * Utilisé pour afficher la carte visuellement dans l'UI (iframe).
   */
  async getCardPreviewHtml(cardId: string, tenantId: string): Promise<string> {
    const card = await this.prisma.studentIdCard.findFirst({
      where: { id: cardId, tenantId },
      include: {
        student: {
          include: {
            tenant: true,
            academicYear: { select: { id: true, name: true, startDate: true, endDate: true } },
            schoolLevel: { select: { id: true, name: true, code: true, label: true } },
            identifier: { where: { isOfflineGenerated: false } },
            studentGuardians: {
              where: { isPrimary: true },
              take: 1,
              include: { guardian: true },
            },
          },
        },
      },
    });

    if (!card) {
      throw new NotFoundException(`Carte ${cardId} introuvable`);
    }

    // Récupérer la classe actuelle de l'élève (multi-statut pour couvrir tous les workflows)
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: {
        tenantId,
        academicYearId: card.academicYearId,
        studentId: card.studentId,
        status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED', 'PRE_REGISTERED'] },
      },
      include: { class: { select: { id: true, name: true } } },
    });

    const student = card.student as any;
    student.academicYear = student.academicYear || card.academicYear;
    student.schoolLevel = student.schoolLevel || card.schoolLevel;
    // Si l'élève n'a pas d'enrollment chargé, on l'ajoute manuellement
    if (!student.studentEnrollments) {
      student.studentEnrollments = enrollment ? [{ class: enrollment.class }] : [];
    }
    // S'assurer que l'identifier est présent
    if (!student.identifier && (student as any).StudentIdentifier) {
      student.identifier = (student as any).StudentIdentifier;
    }

    const matricule = student.identifier?.globalMatricule || card.qrPayload.split(':')[1] || card.cardNumber;
    const currentClass = enrollment?.class;
    return await this.generateCardHtml(student, currentClass, matricule, card.qrPayload);
  }

  /**
   * Télécharge le PDF d'une carte
   */
  async downloadIdCardPdf(cardId: string, tenantId: string): Promise<Buffer | null> {
    const card = await this.prisma.studentIdCard.findFirst({
      where: { id: cardId, tenantId },
    });

    if (!card?.pdfPath) {
      throw new NotFoundException(`PDF file not found for card ${cardId}`);
    }

    if (!fs.existsSync(card.pdfPath)) {
      throw new NotFoundException(`PDF file not found on filesystem: ${card.pdfPath}`);
    }

    return fs.readFileSync(card.pdfPath);
  }

  /**
   * Vérifie un QR Code de carte (validation d'intégrité)
   */
  async verifyQRCode(qrPayload: string, qrHash: string): Promise<boolean> {
    const computedHash = crypto
      .createHash('sha256')
      .update(qrPayload)
      .digest('hex')
      .substring(0, 16)
      .toUpperCase();

    if (computedHash !== qrHash.toUpperCase()) {
      return false;
    }

    // Vérifier que la carte existe et est active
    const card = await this.prisma.studentIdCard.findFirst({
      where: {
        qrPayload,
        qrHash: qrHash.toUpperCase(),
        isActive: true,
        isRevoked: false,
      },
      include: {
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
      },
    });

    return !!card && card.student.status === 'ACTIVE';
  }

  /**
   * Génère le HTML d'UNE carte (recto + verso côte à côte, format paysage).
   * Design inspiré du template fourni : bandeau bleu marine en-tête + pied,
   * photo à gauche, informations à droite, verso avec terms + signature + barcode.
   */
  private async generateCardHtml(
    student: any,
    currentClass: any,
    matricule: string,
    qrPayload: string,
  ): Promise<string> {
    const formatDate = (date: Date | null) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    const academicYear = student.academicYear;
    const schoolLevel = student.schoolLevel;
    const tenant = student.tenant;

    // URL absolue pour la photo
    const baseUrl = (process.env.APP_PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
    const photoSrc = student.photoUrl
      ? (student.photoUrl.startsWith('http') || student.photoUrl.startsWith('data:')
        ? student.photoUrl
        : `${baseUrl}${student.photoUrl.startsWith('/') ? '' : '/'}${student.photoUrl}`)
      : '';

    const photoHtml = photoSrc
      ? `<img src="${photoSrc}" alt="Photo" style="width:100%;height:100%;object-fit:cover;" />`
      : `<div style="font-size:7pt;color:#666;text-align:center;padding:4px;">PHOTO</div>`;

    // Générer un vrai QR code en data URL (base64 PNG)
    let qrCodeDataUrl = '';
    try {
      qrCodeDataUrl = await QRCode.toDataURL(qrPayload, {
        width: 200,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      });
    } catch (err) {
      this.logger.warn(`QR code generation failed: ${err.message}`);
    }

    // Générer un code-barres visuel simple (barres verticales basées sur le matricule)
    const barcodeBars = Array.from(matricule).map((char, i) => {
      const code = char.charCodeAt(0);
      const width = 1 + (code % 3); // 1, 2 ou 3 px
      const isBlack = i % 2 === 0;
      return `<div style="width:${width}px;height:100%;background:${isBlack ? '#000' : '#fff'};"></div>`;
    }).join('');

    // Couleur principale (bleu marine du template)
    const NAVY = '#0D1F6E';
    const NAVY_LIGHT = '#1A237E';

    // Contact parent (si disponible)
    const guardian = student.studentGuardians?.[0]?.guardian;
    const guardianName = guardian ? `${guardian.firstName || ''} ${guardian.lastName || ''}`.trim() : 'N/A';
    const guardianPhone = guardian?.phone || 'N/A';

    // Adresse école (si disponible)
    const schoolAddress = tenant?.address || 'Cotonou, Bénin';
    const schoolPhone = tenant?.phone || '+229 01 00 00 00 00';
    const schoolEmail = tenant?.email || 'contact@ecole.bj';

    // Slogan / type d'établissement
    const schoolName = tenant?.name || 'Établissement Scolaire';
    const schoolSlogan = tenant?.slogan || 'Excellence • Discipline • Travail';

    // Dates joined/expire
    const joinedDate = formatDate(student.createdAt || new Date());
    const expireDate = formatDate(academicYear?.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Carte Scolaire - ${student.firstName} ${student.lastName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .card-container {
      display: flex;
      gap: 6mm;
      page-break-inside: avoid;
      margin: 4mm;
    }
    .card {
      width: 85.6mm;
      height: 53.98mm;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      overflow: hidden;
      background: #fff;
      position: relative;
      display: flex;
      flex-direction: column;
      box-shadow: 0 2px 4px rgba(0,0,0,0.08);
    }
    /* En-tête bleu marine */
    .card-header {
      background: ${NAVY};
      color: #fff;
      padding: 4px 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 11mm;
    }
    .header-logo {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 1px;
      min-width: 18mm;
    }
    .header-logo-mark {
      width: 10mm;
      height: 10mm;
      background: #fff;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14pt;
      font-weight: bold;
      color: ${NAVY};
    }
    .header-school {
      flex: 1;
      text-align: center;
      padding: 0 4px;
    }
    .header-school-name {
      font-size: 9pt;
      font-weight: bold;
      line-height: 1.1;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .header-school-slogan {
      font-size: 6pt;
      opacity: 0.85;
      margin-top: 1px;
      font-style: italic;
    }
    .header-card-title {
      font-size: 6pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.9;
      padding: 2px 4px;
      background: rgba(255,255,255,0.15);
      border-radius: 3px;
    }

    /* Corps de la carte */
    .card-body {
      flex: 1;
      display: flex;
      padding: 4px 6px;
      gap: 6px;
      background: #fff;
    }
    .photo-box {
      width: 22mm;
      height: 28mm;
      border: 1.5px solid ${NAVY};
      border-radius: 4px;
      overflow: hidden;
      background: #f3f4f6;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .info-list {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 1.5px;
      font-size: 7.5pt;
    }
    .info-row {
      display: flex;
      align-items: baseline;
      line-height: 1.2;
    }
    .info-label {
      font-weight: bold;
      color: ${NAVY};
      min-width: 22mm;
      font-size: 6.5pt;
      text-transform: uppercase;
      letter-spacing: 0.2px;
    }
    .info-value {
      color: #1f2937;
      flex: 1;
      font-size: 7.5pt;
      font-weight: 500;
    }
    .matricule-box {
      margin-top: 3px;
      padding: 2px 4px;
      background: ${NAVY};
      color: #fff;
      font-size: 7pt;
      font-weight: bold;
      text-align: center;
      border-radius: 3px;
      letter-spacing: 0.5px;
    }

    /* Pied de carte bleu marine */
    .card-footer {
      background: ${NAVY};
      color: #fff;
      padding: 3px 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 6pt;
      min-height: 6mm;
    }
    .footer-address {
      opacity: 0.9;
    }
    .footer-phone {
      opacity: 0.9;
      font-weight: bold;
    }

    /* Verso */
    .verso-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 4px 6px;
      background: #fff;
      font-size: 6pt;
      color: #424242;
    }
    .verso-section {
      display: flex;
      flex: 1;
      gap: 6px;
    }
    .verso-left {
      flex: 1.4;
      display: flex;
      flex-direction: column;
    }
    .verso-terms {
      font-size: 5pt;
      line-height: 1.3;
      color: #6b7280;
      margin-bottom: 3px;
    }
    .verso-terms ul {
      padding-left: 8px;
      margin: 0;
    }
    .verso-terms li {
      margin-bottom: 1px;
    }
    .verso-contact {
      font-size: 6pt;
      margin-top: auto;
      padding-top: 2px;
      border-top: 1px dashed #e5e7eb;
    }
    .verso-contact div {
      line-height: 1.4;
    }
    .verso-contact-label {
      color: ${NAVY};
      font-weight: bold;
      display: inline-block;
      min-width: 12mm;
    }
    .verso-right {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: space-between;
      gap: 3px;
    }
    .verso-qr {
      width: 18mm;
      height: 18mm;
      border: 1px solid #e5e7eb;
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
    }
    .verso-qr img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .verso-signature {
      text-align: center;
      font-size: 5.5pt;
      color: #6b7280;
    }
    .verso-signature-line {
      font-family: 'Brush Script MT', cursive;
      font-size: 9pt;
      color: ${NAVY};
      font-style: italic;
      border-bottom: 1px solid #9ca3af;
      padding-bottom: 1px;
      margin-bottom: 1px;
    }
    .verso-barcode {
      display: flex;
      align-items: center;
      height: 6mm;
      width: 100%;
      gap: 0;
      padding: 0 4px;
    }
    .verso-dates {
      font-size: 5pt;
      color: #6b7280;
      text-align: center;
      line-height: 1.3;
    }
    .verso-dates strong {
      color: ${NAVY};
    }

    @media print {
      .card-container { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="card-container">
    <!-- ============ RECTO ============ -->
    <div class="card card-front">
      <div class="card-header">
        <div class="header-logo">
          <div class="header-logo-mark">AH</div>
        </div>
        <div class="header-school">
          <div class="header-school-name">${schoolName}</div>
          <div class="header-school-slogan">${schoolSlogan}</div>
        </div>
        <div class="header-card-title">Carte Scolaire</div>
      </div>

      <div class="card-body">
        <div class="photo-box">${photoHtml}</div>
        <div class="info-list">
          <div class="info-row">
            <span class="info-label">Nom</span>
            <span class="info-value">${student.lastName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Prénom</span>
            <span class="info-value">${student.firstName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Né(e) le</span>
            <span class="info-value">${formatDate(student.dateOfBirth)}${student.placeOfBirth ? ' à ' + student.placeOfBirth : ''}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Sexe</span>
            <span class="info-value">${student.gender === 'M' ? 'Masculin' : student.gender === 'F' ? 'Féminin' : 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Classe</span>
            <span class="info-value">${currentClass?.name || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Niveau</span>
            <span class="info-value">${schoolLevel?.label || schoolLevel?.name || schoolLevel?.code || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Contact</span>
            <span class="info-value">${guardianPhone} (${guardianName})</span>
          </div>
          <div class="matricule-box">${matricule}</div>
        </div>
      </div>

      <div class="card-footer">
        <div class="footer-address">${schoolAddress}</div>
        <div class="footer-phone">${schoolPhone}</div>
      </div>
    </div>

    <!-- ============ VERSO ============ -->
    <div class="card card-back">
      <div class="card-header">
        <div class="header-card-title" style="background:transparent;">Informations</div>
        <div class="header-school">
          <div class="header-school-name" style="font-size:8pt;">Année ${academicYear?.name || ''}</div>
        </div>
        <div class="header-logo-mark" style="width:8mm;height:8mm;font-size:10pt;">AH</div>
      </div>

      <div class="verso-body">
        <div class="verso-section">
          <div class="verso-left">
            <div class="verso-terms">
              <strong style="color:${NAVY};font-size:6pt;">Conditions d'utilisation</strong>
              <ul>
                <li>Cette carte est strictement personnelle et incessible.</li>
                <li>Elle doit être présentée à toute demande du personnel autorisé.</li>
                <li>En cas de perte ou vol, signaler immédiatement à l'administration.</li>
                <li>La carte est valable pour l'année scolaire en cours.</li>
              </ul>
            </div>
            <div class="verso-contact">
              <div><span class="verso-contact-label">Téléphone</span> ${schoolPhone}</div>
              <div><span class="verso-contact-label">Email</span> ${schoolEmail}</div>
              <div><span class="verso-contact-label">Établissement</span> ${schoolName}</div>
            </div>
          </div>
          <div class="verso-right">
            ${qrCodeDataUrl ? `<div class="verso-qr"><img src="${qrCodeDataUrl}" alt="QR" /></div>` : ''}
            <div class="verso-signature">
              <div class="verso-signature-line">Le Directeur</div>
              <div>Signature & Cachet</div>
            </div>
            <div class="verso-barcode">${barcodeBars}</div>
            <div class="verso-dates">
              <div><strong>Émise le</strong> ${joinedDate}</div>
              <div><strong>Expire le</strong> ${expireDate}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="card-footer">
        <div class="footer-address">Academia Helm · Document officiel</div>
        <div class="footer-phone">Vérifiable via QR code</div>
      </div>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Génère le payload du QR Code
   */
  private generateQRPayload(globalMatricule: string, tenantId: string, studentId: string): string {
    // Format: AH:{matricule}:{tenantId}:{studentId}:{timestamp}
    const timestamp = Date.now();
    return `AH:${globalMatricule}:${tenantId}:${studentId}:${timestamp}`;
  }

  /**
   * Génère un numéro de carte unique
   */
  private async generateCardNumber(tenantId: string, academicYearId: string): Promise<string> {
    const academicYear = await this.prisma.academicYear.findUnique({
      where: { id: academicYearId },
    });

    if (!academicYear) {
      throw new NotFoundException(`Academic year with ID ${academicYearId} not found`);
    }

    const year = new Date(academicYear.startDate).getFullYear();
    const yearShort = String(year).slice(-2); // 2 derniers chiffres (ex: 26 pour 2026)

    // Compter les cartes générées cette année
    const count = await this.prisma.studentIdCard.count({
      where: {
        tenantId,
        academicYearId,
      },
    });

    // ⭐ Format compact : CARD-26-0001 (année 2 chiffres, séquence 4 chiffres)
    const sequence = String(count + 1).padStart(4, '0');
    return `CARD-${yearShort}-${sequence}`;
  }

  /**
   * Convertit le HTML en PDF
   */
  private async renderPdfFromHtml(html: string): Promise<Buffer> {
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '5mm',
          right: '5mm',
          bottom: '5mm',
          left: '5mm',
        },
      });

      return Buffer.from(pdf);
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  /**
   * Sauvegarde le PDF
   */
  private async savePdf(
    tenantId: string,
    academicYearId: string,
    cardNumber: string,
    pdfBuffer: Buffer,
  ): Promise<string> {
    const uploadsDir = path.join(process.cwd(), 'uploads', 'id-cards', tenantId, academicYearId);

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const fileName = `id-card-${cardNumber}.pdf`;
    const filePath = path.join(uploadsDir, fileName);

    fs.writeFileSync(filePath, pdfBuffer);

    return filePath;
  }

  /**
   * Récupère les statistiques des cartes
   */
  async getIdCardStats(tenantId: string, academicYearId?: string) {
    const where: any = { tenantId };
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }

    const cards = await this.prisma.studentIdCard.findMany({
      where,
      include: {
        student: {
          select: {
            status: true,
          },
        },
      },
    });

    const total = cards.length;
    const active = cards.filter((c) => c.isActive && !c.isRevoked).length;
    const revoked = cards.filter((c) => c.isRevoked).length;
    const expired = cards.filter((c) => c.validUntil && new Date(c.validUntil) < new Date()).length;

    return {
      total,
      active,
      revoked,
      expired,
      expiredRate: total > 0 ? (expired / total) * 100 : 0,
    };
  }
}

