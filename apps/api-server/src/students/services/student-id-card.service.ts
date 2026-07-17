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
      const cardHtml = await this.generateCardHtml(
        student,
        enr.class,
        student.identifier.globalMatricule,
        qrPayload,
        identityProfile,
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

    return this.generateCardHtml(student, currentClass, matricule, qrPayload, identityProfile);
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
  ): Promise<string> {
    const formatDate = (date: Date | null) => {
      if (!date) return 'N/A';
      return new Date(date).toLocaleDateString('fr-FR', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    const academicYear = student.academicYear;
    const schoolLevel = student.schoolLevel;
    const tenant = student.tenant;

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

    // Générer un code-barres visuel simple (barres verticales basées sur le matricule)
    const barcodeBars = Array.from(matricule).map((char, i) => {
      const code = char.charCodeAt(0);
      const width = 1 + (code % 3); // 1, 2 ou 3 px
      const isBlack = i % 2 === 0;
      return `<div style="width:${width}px;height:100%;background:${isBlack ? '#000' : '#fff'};"></div>`;
    }).join('');

    // Contact parent (si disponible)
    const guardian = student.studentGuardians?.[0]?.guardian;
    const guardianName = guardian ? `${guardian.firstName || ''} ${guardian.lastName || ''}`.trim() : 'N/A';
    const guardianPhone = guardian?.phone || 'N/A';

    // Adresse école (si disponible) — priorité au TenantIdentityProfile
    const schoolAddress = identityProfile?.address || tenant?.address || 'Cotonou, Bénin';
    const schoolPhone = identityProfile?.phonePrimary || tenant?.phone || '+229 01 00 00 00 00';
    const schoolEmail = identityProfile?.email || tenant?.email || 'contact@ecole.bj';

    // Slogan / type d'établissement — priorité au TenantIdentityProfile
    const schoolName = identityProfile?.schoolName || tenant?.name || 'Établissement Scolaire';
    const schoolSlogan = identityProfile?.slogan || tenant?.slogan || 'Excellence • Discipline • Travail';

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
      font-family: '${fontFamily}', Arial, sans-serif;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-size: ${fontSizeMultiplier * 100}%;
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
    /* En-tête bleu marine — logo à gauche, nom école centré, titre à droite */
    .card-header {
      background: ${headerBackground};
      color: #fff;
      padding: 3px 6px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      min-height: 12mm;
      gap: 4px;
      position: relative;
    }
    /* Ligne diagonale décorative séparant header du body */
    .card-header::after {
      content: '';
      position: absolute;
      left: 0; right: 0; bottom: -1px;
      height: 2px;
      background: linear-gradient(90deg, transparent 0%, ${NAVY_LIGHT} 50%, transparent 100%);
      opacity: 0.6;
    }
    .header-logo {
      width: ${logoDimensions};
      height: ${logoDimensions};
      background: #fff;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
      padding: 1px;
    }
    .header-school {
      flex: 1;
      text-align: center;
      padding: 0 2px;
      min-width: 0;
    }
    .header-school-name {
      font-size: 8.5pt;
      font-weight: 800;
      line-height: 1.1;
      text-transform: uppercase;
      letter-spacing: 0.3px;
      word-break: break-word;
      hyphens: auto;
    }
    .header-school-slogan {
      font-size: 5.5pt;
      opacity: 0.85;
      margin-top: 1px;
      font-style: italic;
      line-height: 1.1;
    }
    .header-card-title {
      font-size: 6pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.95;
      padding: 2px 4px;
      background: rgba(255,255,255,0.18);
      border-radius: 3px;
      flex-shrink: 0;
    }

    /* Corps de la carte — photo à gauche, infos à droite */
    .card-body {
      flex: 1;
      display: flex;
      padding: 4px 6px;
      gap: 5px;
      background: #fff;
      align-items: stretch;
    }
    .photo-box {
      width: ${photoDimensions.w};
      height: ${photoDimensions.h};
      border: 2px solid ${NAVY};
      border-radius: ${photoBorderRadius};
      overflow: hidden;
      background: #f3f4f6;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      align-self: center;
    }
    .info-list {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 1.8px;
      min-width: 0;
    }
    .info-row {
      display: flex;
      align-items: baseline;
      line-height: 1.25;
    }
    .info-label {
      font-weight: 700;
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
      word-break: break-word;
    }
    .info-value.bold {
      font-weight: 700;
      font-size: 8pt;
    }
    .matricule-box {
      margin-top: 3px;
      padding: 2.5px 4px;
      background: ${NAVY};
      color: #fff;
      font-size: 7pt;
      font-weight: 800;
      text-align: center;
      border-radius: 3px;
      letter-spacing: 0.5px;
    }

    /* Pied de carte bleu marine — adresse + téléphone */
    .card-footer {
      background: ${NAVY};
      color: #fff;
      padding: 3px 6px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 6pt;
      min-height: 5.5mm;
      gap: 4px;
    }
    .footer-address {
      opacity: 0.9;
      flex: 1;
      min-width: 0;
      line-height: 1.2;
    }
    .footer-phone {
      opacity: 0.95;
      font-weight: 700;
      flex-shrink: 0;
    }

    /* === VERSO === */
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
    .verso-terms-title {
      font-size: 7pt;
      font-weight: 800;
      color: ${NAVY};
      text-transform: uppercase;
      letter-spacing: 0.3px;
      margin-bottom: 2px;
      padding-bottom: 1px;
      border-bottom: 1px solid ${NAVY_LIGHT};
    }
    .verso-terms {
      font-size: 5pt;
      line-height: 1.3;
      color: #6b7280;
      margin-bottom: 3px;
    }
    .verso-terms p {
      font-size: 5pt;
      line-height: 1.3;
      color: #6b7280;
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
      font-weight: 700;
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
    .verso-dates {
      font-size: 5.5pt;
      color: #424242;
      text-align: center;
      line-height: 1.4;
      width: 100%;
    }
    .verso-dates strong {
      color: ${NAVY};
      font-size: 5.5pt;
    }
    /* QR code avec logo intégré au centre — taille configurable */
    .verso-qr {
      width: ${qrDimensions};
      height: ${qrDimensions};
      border: 1px solid ${NAVY_LIGHT};
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
      padding: 1px;
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
      width: 100%;
    }
    .verso-signature-line {
      font-family: 'Brush Script MT', cursive;
      font-size: 10pt;
      color: ${NAVY};
      font-style: italic;
      border-bottom: 1px solid #9ca3af;
      padding-bottom: 1px;
      margin-bottom: 1px;
    }
    .verso-barcode {
      display: flex;
      align-items: center;
      height: 5mm;
      width: 100%;
      gap: 0;
      padding: 0 2px;
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
        <div class="header-logo">${headerLogoHtml}</div>
        <div class="header-school">
          <div class="header-school-name">${schoolName}</div>
          <div class="header-school-slogan">${schoolSlogan}</div>
        </div>
        <div class="header-card-title">Carte Scolaire</div>
      </div>

      <div class="card-body"${photoPosition === 'right' ? ' style="flex-direction: row-reverse;"' : ''}>
        ${photoBoxHtml}
        <div class="info-list">
          ${showMatricule ? `<div class="info-row">
            <span class="info-label">Matricule</span>
            <span class="info-value bold">${matricule}</span>
          </div>` : ''}
          <div class="info-row">
            <span class="info-label">Nom</span>
            <span class="info-value ${studentNameStyle === 'bold' ? 'bold' : ''}"${studentNameStyle === 'uppercase' ? ' style="text-transform: uppercase;"' : ''}>${student.lastName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Prénom(s)</span>
            <span class="info-value ${studentNameStyle === 'bold' ? 'bold' : ''}"${studentNameStyle === 'uppercase' ? ' style="text-transform: uppercase;"' : ''}>${student.firstName}</span>
          </div>
          ${showBirthInfo ? `<div class="info-row">
            <span class="info-label">Né(e) le</span>
            <span class="info-value">${formatDate(student.dateOfBirth)}${student.placeOfBirth ? ' à ' + student.placeOfBirth : ''}</span>
          </div>` : ''}
          ${showGender ? `<div class="info-row">
            <span class="info-label">Sexe</span>
            <span class="info-value">${student.gender === 'M' ? 'Masculin' : student.gender === 'F' ? 'Féminin' : 'N/A'}</span>
          </div>` : ''}
          <div class="info-row">
            <span class="info-label">Classe</span>
            <span class="info-value">${currentClass?.name || 'N/A'}</span>
          </div>
          ${showLevel ? `<div class="info-row">
            <span class="info-label">Niveau</span>
            <span class="info-value">${schoolLevel?.label || schoolLevel?.name || schoolLevel?.code || 'N/A'}</span>
          </div>` : ''}
          ${showGuardian ? `<div class="info-row">
            <span class="info-label">Parent/Tuteur</span>
            <span class="info-value">${guardianName}</span>
          </div>` : ''}
          ${showEmergencyCall ? `<div class="info-row">
            <span class="info-label">Urgence</span>
            <span class="info-value">${guardianPhone}</span>
          </div>` : ''}
        </div>
      </div>

      <div class="card-footer">
        ${showSchoolAddress ? `<div class="footer-address">${schoolAddress}</div>` : '<div></div>'}
        <div class="footer-phone">Tél. ${schoolPhone}</div>
      </div>
    </div>

    <!-- ============ VERSO ============ -->
    <div class="card card-back">
      <div class="card-header">
        <div class="header-card-title" style="background:transparent;">${footerText}</div>
        <div class="header-school">
          <div class="header-school-name" style="font-size:8pt;">${schoolName}</div>
          <div class="header-school-slogan">Année ${academicYear?.name || ''}</div>
        </div>
        <div class="header-logo" style="width:9mm;height:9mm;">${headerLogoHtml}</div>
      </div>

      <div class="verso-body">
        <div class="verso-section">
          <div class="verso-left">
            <div class="verso-terms-title">Conditions d'utilisation</div>
            <div class="verso-terms">
              <p>${conditionsText}</p>
            </div>
            <div class="verso-contact">
              <div><span class="verso-contact-label">Téléphone</span> ${schoolPhone}</div>
              <div><span class="verso-contact-label">Email</span> ${schoolEmail}</div>
              <div><span class="verso-contact-label">Adresse</span> ${schoolAddress}</div>
            </div>
          </div>
          <div class="verso-right">
            <div class="verso-dates">
              <div><strong>Émise le</strong></div>
              <div>${joinedDate}</div>
              <div style="margin-top:2px;"><strong>Expire le</strong></div>
              <div>${expireDate}</div>
            </div>
            ${showQRCode && qrCodeDataUrl ? `<div class="verso-qr"><img src="${qrCodeDataUrl}" alt="QR" /></div>` : ''}
            <div class="verso-signature">
              <div class="verso-signature-line">Le Directeur</div>
              <div>Signature & Cachet</div>
            </div>
            ${showBarcode ? `<div class="verso-barcode">${barcodeBars}</div>` : ''}
          </div>
        </div>
      </div>

      <div class="card-footer">
        <div class="footer-address">${footerText}</div>
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

