import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Service pour le sous-module 9.3 - Bibliothèque
 */
@Injectable()
export class LibraryService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // CATEGORIES
  // ============================================================================

  async findAllCategories(tenantId: string) {
    return this.prisma.libraryCategory.findMany({
      where: { tenantId },
      include: { _count: { select: { books: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(tenantId: string, data: any) {
    return this.prisma.libraryCategory.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
      },
    });
  }

  // ============================================================================
  // BOOKS
  // ============================================================================

  async createBook(tenantId: string, academicYearId: string, data: any) {
    const book = await this.prisma.libraryBook.create({
      data: {
        tenantId,
        academicYearId,
        isbn: data.isbn,
        title: data.title,
        author: data.author,
        publisher: data.publisher,
        publicationYear: data.publicationYear,
        categoryId: data.categoryId,
        language: data.language || 'FR',
        summary: data.summary,
        coverUrl: data.coverUrl,
        location: data.location,
        totalCopies: data.totalCopies || 1,
        availableCopies: data.totalCopies || 1,
      },
    });

    // Créer les exemplaires
    if (data.totalCopies > 0) {
      for (let i = 1; i <= data.totalCopies; i++) {
        await this.prisma.libraryCopy.create({
          data: {
            bookId: book.id,
            copyNumber: `EX-${String(i).padStart(3, '0')}`,
            barcode: data.barcode ? `${data.barcode}-${i}` : `BC-${book.id.substring(0, 4)}-${i}`,
            status: 'AVAILABLE',
            condition: 'GOOD',
          },
        });
      }
    }

    return book;
  }

  async findAllBooks(tenantId: string, academicYearId: string, filters?: any) {
    const where: any = { tenantId, academicYearId };
    if (filters?.categoryId) where.categoryId = filters.categoryId;
    if (filters?.author) where.author = { contains: filters.author, mode: 'insensitive' };
    if (filters?.title) where.title = { contains: filters.title, mode: 'insensitive' };
    if (filters?.isActive !== undefined) where.isActive = filters.isActive;

    return this.prisma.libraryBook.findMany({
      where,
      include: {
        category: { select: { name: true } },
        _count: { select: { copies: true, loans: true } },
      },
      orderBy: { title: 'asc' },
    });
  }

  async findBookById(id: string, tenantId: string) {
    return this.prisma.libraryBook.findFirst({
      where: { id, tenantId },
      include: {
        category: true,
        copies: { include: { loans: { where: { status: 'ACTIVE' } } } },
        recommendations: { include: { teacher: { select: { firstName: true, lastName: true } } } },
      },
    });
  }

  // ============================================================================
  // LOANS
  // ============================================================================

  async loanBook(
    tenantId: string,
    academicYearId: string,
    data: { bookId: string; copyId: string; studentId?: string; staffId?: string; readerType: string; dueDate: Date },
    loanedBy: string,
  ) {
    const copy = await this.prisma.libraryCopy.findFirst({
      where: { id: data.copyId, bookId: data.bookId },
      include: { book: true },
    });

    if (!copy) throw new NotFoundException(`Copy with ID ${data.copyId} not found`);
    if (copy.status !== 'AVAILABLE') {
      throw new BadRequestException(`Copy is not available (status: ${copy.status})`);
    }

    // Créer l'emprunt
    const loan = await this.prisma.libraryLoan.create({
      data: {
        tenantId,
        academicYearId,
        bookId: data.bookId,
        copyId: data.copyId,
        studentId: data.studentId,
        staffId: data.staffId,
        readerType: data.readerType,
        loanDate: new Date(),
        dueDate: new Date(data.dueDate),
        status: 'ACTIVE',
        loanedBy,
      },
    });

    // Mettre à jour le statut de l'exemplaire et du livre
    await this.prisma.libraryCopy.update({
      where: { id: data.copyId },
      data: { status: 'LOANED' },
    });

    await this.prisma.libraryBook.update({
      where: { id: data.bookId },
      data: { availableCopies: { decrement: 1 } },
    });

    return loan;
  }

  async returnBook(loanId: string, tenantId: string, returnedBy: string, condition: string, observation?: string) {
    const loan = await this.prisma.libraryLoan.findFirst({
      where: { id: loanId, tenantId, status: 'ACTIVE' },
      include: { copy: true, book: true },
    });

    if (!loan) throw new NotFoundException(`Active loan with ID ${loanId} not found`);

    const returnDate = new Date();
    const isOverdue = returnDate > loan.dueDate;

    // Mettre à jour l'emprunt
    const updatedLoan = await this.prisma.libraryLoan.update({
      where: { id: loanId },
      data: {
        returnDate,
        status: isOverdue ? 'OVERDUE' : 'RETURNED',
        returnedBy,
        notes: observation,
      },
    });

    // Mettre à jour l'exemplaire
    await this.prisma.libraryCopy.update({
      where: { id: loan.copyId },
      data: { 
        status: 'AVAILABLE',
        condition: condition || loan.copy.condition
      },
    });

    // Mettre à jour le livre
    await this.prisma.libraryBook.update({
      where: { id: loan.bookId },
      data: { availableCopies: { increment: 1 } },
    });

    // Créer une pénalité si en retard
    if (isOverdue) {
      const daysLate = Math.floor((returnDate.getTime() - loan.dueDate.getTime()) / (1000 * 60 * 60 * 24));
      await this.prisma.libraryPenalty.create({
        data: {
          tenantId,
          loanId,
          penaltyDate: returnDate,
          penaltyType: 'LATE_RETURN',
          amount: daysLate * 500, // 500 XOF par jour de retard
          description: `${daysLate} jour(s) de retard`,
          status: 'PENDING',
        },
      });
    }

    // Gérer livre abîmé
    if (['DAMAGED', 'UNUSABLE'].includes(condition)) {
      await this.prisma.libraryPenalty.create({
        data: {
          tenantId,
          loanId,
          penaltyDate: returnDate,
          penaltyType: 'DAMAGED_BOOK',
          amount: 5000, // Forfait dégradation
          description: `Livre retourné dans l'état: ${condition}`,
          status: 'PENDING',
        },
      });
    }

    return updatedLoan;
  }

  // ============================================================================
  // RESERVATIONS
  // ============================================================================

  async findAllReservations(tenantId: string, bookId?: string) {
    const where: any = { tenantId };
    if (bookId) where.bookId = bookId;

    return this.prisma.libraryReservation.findMany({
      where,
      include: {
        book: { select: { title: true, author: true } },
        user: { select: { firstName: true, lastName: true } },
      },
      orderBy: { reserveDate: 'asc' },
    });
  }

  async createReservation(tenantId: string, academicYearId: string, bookId: string, userId: string) {
    return this.prisma.libraryReservation.create({
      data: {
        tenantId,
        academicYearId,
        bookId,
        userId,
        status: 'WAITING',
        expiryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 jours par défaut
      },
    });
  }

  // ============================================================================
  // INVENTORY
  // ============================================================================

  async createInventoryCampaign(tenantId: string, data: any) {
    return this.prisma.libraryInventoryCampaign.create({
      data: {
        tenantId,
        title: data.title,
        periodStart: new Date(data.periodStart),
        periodEnd: data.periodEnd ? new Date(data.periodEnd) : null,
        responsible: data.responsible,
        status: 'PLANNED',
      },
    });
  }

  async scanInventoryItem(campaignId: string, barcode: string, condition: string) {
    const copy = await this.prisma.libraryCopy.findFirst({
      where: { barcode },
    });
    if (!copy) throw new NotFoundException(`Copy with barcode ${barcode} not found`);

    return this.prisma.libraryInventoryItem.upsert({
      where: { campaignId_copyId: { campaignId, copyId: copy.id } },
      update: {
        status: 'SCANNED',
        scannedAt: new Date(),
        observation: `Condition: ${condition}`,
      },
      create: {
        campaignId,
        copyId: copy.id,
        status: 'SCANNED',
        scannedAt: new Date(),
        observation: `Condition: ${condition}`,
      },
    });
  }

  // ============================================================================
  // DIGITAL RESOURCES
  // ============================================================================

  async findAllDigitalResources(tenantId: string, academicYearId: string) {
    return this.prisma.libraryDigitalResource.findMany({
      where: { tenantId, academicYearId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDigitalResource(tenantId: string, academicYearId: string, data: any) {
    return this.prisma.libraryDigitalResource.create({
      data: {
        tenantId,
        academicYearId,
        title: data.title,
        type: data.type,
        subjectId: data.subjectId,
        author: data.author,
        fileUrl: data.fileUrl,
        externalUrl: data.externalUrl,
        accessRights: data.accessRights || 'PUBLIC_INTERNAL',
      },
    });
  }

  // ============================================================================
  // RECOMMENDATIONS & FAVORITES
  // ============================================================================

  async createRecommendation(tenantId: string, academicYearId: string, data: any, teacherId: string) {
    return this.prisma.libraryRecommendation.create({
      data: {
        tenantId,
        academicYearId,
        bookId: data.bookId,
        targetType: data.targetType,
        targetId: data.targetId,
        teacherId,
        comment: data.comment,
      },
    });
  }

  async toggleFavorite(userId: string, bookId: string) {
    const existing = await this.prisma.libraryFavorite.findUnique({
      where: { userId_bookId: { userId, bookId } },
    });

    if (existing) {
      await this.prisma.libraryFavorite.delete({ where: { id: existing.id } });
      return { favorited: false };
    }

    await this.prisma.libraryFavorite.create({ data: { userId, bookId } });
    return { favorited: true };
  }

  // ============================================================================
  // SETTINGS & REPORTS
  // ============================================================================

  async getSettings(tenantId: string) {
    return this.prisma.librarySetting.findMany({ where: { tenantId } });
  }

  async updateSetting(tenantId: string, key: string, value: any) {
    return this.prisma.librarySetting.upsert({
      where: { tenantId_key: { tenantId, key } },
      update: { value },
      create: { tenantId, key, value },
    });
  }

  async createReport(tenantId: string, academicYearId: string, data: any, userId: string) {
    return this.prisma.libraryReport.create({
      data: {
        tenantId,
        academicYearId,
        reportType: data.reportType,
        title: data.title,
        periodStart: data.periodStart ? new Date(data.periodStart) : null,
        periodEnd: data.periodEnd ? new Date(data.periodEnd) : null,
        content: data.content || {},
        generatedBy: userId,
      },
    });
  }

  // ============================================================================
  // STATISTICS
  // ============================================================================

  async getLibraryStats(tenantId: string, academicYearId: string) {
    const [booksCount, copiesCount, activeLoans, overdueLoans, totalReaders] = await Promise.all([
      this.prisma.libraryBook.count({ where: { tenantId, academicYearId } }),
      this.prisma.libraryCopy.count({ where: { book: { tenantId, academicYearId } } }),
      this.prisma.libraryLoan.count({ where: { tenantId, academicYearId, status: 'ACTIVE' } }),
      this.prisma.libraryLoan.count({ 
        where: { 
          tenantId, 
          academicYearId, 
          OR: [
            { status: 'OVERDUE' },
            { status: 'ACTIVE', dueDate: { lt: new Date() } }
          ]
        } 
      }),
      this.prisma.libraryLoan.groupBy({
        by: ['studentId', 'staffId'],
        where: { tenantId, academicYearId },
      }).then(res => res.length),
    ]);

    const availableCopies = await this.prisma.libraryCopy.count({
      where: { book: { tenantId, academicYearId }, status: 'AVAILABLE' }
    });

    return {
      totalBooks: booksCount,
      totalCopies: copiesCount,
      availableCopies,
      loanedCopies: copiesCount - availableCopies,
      loanRate: copiesCount > 0 ? ((copiesCount - availableCopies) / copiesCount) * 100 : 0,
      activeLoans,
      overdueLoans,
      totalReaders,
      lastUpdate: new Date()
    };
  }

  async findAllLoans(tenantId: string, academicYearId: string, filters?: any) {
    const where: any = { tenantId, academicYearId };
    if (filters?.studentId) where.studentId = filters.studentId;
    if (filters?.status) where.status = filters.status;
    if (filters?.readerType) where.readerType = filters.readerType;

    return this.prisma.libraryLoan.findMany({
      where,
      include: {
        book: { select: { title: true, author: true } },
        copy: { select: { copyNumber: true, barcode: true } },
        student: { select: { firstName: true, lastName: true } },
        staff: { select: { firstName: true, lastName: true } },
        loaner: { select: { firstName: true, lastName: true } },
        penalties: true,
      },
      orderBy: { loanDate: 'desc' },
    });
  }
}

