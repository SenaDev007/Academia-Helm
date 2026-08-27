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
import sharp from 'sharp';

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

    // Récupérer le profil d'identité actif du tenant (couleurs / texts / flags
    // de la carte scolaire). On tolère l'absence de profil (valeurs par défaut).
    const identityProfile = await this.getActiveIdentityProfile(tenantId);

    // Générer le HTML de la carte (face avant + arrière)
    const cardHtml = await this.generateCardHtml(
      student,
      currentClass,
      student.identifier.globalMatricule,
      qrPayload,
      identityProfile,
      cardNumber,
      student.academicYear?.endDate,
    );

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
        qrPayload: card.qrPayload,
        qrHash: card.qrHash,
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

    // Récupérer le profil d'identité actif (1 fois pour tout le bundle — économise N requêtes)
    const identityProfile = await this.getActiveIdentityProfile(tenantId);

    for (const enr of enrollments) {
      const student = enr.student;
      if (!student.identifier?.globalMatricule) continue;

      const qrPayload = this.generateQRPayload(student.identifier.globalMatricule, tenantId, student.id);
      // ⭐ N° de carte pour cet élève — génère le format CARD-YY-NNNN
      const studentCardNumber = await this.generateCardNumber(tenantId, enr.academicYearId || academicYearId);
      const cardHtml = await this.generateCardHtml(
        student,
        enr.class,
        student.identifier.globalMatricule,
        qrPayload,
        identityProfile,
        studentCardNumber,
        enr.academicYear?.endDate,
      );
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

   * ⭐ Supprime TOUTES les cartes d'un tenant (optionnellement filtrées par année scolaire).
   * Utilisé pour régénérer les cartes avec un nouveau template.
   */
  async deleteAllCards(tenantId: string, academicYearId?: string): Promise<{
    deleted: number;
    academicYearFilter?: string;
  }> {
    const where: any = { tenantId };
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }
    const countBefore = await this.prisma.studentIdCard.count({ where });
    await this.prisma.studentIdCard.deleteMany({ where });
    this.logger.log(
      `🗑️ ${countBefore} cartes scolaires supprimées pour tenant ${tenantId}` +
      (academicYearId ? ` (année ${academicYearId})` : ' (toutes années)'),
    );
    return {
      deleted: countBefore,
      ...(academicYearId ? { academicYearFilter: academicYearId } : {}),
    };
  }

  /**
   * ⭐ Supprime toutes les cartes d'une classe physique spécifique.
   * Le paramètre classId référence la table `classes` (classe physique).
   */
  async deleteCardsByClass(tenantId: string, classId: string, academicYearId?: string): Promise<{
    deleted: number;
    classId: string;
  }> {
    // Vérifier que la classe existe et appartient au tenant
    const cls = await this.prisma.class.findFirst({
      where: { id: classId, tenantId },
      select: { id: true, name: true },
    });
    if (!cls) throw new NotFoundException(`Classe physique non trouvée : ${classId}`);

    // Trouver tous les élèves de cette classe (via StudentEnrollment)
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { tenantId, classId, ...(academicYearId ? { academicYearId } : {}) },
      select: { studentId: true },
    });
    const studentIds = enrollments.map(e => e.studentId);

    if (studentIds.length === 0) {
      this.logger.log(`Aucune carte à supprimer pour la classe ${cls.name} (aucun élève)`);
      return { deleted: 0, classId };
    }

    const where: any = { tenantId, studentId: { in: studentIds } };
    if (academicYearId) where.academicYearId = academicYearId;

    const countBefore = await this.prisma.studentIdCard.count({ where });
    await this.prisma.studentIdCard.deleteMany({ where });
    this.logger.log(`🗑️ ${countBefore} cartes supprimées pour la classe ${cls.name} (${classId})`);
    return { deleted: countBefore, classId };
  }

  /**
   * ⭐ Supprime toutes les cartes d'un niveau scolaire (Maternelle, Primaire, Secondaire).
   * Le paramètre levelId référence la table `school_levels`.
   */
  async deleteCardsByLevel(tenantId: string, levelId: string, academicYearId?: string): Promise<{
    deleted: number;
    levelId: string;
  }> {
    // Trouver toutes les classes physiques de ce niveau
    const classes = await this.prisma.class.findMany({
      where: { tenantId, schoolLevelId: levelId },
      select: { id: true, name: true },
    });
    if (classes.length === 0) {
      this.logger.log(`Aucune carte à supprimer pour le niveau ${levelId} (aucune classe)`);
      return { deleted: 0, levelId };
    }

    const classIds = classes.map(c => c.id);

    // Trouver tous les élèves de ces classes
    const enrollments = await this.prisma.studentEnrollment.findMany({
      where: { tenantId, classId: { in: classIds }, ...(academicYearId ? { academicYearId } : {}) },
      select: { studentId: true },
    });
    const studentIds = enrollments.map(e => e.studentId);

    if (studentIds.length === 0) {
      this.logger.log(`Aucune carte à supprimer pour le niveau ${levelId} (aucun élève)`);
      return { deleted: 0, levelId };
    }

    const where: any = { tenantId, studentId: { in: studentIds } };
    if (academicYearId) where.academicYearId = academicYearId;

    const countBefore = await this.prisma.studentIdCard.count({ where });
    await this.prisma.studentIdCard.deleteMany({ where });
    this.logger.log(`🗑️ ${countBefore} cartes supprimées pour le niveau ${levelId} (${classes.length} classes)`);
    return { deleted: countBefore, levelId };

  }

  /**
   * Télécharge le PDF d'une carte.
   * ⭐ Si le fichier PDF n'existe pas sur disque (Fly.io éphémère sans stockage
   * persistant), on le RÉGÉNÈRE à la volée via getCardPreviewHtml + Puppeteer.
   */
  async downloadIdCardPdf(cardId: string, tenantId: string): Promise<Buffer> {
    const card = await this.prisma.studentIdCard.findFirst({
      where: { id: cardId, tenantId },
    });

    if (!card) {
      throw new NotFoundException(`Carte ${cardId} introuvable`);
    }

    // Tentative 1 : lire le fichier existant sur disque
    if (card.pdfPath && fs.existsSync(card.pdfPath)) {
      return fs.readFileSync(card.pdfPath);
    }

    // Tentative 2 : régénérer le PDF à la volée (Fly.io éphémère)
    this.logger.log(`PDF file not found for card ${card.cardNumber}, regenerating on-the-fly...`);
    const html = await this.getCardPreviewHtml(cardId, tenantId);
    const pdfBuffer = await this.renderPdfFromHtml(html);

    // Sauvegarder pour les prochains téléchargements (best-effort)
    try {
      const newPath = await this.savePdf(tenantId, card.academicYearId, card.cardNumber, pdfBuffer);
      // Mettre à jour le pdfPath en base
      await this.prisma.studentIdCard.update({
        where: { id: cardId },
        data: { pdfPath: newPath },
      });
      this.logger.log(`PDF regenerated and saved: ${newPath}`);
    } catch (e) {
      this.logger.warn(`Could not save regenerated PDF: ${e.message}`);
    }

    return Buffer.from(pdfBuffer);
  }

  /**
   * ⭐ Génère le HTML d'aperçu d'une carte existante (recto + verso) à partir
   * de la DB. Utilisé par :
   *   - GET /students/id-cards/:cardId/preview-html (affichage dans l'UI)
   *   - downloadIdCardPdf (régénération à la volée si le PDF a disparu)
   *
   * Étapes :
   *   1. Charge la carte + student + tenant + academicYear + schoolLevel +
   *      enrollment + identifier + guardian primaire.
   *   2. Charge le TenantIdentityProfile actif (couleurs / texts / flags).
   *   3. Reconstruit le QR payload (la carte le stocke déjà en base, on le
   *      réutilise tel quel — pas de régénération du timestamp).
   *   4. Appelle generateCardHtml avec l'identityProfile.
   *
   * ⚠️ Cette méthode ne modifie pas la carte ; elle est purement de lecture.
   */
  async getCardPreviewHtml(cardId: string, tenantId: string): Promise<string> {
    const card = await this.prisma.studentIdCard.findFirst({
      where: { id: cardId, tenantId },
      include: {
        student: {
          include: {
            tenant: true,
            identifier: true,
            studentGuardians: {
              where: { isPrimary: true },
              take: 1,
              include: { guardian: true },
            },
          },
        },
        academicYear: { select: { id: true, name: true, startDate: true, endDate: true } },
        schoolLevel: { select: { id: true, name: true, code: true, label: true } },
      },
    });

    if (!card) {
      throw new NotFoundException(`Carte ${cardId} introuvable`);
    }

    // Charger la classe de l'élève pour l'année de la carte (via StudentEnrollment)
    const enrollment = await this.prisma.studentEnrollment.findFirst({
      where: {
        tenantId,
        studentId: card.studentId,
        academicYearId: card.academicYearId,
        status: { in: ['ACTIVE', 'ADMITTED', 'ENROLLED', 'PRE_REGISTERED'] },
      },
      include: { class: { select: { id: true, name: true } } },
    });
    const currentClass = enrollment?.class || null;

    // Profil d'identité actif (couleurs / texts / flags carte)
    const identityProfile = await this.getActiveIdentityProfile(tenantId);

    // On réutilise le qrPayload stocké en base (pas de nouveau timestamp).
    const qrPayload = card.qrPayload;
    const matricule =
      card.student?.identifier?.globalMatricule ||
      (card.qrPayload.split(':')[1] ?? '');

    // On remonte academicYear + schoolLevel au niveau du student pour que
    // generateCardHtml les lise via student.academicYear / student.schoolLevel.
    const student: any = {
      ...card.student,
      academicYear: card.academicYear,
      schoolLevel: card.schoolLevel,
    };

    return this.generateCardHtml(
      student,
      currentClass,
      matricule,
      qrPayload,
      identityProfile,
      card.cardNumber,
      card.validUntil,
    );
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
   * Récupère le profil d'identité actif du tenant (pour les paramètres de
   * design des cartes scolaires). Retourne null si aucun profil actif —
   * `generateCardHtml` utilisera alors les valeurs par défaut.
   */
  private async getActiveIdentityProfile(tenantId: string): Promise<any | null> {
    try {
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
      });
      return profile || null;
    } catch (err) {
      this.logger.warn(`getActiveIdentityProfile failed: ${(err as Error).message} — using defaults`);
      return null;
    }
  }

  /**
   * Génère le HTML d'UNE carte (recto + verso côte à côte, format paysage).
   * Design inspiré du template fourni : bandeau en-tête + pied (couleur
   * personnalisable), photo à gauche, informations à droite, verso avec
   * conditions + signature + QR code + barcode.
   *
   * Toutes les valeurs de design proviennent de `identityProfile` (modèle
   * TenantIdentityProfile — colonnes `cardPrimaryColor`, `cardSecondaryColor`,
   * `cardShowBarcode`, `cardFooterText`, `cardConditionsText`, etc.).
   * Si `identityProfile` est null ou incomplet, on retombe sur des valeurs
   * par défaut (bleu marine institutionnel).
   */
  private async generateCardHtml(
    student: any,
    currentClass: any,
    matricule: string,
    qrPayload: string,
    identityProfile?: any | null,
    // ⭐ Paramètres optionnels pour le nouveau template Claude AI :
    //    - cardNumber : N° de carte affiché en haut des champs (fallback: matricule)
    //    - validUntil : date d'expiration affichée au verso (fallback: fin d'année scolaire)
    cardNumber?: string,
    validUntil?: Date | string | null,
  ): Promise<string> {
    const formatDate = (date: Date | null) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    const academicYear = student.academicYear;
    const schoolLevel = student.schoolLevel;
    const tenant = student.tenant;

    // ── Ministère adapté au niveau scolaire (Bénin) ────────────────────────────
    // Affiché dans l'en-tête de la carte recto (entre République et nom école).
    const levelUpper = (schoolLevel?.code || '').toUpperCase();
    const isSuperieur = levelUpper === 'SUPERIEUR' || levelUpper === 'UNIVERSITY' || levelUpper === 'HIGHER';
    const isSecondaire = levelUpper === 'SECONDAIRE' || levelUpper === 'SECONDARY' || levelUpper === 'SECOND';
    const ministry = isSuperieur
      ? "Ministère de l'Enseignement Supérieur et de la Recherche Scientifique"
      : isSecondaire
      ? "Ministère de l'Enseignement Secondaire, de la Formation Technique et Professionnelle, de la Reconversion et de l'Insertion des Jeunes"
      : 'Ministère des Enseignements Maternel et Primaire';

    // ── Heures de sortie maternelle (affichées dans le back-header du verso) ──
    const isMaternelle = levelUpper === 'MATERNELLE' || levelUpper === 'MAT';
    const maternelleSingleExit = identityProfile?.maternelleSingleExit ?? false;
    const maternellePickupMorning = identityProfile?.maternellePickupMorning || '12:00';
    const maternellePickupAfternoon = identityProfile?.maternellePickupAfternoon || '16:30';
    const maternelleSingleExitTime = identityProfile?.maternelleSingleExitTime || '15:30';

    // ── Design tokens (issus de TenantIdentityProfile ou valeurs par défaut) ──
    // Couleurs par défaut : bleu marine institutionnel Academia Helm.
    const NAVY = identityProfile?.cardPrimaryColor || '#0D1F6E';
    const NAVY_LIGHT = identityProfile?.cardSecondaryColor || '#1A237E';
    const showQRCode = identityProfile?.cardShowQRCode !== false; // défaut true
    const showBarcode = identityProfile?.cardShowBarcode !== false; // défaut true
    const showPhoto = identityProfile?.cardShowPhoto !== false; // défaut true
    const showGuardian = identityProfile?.cardShowGuardian !== false; // défaut true
    const showEmergencyCall = identityProfile?.cardShowEmergencyCall !== false; // défaut true
    const showSchoolAddress = identityProfile?.cardShowSchoolAddress !== false; // défaut true
    const footerText = identityProfile?.cardFooterText || 'Academia Helm · Document officiel';
    const conditionsText = identityProfile?.cardConditionsText ||
      "Cette carte est strictement personnelle et incessible. À présenter à toute demande du personnel autorisé. Signaler toute perte ou vol à l'administration.";

    // ⭐ Options design configurables (Phase 5 — Task 22-b)
    const fontFamily = identityProfile?.cardFontFamily || 'Helvetica, Arial, sans-serif';
    const fontSizeScale = identityProfile?.cardFontSizeScale || 'medium'; // small/medium/large
    const fontSizeMultiplier = fontSizeScale === 'small' ? 0.9 : fontSizeScale === 'large' ? 1.1 : 1.0;
    const photoPosition = identityProfile?.cardPhotoPosition || 'left'; // left/right
    const photoSizePreset = identityProfile?.cardPhotoSize || 'medium'; // small/medium/large
    const photoDimensions = {
      small: { w: '20mm', h: '26mm' },
      medium: { w: '24mm', h: '30mm' },
      large: { w: '28mm', h: '34mm' },
    }[photoSizePreset];
    const photoShape = identityProfile?.cardPhotoShape || 'rectangle'; // rectangle/rounded/circle
    const photoBorderRadius = photoShape === 'circle' ? '50%' : photoShape === 'rounded' ? '8px' : '4px';
    const headerStyle = identityProfile?.cardHeaderStyle || 'solid'; // solid/gradient/striped
    const headerBackground = headerStyle === 'gradient'
      ? `linear-gradient(135deg, ${NAVY} 0%, ${NAVY_LIGHT} 100%)`
      : headerStyle === 'striped'
      ? `repeating-linear-gradient(45deg, ${NAVY} 0px, ${NAVY} 8px, ${NAVY_LIGHT} 8px, ${NAVY_LIGHT} 16px)`
      : NAVY;
    const logoPosition = identityProfile?.cardLogoPosition || 'left';
    const logoSizePreset = identityProfile?.cardLogoSize || 'medium';
    const logoDimensions = {
      small: '8mm',
      medium: '10mm',
      large: '12mm',
    }[logoSizePreset];
    const showMatricule = identityProfile?.cardShowMatricule !== false;
    const showBirthInfo = identityProfile?.cardShowBirthInfo !== false;
    const showGender = identityProfile?.cardShowGender !== false;
    const showLevel = identityProfile?.cardShowLevel !== false;
    const studentNameStyle = identityProfile?.cardStudentNameStyle || 'bold';
    const qrPosition = identityProfile?.cardQrPosition || 'bottom-right';
    const qrSizePreset = identityProfile?.cardQrSize || 'medium';
    const qrDimensions = {
      small: '16mm',
      medium: '20mm',
      large: '24mm',
    }[qrSizePreset];
    const qrWithLogo = identityProfile?.cardQrWithLogo !== false;

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

    // Block photo complet (caché si cardShowPhoto = false)
    const photoBoxHtml = showPhoto
      ? `<div class="photo-box">${photoHtml}</div>`
      : '';

    // Contact parent (si disponible)
    const guardian = student.studentGuardians?.[0]?.guardian;
    const guardianName = guardian ? `${guardian.firstName || ''} ${guardian.lastName || ''}`.trim() : 'N/A';
    const guardianPhone = guardian?.phone || 'N/A';

    // Adresse école (si disponible) — priorité au TenantIdentityProfile
    const schoolAddress = identityProfile?.address || tenant?.address || 'Cotonou, Bénin';
    const schoolPhone = identityProfile?.phonePrimary || tenant?.phone || '+229 01 00 00 00 00';
    const schoolEmail = identityProfile?.email || tenant?.email || 'contact@ecole.bj';
    const schoolWebsite = identityProfile?.website || tenant?.website || '';

    // Slogan / type d'établissement — priorité au TenantIdentityProfile
    // ⚠️ schoolName DOIT être défini avant schoolAcronym (qui l'utilise pour calculer un sigle).
    const schoolName = identityProfile?.schoolName || tenant?.name || 'Établissement Scolaire';
    const schoolSlogan = identityProfile?.slogan || tenant?.slogan || 'Excellence • Discipline • Travail';
    // ⭐ Tagline (sous-titre du logo) — peut être différente du slogan
    const schoolTagline = identityProfile?.tagline || schoolSlogan || 'Éducation • Avenir • Réussite';

    // ⭐ Logo école (pour header recto + verso) : URL résolue en absolu si relative.
    //    Si pas de logo, on affiche un placeholder avec les initiales (acronym).
    const rawLogoUrl = identityProfile?.logoUrl || tenant?.logoUrl || '';
    const schoolAcronym = identityProfile?.schoolAcronym ||
      (schoolName.split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase()) ||
      'AH';
    const logoSrc = rawLogoUrl
      ? (rawLogoUrl.startsWith('http') || rawLogoUrl.startsWith('data:')
        ? rawLogoUrl
        : `${baseUrl}${rawLogoUrl.startsWith('/') ? '' : '/'}${rawLogoUrl}`)
      : '';
    const headerLogoHtml = logoSrc
      ? `<img src="${logoSrc}" alt="Logo" style="width:100%;height:100%;object-fit:contain;" />`
      : `<span style="font-size:11pt;font-weight:800;color:${NAVY};">${schoolAcronym}</span>`;

    // Générer un QR code en data URL (base64 PNG) avec logo de l'école au centre.
    // ⭐ errorCorrectionLevel = 'H' (High) pour tolérer le logo central sans
    //    altérer la lisibilité du QR code. Si aucun logo n'est configuré sur
    //    le TenantIdentityProfile, on génère un QR code simple sans logo.
    let qrCodeDataUrl = '';
    try {
      // ⭐ Si cardQrWithLogo est désactivé, on passe logoUrl='' pour générer
      // un QR code simple sans logo au centre.
      const effectiveLogoUrl = qrWithLogo ? rawLogoUrl : '';
      qrCodeDataUrl = await this.generateQrCodeWithLogo(qrPayload, effectiveLogoUrl, {
        primaryColor: NAVY,
      });
    } catch (err) {
      this.logger.warn(`QR code generation failed: ${(err as Error).message}`);
    }

    // ⭐ barcodeBars supprimé — le nouveau template hybride n'affiche plus de
    //    code-barres (le QR code remplace cette fonctionnalité au verso).

    // Dates joined/expire
    const joinedDate = formatDate(student.createdAt || new Date());
    // ⭐ Si validUntil est fourni (carte existante), on l'utilise ; sinon fallback fin d'année scolaire
    const expireDate = formatDate(
      validUntil ? new Date(validUntil as any) : (academicYear?.endDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000))
    );
    // ⭐ N° carte : si pas fourni, on fallback sur le matricule
    const displayCardNumber = cardNumber || matricule || 'N/A';

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Carte Scolaire - ${student.firstName} ${student.lastName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', 'Poppins', Arial, sans-serif;
      background: #e9e9ec;
      display: flex;
      flex-wrap: wrap;
      gap: 20mm;
      justify-content: center;
      padding: 20mm 10mm;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .card-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      page-break-inside: avoid;
    }
    /* ⭐ Clip circulaire seul — pas de lanyard */
    .clip {
      width: 8mm;
      height: 8mm;
      border: 1.3mm solid #b7bcc4;
      border-radius: 50%;
      background: #e9e9ec;
      margin-bottom: -4.8mm;
      z-index: 2;
      position: relative;
    }
    .card {
      width: 85.6mm;
      height: 53.98mm;
      background: #ffffff;
      border-radius: 3.7mm;
      box-shadow: 0 2.6mm 6.6mm rgba(0,0,0,0.18);
      overflow: hidden;
      position: relative;
      border: 1.6mm solid #f4f4f5;
      display: flex;
      flex-direction: column;
    }

    /* ===== HEADER BLEU (style ancien — bande continue, pas de clip-path) ===== */
    /* République + drapeau Bénin + ministère + nom école + slogan + logo */
    .card-header {
      flex-shrink: 0;
      height: 28%;
      background: linear-gradient(135deg, ${NAVY} 0%, ${NAVY_LIGHT} 100%);
      color: #fff;
      padding: 0 1.6mm;
      gap: 0.8mm;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .header-flag {
      width: 4.5mm;
      height: 3.5mm;
      display: flex;
      border: 0.13mm solid rgba(255,255,255,0.3);
      border-radius: 0.2mm;
      overflow: hidden;
      flex-shrink: 0;
    }
    .header-flag .flag-green { width: 50%; height: 100%; background: #15803d; }
    .header-flag .flag-right { width: 50%; display: flex; flex-direction: column; }
    .header-flag .flag-yellow { height: 50%; background: #facc15; }
    .header-flag .flag-red { height: 50%; background: #dc2626; }
    .header-center {
      flex: 1;
      text-align: center;
      padding: 0 0.5mm;
      min-width: 0;
    }
    .header-republic {
      font-size: 10pt;
      font-weight: 800;
      line-height: 1.05;
      text-transform: uppercase;
      letter-spacing: 0.6pt;
      margin-bottom: 2pt;
    }
    .header-ministry {
      font-size: 5pt;
      line-height: 1.15;
      opacity: 0.9;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-bottom: 2pt;
    }
    .header-school-name {
      font-size: 7pt;
      font-weight: 700;
      line-height: 1.1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      margin-bottom: 1.5pt;
    }
    .header-slogan {
      font-size: 4.5pt;
      font-style: italic;
      line-height: 1.1;
      opacity: 0.8;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .header-logo {
      width: 8mm;
      height: 8mm;
      flex-shrink: 0;
      background: #fff;
      border-radius: 0.8mm;
      padding: 0.2mm;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .header-logo img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
    .header-logo .acronym {
      font-size: 4pt;
      font-weight: 800;
      color: ${NAVY};
      letter-spacing: 0.2pt;
    }

    /* ===== FRONT BODY (Claude AI style : photo + 6 champs) ===== */
    .front-body {
      display: flex;
      padding: 3.7mm 4.2mm 0 4.2mm;
      gap: 3.7mm;
      flex: 1;
      min-height: 0;
    }
    .photo-box {
      width: 19mm;
      height: 23mm;
      border: 0.5mm solid ${NAVY};
      border-radius: 1mm;
      flex-shrink: 0;
      overflow: hidden;
      background-color: #f2f2f2;
      background-image:
        linear-gradient(45deg, #d9d9d9 25%, transparent 25%),
        linear-gradient(-45deg, #d9d9d9 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, #d9d9d9 75%),
        linear-gradient(-45deg, transparent 75%, #d9d9d9 75%);
      background-size: 3.7mm 3.7mm;
      background-position: 0 0, 0 1.85mm, 1.85mm -1.85mm, -1.85mm 0;
    }
    .photo-box img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .fields {
      flex: 1;
      font-size: 7pt;
      color: #1a1a2e;
      min-width: 0;
    }
    .field-row {
      display: flex;
      margin-bottom: 1.6mm;
      line-height: 1.2;
    }
    .field-label {
      font-weight: 700;
      width: 21mm;
      flex-shrink: 0;
    }
    .field-colon {
      width: 3mm;
      flex-shrink: 0;
    }
    .field-value {
      color: #333;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .field-value.bold {
      font-weight: 700;
    }

    /* ===== FOOTER (Claude AI style : gradient + clip-path diagonal) ===== */
    .footer {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 10mm;
      background: linear-gradient(90deg, ${NAVY} 0%, ${NAVY} 55%, ${NAVY_LIGHT} 100%);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 4.2mm;
      clip-path: polygon(0 25%, 100% 0, 100% 100%, 0 100%);
    }
    .footer-address {
      color: #fff;
      font-size: 6pt;
      line-height: 1.5;
      max-width: 60%;
      overflow: hidden;
    }
    .footer-sign {
      text-align: center;
      padding-top: 1mm;
    }
    .sign-line {
      font-family: 'Brush Script MT', cursive;
      font-size: 12pt;
      color: #fff;
      line-height: 1;
    }
    .sign-label {
      color: #fff;
      font-size: 7pt;
      font-weight: 700;
      margin-top: 0.5pt;
    }

    /* ===== VERSO — Back header (BANDE CONTINUE, pas de clip-path, dates visibles) ===== */
    .back-header {
      flex-shrink: 0;
      height: 22%;
      background: linear-gradient(135deg, ${NAVY} 0%, ${NAVY_LIGHT} 100%);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 4mm;
    }
    .terms-title {
      font-weight: 800;
      font-size: 5pt;
      letter-spacing: 0.4pt;
      line-height: 1.1;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .dates, .maternelle-hours {
      font-size: 6pt;
      text-align: right;
      line-height: 1.4;
      flex-shrink: 0;
      padding-left: 2mm;
    }
    .maternelle-hours {
      font-weight: 700;
    }

    /* ===== VERSO — Back body (Claude AI style) ===== */
    .back-body {
      padding: 3mm 4.5mm 0 4.5mm;
      flex: 1;
      min-height: 0;
      position: relative;
    }
    .back-body-watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 30mm;
      height: 30mm;
      opacity: 0.08;
      pointer-events: none;
      z-index: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .back-body-watermark img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .back-body-content {
      position: relative;
      z-index: 1;
    }
    .term-item {
      display: flex;
      gap: 2mm;
      font-size: 6pt;
      color: #444;
      line-height: 1.5;
      margin-bottom: 2mm;
    }
    .bullet {
      color: ${NAVY};
      font-weight: 900;
      flex-shrink: 0;
    }
    .contact-block {
      margin-top: 2.5mm;
      font-size: 7pt;
      color: #1a1a2e;
    }
    .contact-row {
      display: flex;
      margin-bottom: 1mm;
      line-height: 1.3;
    }
    .contact-label {
      font-weight: 700;
      width: 16mm;
      flex-shrink: 0;
    }
    .contact-colon {
      margin-right: 0.5mm;
    }
    .contact-value {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* ===== VERSO — Back footer (Claude AI style : gradient + clip-path) ===== */
    .back-footer {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 12mm;
      background: linear-gradient(90deg, ${NAVY} 0%, ${NAVY} 55%, ${NAVY_LIGHT} 100%);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 4mm;
      clip-path: polygon(0 30%, 100% 0, 100% 100%, 0 100%);
    }
    .back-dates {
      color: #fff;
      font-size: 5.5pt;
      text-align: right;
      line-height: 1.4;
      padding-right: 2mm;
      padding-top: 1mm;
      opacity: 0.95;
    }
    .back-logo {
      padding-top: 1.5mm;
    }
    .back-logo .logo-text-w {
      color: #fff;
      font-weight: 800;
      font-size: 9pt;
      line-height: 1.1;
    }
    .back-logo .tagline-text-w {
      color: #cfe6ff;
      font-size: 5.5pt;
      letter-spacing: 0.7pt;
      margin-top: 0.5pt;
      line-height: 1.1;
    }
    .qr {
      width: 10mm;
      height: 10mm;
      background: #fff;
      border-radius: 0.8mm;
      padding: 0.8mm;
      box-shadow: 0 0.3mm 0.5mm rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .qr img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      display: block;
    }

    @media print {
      body { background: #fff; padding: 4mm; gap: 6mm; }
      .card-wrap { page-break-inside: avoid; }
    }
  </style>
</head>
<body>

  <!-- ═══ RECTO ═══ -->
  <div class="card-wrap">
    <div class="clip"></div>
    <div class="card">
      <!-- ═══ HEADER BLEU (style ancien — bande continue, pas de clip-path) ═══ -->
      <div class="card-header">
        <!-- Drapeau du Bénin à gauche -->
        <div class="header-flag">
          <div class="flag-green"></div>
          <div class="flag-right">
            <div class="flag-yellow"></div>
            <div class="flag-red"></div>
          </div>
        </div>
        <!-- Centre : République + Ministère + École + Slogan -->
        <div class="header-center">
          <div class="header-republic">RÉPUBLIQUE DU BÉNIN</div>
          <div class="header-ministry">${ministry}</div>
          <div class="header-school-name">${schoolName}</div>
          <div class="header-slogan">${schoolSlogan}</div>
        </div>
        <!-- Logo école à droite -->
        <div class="header-logo">
          ${logoSrc
            ? `<img src="${logoSrc}" alt="Logo" />`
            : `<span class="acronym">${schoolAcronym}</span>`}
        </div>
      </div>

      <!-- ═══ CORPS (Claude AI style : photo + 6 champs) ═══ -->
      <div class="front-body">
        ${showPhoto ? `<div class="photo-box">${photoHtml}</div>` : ''}
        <div class="fields">
          <div class="field-row"><span class="field-label">N° Carte</span><span class="field-colon">:</span><span class="field-value">${displayCardNumber}</span></div>
          ${showMatricule ? `<div class="field-row"><span class="field-label">Matricule</span><span class="field-colon">:</span><span class="field-value">${matricule}</span></div>` : ''}
          <div class="field-row"><span class="field-label">Nom</span><span class="field-colon">:</span><span class="field-value bold">${student.lastName} ${student.firstName}</span></div>
          ${showGuardian ? `<div class="field-row"><span class="field-label">Tuteur</span><span class="field-colon">:</span><span class="field-value">${guardianName}</span></div>` : ''}
          <div class="field-row"><span class="field-label">Classe</span><span class="field-colon">:</span><span class="field-value">${currentClass?.name || 'N/A'}</span></div>
          ${showEmergencyCall ? `<div class="field-row"><span class="field-label">Urgence</span><span class="field-colon">:</span><span class="field-value">${guardianPhone}</span></div>` : ''}
        </div>
      </div>

      <!-- ═══ FOOTER (Claude AI style : gradient + clip-path + adresse + signature) ═══ -->
      <div class="footer">
        <div class="footer-address">
          ${showSchoolAddress && schoolAddress ? schoolAddress : ''}
          ${showSchoolAddress && schoolAddress && schoolPhone ? '<br>' : ''}
          ${schoolPhone ? 'Tél : ' + schoolPhone : ''}
        </div>
        <div class="footer-sign">
          <div class="sign-line">Signature</div>
          <div class="sign-label">Directeur</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══ VERSO ═══ -->
  <div class="card-wrap">
    <div class="clip"></div>
    <div class="card">
      <!-- ═══ BACK-HEADER (bande continue) ═══ -->
      <!-- Maternelle : "CONDITIONS D'UTILISATION" + heures de sortie (matin/après-midi) -->
      <!-- Autres niveaux : "CONDITIONS D'UTILISATION" uniquement (dates déplacées au footer) -->
      <div class="back-header">
        <div class="terms-title">CONDITIONS D'UTILISATION</div>
        ${isMaternelle ? `
        <div class="maternelle-hours">
          ${maternelleSingleExit
            ? `Sortie unique : ${maternelleSingleExitTime}`
            : `Sortie Matin : ${maternellePickupMorning}<br>Sortie Aprèm : ${maternellePickupAfternoon}`}
        </div>` : ''}
      </div>

      <!-- ═══ BACK-BODY (conditions + contact + logo filigrane) ═══ -->
      <div class="back-body">
        ${logoSrc ? `
        <div class="back-body-watermark">
          <img src="${logoSrc}" alt="" />
        </div>` : ''}
        <div class="back-body-content">
          <div class="term-item">
            <span class="bullet">■</span>
            <span>${conditionsText}</span>
          </div>
          <div class="contact-block">
            ${schoolPhone ? `<div class="contact-row"><span class="contact-label">Tél</span><span class="contact-colon">:</span><span class="contact-value">${schoolPhone}</span></div>` : ''}
            ${schoolEmail ? `<div class="contact-row"><span class="contact-label">Email</span><span class="contact-colon">:</span><span class="contact-value">${schoolEmail}</span></div>` : ''}
            ${schoolWebsite ? `<div class="contact-row"><span class="contact-label">Web</span><span class="contact-colon">:</span><span class="contact-value">${schoolWebsite}</span></div>` : ''}
            ${showSchoolAddress && schoolAddress ? `<div class="contact-row"><span class="contact-label">Adresse</span><span class="contact-colon">:</span><span class="contact-value">${schoolAddress}</span></div>` : ''}
          </div>
        </div>
      </div>

      <!-- ═══ BACK-FOOTER (logo + dates à côté du QR code) ═══ -->
      <div class="back-footer">
        <div class="back-logo">
          ${logoSrc
            ? `<img src="${logoSrc}" alt="Logo" style="height:6mm;width:auto;object-fit:contain;" />`
            : `<div class="logo-text-w">${schoolAcronym}</div><div class="tagline-text-w">${schoolTagline}</div>`}
        </div>
        <div class="back-dates">
          Émise le : ${joinedDate}<br>
          ${expireDate && expireDate !== 'N/A' ? 'Expire le : ' + expireDate : ''}
        </div>
        ${showQRCode && qrCodeDataUrl ? `<div class="qr"><img src="${qrCodeDataUrl}" alt="QR" /></div>` : ''}
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
   * ⭐ Génère un QR code (data URL PNG) avec le logo de l'école intégré AU CENTRE.
   *
   * Algorithme :
   *   1. Génère le QR code avec errorCorrectionLevel = 'H' (High, 30% de
   *      redondance) — nécessaire pour que le logo central n'altère pas la
   *      lisibilité du QR code par les lecteurs.
   *   2. Si un logo est fourni (URL http(s):// ou /uploads/...), on le
   *      télécharge/charge, le redimensionne à ~25% de la taille du QR code
   *      (avec padding blanc autour), puis on le compose au centre du QR code
   *      via sharp.
   *   3. Retourne le tout en data URL base64 PNG.
   *
   * Si pas de logo : retourne un QR code simple (fallback).
   * Si le téléchargement du logo échoue : log warn + fallback QR simple.
   *
   * @param payload  Contenu encodé dans le QR code (ex: "AH:MAT-001:tenantId:studentId:1234")
   * @param logoUrl  URL du logo (http(s)://... ou /uploads/... ou data:...). Vide = pas de logo.
   * @param options  { primaryColor? } — couleur des modules du QR (défaut noir).
   */
  private async generateQrCodeWithLogo(
    payload: string,
    logoUrl: string,
    options: { primaryColor?: string } = {},
  ): Promise<string> {
    const primaryColor = options.primaryColor || '#000000';
    const QR_SIZE = 400; // Haute résolution pour rendu net à l'impression
    const LOGO_RATIO = 0.28; // Logo occupe 28% de la largeur du QR code

    // 1. Générer le QR code en haute qualité avec error correction 'H'
    let qrBuffer: Buffer;
    try {
      const dataUrl = await QRCode.toDataURL(payload, {
        width: QR_SIZE,
        margin: 1,
        color: { dark: primaryColor, light: '#ffffff' },
        errorCorrectionLevel: 'H',
      });
      qrBuffer = Buffer.from(dataUrl.split(',')[1], 'base64');
    } catch (err) {
      throw new Error(`QR generation failed: ${(err as Error).message}`);
    }

    // 2. Si pas de logo, retourner le QR code simple
    if (!logoUrl) {
      return `data:image/png;base64,${qrBuffer.toString('base64')}`;
    }

    // 3. Charger le logo depuis URL http(s)://, /uploads/, ou data:
    let logoBuffer: Buffer | null = null;
    try {
      if (logoUrl.startsWith('data:')) {
        // data: URL (base64 inline)
        const base64 = logoUrl.split(',')[1];
        logoBuffer = Buffer.from(base64, 'base64');
      } else if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
        // URL absolue — télécharger
        const res = await fetch(logoUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        logoBuffer = Buffer.from(arrayBuffer);
      } else {
        // Chemin relatif (/uploads/... ou /media/...) — lire depuis le filesystem
        // du backend. On essaie plusieurs préfixes courants.
        const baseUrl = (process.env.APP_PUBLIC_URL || process.env.FRONTEND_URL || '').replace(/\/$/, '');
        const isAbsoluteFs = logoUrl.startsWith('/');

        // Tentative 1 : fichier local (si on a accès au filesystem)
        if (isAbsoluteFs) {
          // Construire un chemin absolu plausible : public/ + path, ou uploads/ + path
          const candidates = [
            path.join(process.cwd(), 'public', logoUrl),
            path.join(process.cwd(), 'uploads', logoUrl.replace(/^\/uploads\//, '')),
            path.join(process.cwd(), logoUrl),
          ];
          for (const candidate of candidates) {
            try {
              if (fs.existsSync(candidate)) {
                logoBuffer = fs.readFileSync(candidate);
                break;
              }
            } catch {
              // continue
            }
          }
        }

        // Tentative 2 : télécharger via l'URL publique si baseUrl est configurée
        if (!logoBuffer && baseUrl) {
          try {
            const fullUrl = `${baseUrl}${logoUrl.startsWith('/') ? '' : '/'}${logoUrl}`;
            const res = await fetch(fullUrl);
            if (res.ok) {
              const arrayBuffer = await res.arrayBuffer();
              logoBuffer = Buffer.from(arrayBuffer);
            }
          } catch {
            // ignore — fallback to QR without logo
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Logo load failed (url=${logoUrl}): ${(err as Error).message} — fallback to QR without logo`);
      return `data:image/png;base64,${qrBuffer.toString('base64')}`;
    }

    if (!logoBuffer) {
      this.logger.warn(`Logo not found (url=${logoUrl}) — fallback to QR without logo`);
      return `data:image/png;base64,${qrBuffer.toString('base64')}`;
    }

    // 4. Redimensionner le logo + ajouter padding blanc (carré) pour le
    //    détacher visuellement des modules du QR code.
    const logoFinalSize = Math.floor(QR_SIZE * LOGO_RATIO);
    const padding = Math.floor(logoFinalSize * 0.12); // 12% padding autour du logo
    const logoWithPaddingSize = logoFinalSize + padding * 2;

    try {
      const resizedLogo = await sharp(logoBuffer)
        .resize(logoFinalSize, logoFinalSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
        .extend({
          top: padding,
          bottom: padding,
          left: padding,
          right: padding,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        })
        .png()
        .toBuffer();

      // 5. Compose : QR code + logo centré
      const centerX = Math.floor((QR_SIZE - logoWithPaddingSize) / 2);
      const centerY = Math.floor((QR_SIZE - logoWithPaddingSize) / 2);

      const finalBuffer = await sharp(qrBuffer)
        .composite([{ input: resizedLogo, left: centerX, top: centerY }])
        .png()
        .toBuffer();

      return `data:image/png;base64,${finalBuffer.toString('base64')}`;
    } catch (err) {
      this.logger.warn(`Logo composite failed: ${(err as Error).message} — fallback to QR without logo`);
      return `data:image/png;base64,${qrBuffer.toString('base64')}`;
    }
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

  /**
   * ⭐ Récupère l'ID d'UNE SEULE carte (la plus récente, non révoquée) pour
   * l'aperçu PDF du studio de design. Évite de charger toutes les cartes via
   * `listCardsGroupedByClass` qui prend >1 minute pour 700+ élèves.
   *
   * Retourne null si aucune carte n'existe encore pour ce tenant/année.
   */
  async getPreviewCardId(tenantId: string, academicYearId?: string): Promise<string | null> {
    const where: any = {
      tenantId,
      isActive: true,
      isRevoked: false,
    };
    if (academicYearId) {
      where.academicYearId = academicYearId;
    }
    const card = await this.prisma.studentIdCard.findFirst({
      where,
      orderBy: { generatedAt: 'desc' },
      select: { id: true },
    });
    return card?.id ?? null;
  }

  // ==========================================================================
  //  CMS CARTE SCOLAIRE — TEMPLATES DE DESIGN (Task 19-a, Phase 2)
  // ==========================================================================

  /**
   * Définition des 4 presets système (CLASSIQUE, MODERNE, MINIMALISTE, BILINGUE).
   * Le `layout` est un JSON libre consommé par generateCardHtml (couleurs,
   * flags d'affichage, texts, marges, orientation logo, etc.).
   *
   * Les presets système ne sont jamais supprimés (isSystem=true) — on peut
   * uniquement les désactiver (isActive=false). Les valeurs par défaut
   * correspondent au design bleu marine historique (rétrocompatible).
   */
  private static readonly DEFAULT_TEMPLATES: Array<{
    key: string;
    name: string;
    layout: Record<string, any>;
  }> = [
    {
      key: 'CLASSIQUE',
      name: 'Classique (bleu marine)',
      layout: {
        cardPrimaryColor: '#0D1F6E',
        cardSecondaryColor: '#1A237E',
        cardShowQRCode: true,
        cardShowBarcode: true,
        cardShowPhoto: true,
        cardShowGuardian: true,
        cardShowSchoolAddress: true,
        cardFooterText: 'Academia Helm · Document officiel',
        cardConditionsText:
          "Cette carte est strictement personnelle et incessible. À présenter à toute demande du personnel autorisé. Signaler toute perte ou vol à l'administration.",
        orientation: 'portrait',
        photoPosition: 'left',
        signatureLabel: 'Le Directeur',
      },
    },
    {
      key: 'MODERNE',
      name: 'Moderne (vert émeraude)',
      layout: {
        cardPrimaryColor: '#0F766E',
        cardSecondaryColor: '#14B8A6',
        cardShowQRCode: true,
        cardShowBarcode: true,
        cardShowPhoto: true,
        cardShowGuardian: true,
        cardShowSchoolAddress: true,
        cardFooterText: 'Carte officielle · Vérifiable en ligne',
        cardConditionsText:
          "Carte strictement personnelle. À présenter à toute réquisition de l'administration. Perte ou vol à signaler immédiatement.",
        orientation: 'portrait',
        photoPosition: 'left',
        signatureLabel: 'La Direction',
      },
    },
    {
      key: 'MINIMALISTE',
      name: 'Minimaliste (gris anthracite)',
      layout: {
        cardPrimaryColor: '#1F2937',
        cardSecondaryColor: '#374151',
        cardShowQRCode: true,
        cardShowBarcode: false,
        cardShowPhoto: true,
        cardShowGuardian: false,
        cardShowSchoolAddress: false,
        cardFooterText: 'Document officiel',
        cardConditionsText:
          "Carte personnelle et incessible. À présenter à toute demande du personnel autorisé.",
        orientation: 'portrait',
        photoPosition: 'left',
        signatureLabel: 'Signature',
      },
    },
    {
      key: 'BILINGUE',
      name: 'Bilingue (français / anglais)',
      layout: {
        cardPrimaryColor: '#7C2D12',
        cardSecondaryColor: '#B91C1C',
        cardShowQRCode: true,
        cardShowBarcode: true,
        cardShowPhoto: true,
        cardShowGuardian: true,
        cardShowSchoolAddress: true,
        cardFooterText: 'School ID Card · Academia Helm',
        cardConditionsText:
          "FR : Cette carte est strictement personnelle et incessible. Signaler toute perte ou vol. | EN: This card is strictly personal and non-transferable. Report any loss or theft.",
        orientation: 'portrait',
        photoPosition: 'left',
        signatureLabel: 'Director · Le Directeur',
        bilingual: true,
      },
    },
  ];

  /**
   * ⭐ S'assure que les 4 templates système existent pour ce tenant.
   * Idempotent : ne crée que les presets manquants (basé sur la clé unique
   * `tenantId + key`). Retourne la liste complète des templates du tenant.
   *
   * À appeler :
   *   - au démarrage de l'API (once per tenant, lazy)
   *   - à l'ouverture du CMS Carte Scolaire (GET /students/id-cards/templates)
   *   - à la création d'un nouveau tenant
   */
  async ensureDefaultTemplates(tenantId: string) {
    if (!tenantId) {
      throw new BadRequestException('tenantId est requis');
    }

    // Lister les templates système déjà présents
    const existing = await this.prisma.cardDesignTemplate.findMany({
      where: { tenantId, isSystem: true },
      select: { key: true },
    });
    const existingKeys = new Set(existing.map((t) => t.key));

    const missing = StudentIdCardService.DEFAULT_TEMPLATES.filter(
      (t) => !existingKeys.has(t.key),
    );

    if (missing.length > 0) {
      await this.prisma.cardDesignTemplate.createMany({
        data: missing.map((t) => ({
          tenantId,
          name: t.name,
          key: t.key,
          layout: t.layout as any,
          isSystem: true,
          isActive: true,
        })),
        skipDuplicates: true,
      });
      this.logger.log(
        `🎨 ${missing.length} template(s) système créé(s) pour tenant ${tenantId}: ` +
          missing.map((t) => t.key).join(', '),
      );
    }

    // Retourner la liste complète (système + personnalisés), actifs d'abord
    return this.prisma.cardDesignTemplate.findMany({
      where: { tenantId },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Liste tous les templates (actifs + archivés) du tenant.
   * Appelle ensureDefaultTemplates au passage pour garantir la présence des
   * presets système (lazy init).
   */
  async listTemplates(tenantId: string, options?: { includeArchived?: boolean }) {
    await this.ensureDefaultTemplates(tenantId);
    return this.prisma.cardDesignTemplate.findMany({
      where: {
        tenantId,
        ...(options?.includeArchived ? {} : { isActive: true }),
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Récupère un template par clé (CLASSIQUE, MODERNE, etc.) ou par id.
   * S'assure au passage que les presets système existent.
   */
  async getTemplate(tenantId: string, keyOrId: string) {
    await this.ensureDefaultTemplates(tenantId);
    const template = await this.prisma.cardDesignTemplate.findFirst({
      where: {
        tenantId,
        OR: [{ key: keyOrId }, { id: keyOrId }],
      },
    });
    if (!template) {
      throw new NotFoundException(`Template "${keyOrId}" introuvable`);
    }
    return template;
  }

  /**
   * Crée un template personnalisé (non-système) pour le tenant.
   */
  async createCustomTemplate(
    tenantId: string,
    data: { name: string; key: string; layout: Record<string, any> },
  ) {
    if (!data.name || !data.key) {
      throw new BadRequestException('name et key sont requis');
    }
    // Nettoyer la clé (UPPERCASE, alphanumérique + underscore)
    const cleanKey = data.key.toUpperCase().replace(/[^A-Z0-9_]/g, '_').substring(0, 64);
    if (cleanKey === 'CLASSIQUE' || cleanKey === 'MODERNE' || cleanKey === 'MINIMALISTE' || cleanKey === 'BILINGUE') {
      throw new BadRequestException(`La clé "${cleanKey}" est réservée aux presets système`);
    }
    try {
      return await this.prisma.cardDesignTemplate.create({
        data: {
          tenantId,
          name: data.name,
          key: cleanKey,
          layout: data.layout as any,
          isSystem: false,
          isActive: true,
        },
      });
    } catch (err: any) {
      // Prisma lance une erreur P2002 si la clé unique (tenantId, key) existe déjà
      if (err?.code === 'P2002') {
        throw new BadRequestException(`Un template avec la clé "${cleanKey}" existe déjà`);
      }
      throw err;
    }
  }

  /**
   * Met à jour un template personnalisé (nom + layout).
   * Les templates système ne peuvent PAS être modifiés (lecture seule) —
   * l'admin doit dupliquer puis personnaliser.
   */
  async updateCustomTemplate(
    tenantId: string,
    templateId: string,
    data: { name?: string; layout?: Record<string, any>; isActive?: boolean },
  ) {
    const template = await this.prisma.cardDesignTemplate.findFirst({
      where: { id: templateId, tenantId },
    });
    if (!template) {
      throw new NotFoundException(`Template ${templateId} introuvable`);
    }
    if (template.isSystem && data.layout) {
      throw new BadRequestException(
        'Les templates système ne peuvent pas être modifiés. Dupliquez le template pour le personnaliser.',
      );
    }
    return this.prisma.cardDesignTemplate.update({
      where: { id: templateId },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.layout !== undefined ? { layout: data.layout as any } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  /**
   * Archive un template (soft delete : isActive=false).
   * Les templates système ne peuvent PAS être archivés.
   */
  async archiveTemplate(tenantId: string, templateId: string) {
    const template = await this.prisma.cardDesignTemplate.findFirst({
      where: { id: templateId, tenantId },
    });
    if (!template) {
      throw new NotFoundException(`Template ${templateId} introuvable`);
    }
    if (template.isSystem) {
      throw new BadRequestException('Les templates système ne peuvent pas être archivés');
    }
    return this.prisma.cardDesignTemplate.update({
      where: { id: templateId },
      data: { isActive: false },
    });
  }

  /**
   * Construit un `designSnapshot` JSON à partir d'un template + du
   * TenantIdentityProfile actif. Le snapshot est stocké sur chaque carte
   * générée pour garantir la reproductibilité (la carte conserve son design
   * d'origine même si l'admin modifie le profil ou le template après coup).
   */
  private buildDesignSnapshot(template: any | null, identityProfile: any | null): Record<string, any> {
    const tplLayout = (template?.layout as Record<string, any>) || {};
    return {
      templateKey: template?.key || null,
      templateName: template?.name || null,
      cardPrimaryColor: tplLayout.cardPrimaryColor || identityProfile?.cardPrimaryColor || '#0D1F6E',
      cardSecondaryColor: tplLayout.cardSecondaryColor || identityProfile?.cardSecondaryColor || '#1A237E',
      cardShowQRCode: tplLayout.cardShowQRCode ?? identityProfile?.cardShowQRCode ?? true,
      cardShowBarcode: tplLayout.cardShowBarcode ?? identityProfile?.cardShowBarcode ?? true,
      cardShowPhoto: tplLayout.cardShowPhoto ?? identityProfile?.cardShowPhoto ?? true,
      cardShowGuardian: tplLayout.cardShowGuardian ?? identityProfile?.cardShowGuardian ?? true,
      cardShowSchoolAddress:
        tplLayout.cardShowSchoolAddress ?? identityProfile?.cardShowSchoolAddress ?? true,
      cardFooterText:
        tplLayout.cardFooterText || identityProfile?.cardFooterText || 'Academia Helm · Document officiel',
      cardConditionsText:
        tplLayout.cardConditionsText ||
        identityProfile?.cardConditionsText ||
        "Cette carte est strictement personnelle et incessible. À présenter à toute demande du personnel autorisé. Signaler toute perte ou vol à l'administration.",
      capturedAt: new Date().toISOString(),
    };
  }
}

