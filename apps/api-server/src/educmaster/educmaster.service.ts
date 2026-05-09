import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import * as ExcelJS from 'exceljs';

@Injectable()
export class EducMasterService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Génère un fichier Excel au format officiel EducMaster pour l'export des élèves
   */
  async exportStudents(tenantId: string, academicYearId: string) {
    const students = await this.prisma.student.findMany({
      where: {
        tenantId,
        isActive: true,
        enrollments: {
          some: {
            academicYearId,
            status: 'ACTIVE',
          },
        },
      },
      include: {
        enrollments: {
          where: { academicYearId },
          include: {
            class: true,
          },
        },
        guardians: {
          include: {
            guardian: true,
          },
        },
      },
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Export EducMaster');

    // Colonnes EducMaster (Exemple basé sur les standards Bénin)
    worksheet.columns = [
      { header: 'Matricule', key: 'matricule', width: 15 },
      { header: 'Nom', key: 'lastName', width: 20 },
      { header: 'Prénom', key: 'firstName', width: 25 },
      { header: 'Date de Naissance', key: 'birthDate', width: 15 },
      { header: 'Lieu de Naissance', key: 'birthPlace', width: 20 },
      { header: 'Sexe', key: 'gender', width: 10 },
      { header: 'Classe', key: 'class', width: 15 },
      { header: 'Nom Père/Tuteur', key: 'guardianName', width: 25 },
      { header: 'Téléphone Tuteur', key: 'guardianPhone', width: 15 },
    ];

    students.forEach(student => {
      const enrollment = student.enrollments[0];
      const guardian = student.guardians[0]?.guardian;

      worksheet.addRow({
        matricule: student.studentCode,
        lastName: student.lastName,
        firstName: student.firstName,
        birthDate: student.birthDate ? student.birthDate.toISOString().split('T')[0] : '',
        birthPlace: student.birthPlace || '',
        gender: student.gender || '',
        class: enrollment?.class?.name || '',
        guardianName: guardian ? `${guardian.firstName} ${guardian.lastName}` : '',
        guardianPhone: guardian?.phone || '',
      });
    });

    return workbook;
  }
}
