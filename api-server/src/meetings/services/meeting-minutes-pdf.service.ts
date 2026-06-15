import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PuppeteerPoolService } from '../../common/services/puppeteer-pool.service';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Service pour la génération PDF des comptes rendus officiels
 * 
 * Utilise Puppeteer pour la génération HTML → PDF
 * 
 * Installation requise:
 * npm install puppeteer
 * 
 * NOTE: Puppeteer nécessite des outils de build (Visual Studio Build Tools sur Windows)
 * Alternative: Utiliser puppeteer-core avec un Chrome/Chromium externe
 */
@Injectable()
export class MeetingMinutesPdfService {
  private readonly logger = new Logger(MeetingMinutesPdfService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
  ) {}

  /**
   * Génère un PDF officiel depuis un compte rendu
   */
  async generatePdf(minutesId: string, tenantId: string): Promise<{ pdfPath: string; pdfBuffer?: Buffer }> {
    // Récupérer le compte rendu avec toutes ses données
    const minutes = await this.prisma.meetingMinutes.findFirst({
      where: {
        id: minutesId,
        meeting: {
          tenantId,
        },
      },
      include: {
        meeting: {
          include: {
            academicYear: true,
            schoolLevel: true,
            class: true,
            creator: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            participants: {
              include: {
                inviter: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            agendas: {
              orderBy: { agendaOrder: 'asc' },
            },
            decisions: {
              orderBy: { decisionOrder: 'asc' },
              include: {
                responsible: {
                  select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
          },
        },
        recorder: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        validator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        template: true,
      },
    });

    if (!minutes) {
      throw new Error(`Minutes with ID ${minutesId} not found`);
    }

    // Préparer le HTML pour la génération PDF
    const htmlContent = this.generateHtmlContent(minutes);

    // Générer le PDF depuis le HTML
    // TODO: Implémenter la génération PDF avec puppeteer ou pdfkit
    const pdfBuffer = await this.renderPdfFromHtml(htmlContent);

    // Sauvegarder le PDF
    const pdfPath = await this.savePdf(minutesId, pdfBuffer);

    // Mettre à jour le compte rendu avec le chemin du PDF
    await this.prisma.meetingMinutes.update({
      where: { id: minutesId },
      data: {
        pdfPath,
        updatedAt: new Date(),
      },
    });

    return { pdfPath, pdfBuffer };
  }

  /**
   * Génère le contenu HTML à partir du compte rendu
   */
  private generateHtmlContent(minutes: any): string {
    const meeting = minutes.meeting;
    const renderedContent = minutes.renderedContent || minutes.content;

    // Convertir le markdown en HTML si nécessaire
    const htmlContent = this.markdownToHtml(renderedContent);

    // Générer le HTML complet avec en-tête et pied de page
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Compte rendu de réunion - ${meeting.title}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 40px;
      line-height: 1.6;
      color: #333;
    }
    .header {
      border-bottom: 2px solid #333;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #1a1a1a;
      margin: 0;
    }
    .metadata {
      margin-top: 20px;
      font-size: 0.9em;
      color: #666;
    }
    .section {
      margin: 30px 0;
    }
    .section h2 {
      color: #1a1a1a;
      border-bottom: 1px solid #ccc;
      padding-bottom: 10px;
      margin-top: 30px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    table th, table td {
      border: 1px solid #ddd;
      padding: 12px;
      text-align: left;
    }
    table th {
      background-color: #f2f2f2;
      font-weight: bold;
    }
    .footer {
      margin-top: 50px;
      padding-top: 20px;
      border-top: 1px solid #ccc;
      font-size: 0.9em;
      color: #666;
    }
    .signature {
      margin-top: 40px;
      border-top: 1px solid #333;
      padding-top: 20px;
    }
    @media print {
      body {
        margin: 20px;
      }
      .no-print {
        display: none;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>COMPTE RENDU DE RÉUNION</h1>
    <div class="metadata">
      <p><strong>Établissement :</strong> ${meeting.tenantId}</p>
      <p><strong>Type de réunion :</strong> ${meeting.meetingType}</p>
      <p><strong>Date :</strong> ${new Date(meeting.meetingDate).toLocaleDateString('fr-FR')}</p>
      <p><strong>Heure :</strong> ${meeting.startTime || ''} – ${meeting.endTime || ''}</p>
      <p><strong>Lieu :</strong> ${meeting.location || ''}</p>
      <p><strong>Année scolaire :</strong> ${meeting.academicYear?.name || ''}</p>
    </div>
  </div>

  <div class="content">
    ${htmlContent}
  </div>

  <div class="footer">
    <div class="signature">
      <p><strong>Rédigé par :</strong> ${minutes.recorder ? `${minutes.recorder.firstName} ${minutes.recorder.lastName}` : ''}</p>
      <p><strong>Date de rédaction :</strong> ${minutes.recordedAt ? new Date(minutes.recordedAt).toLocaleDateString('fr-FR') : ''}</p>
      ${minutes.validated ? `
        <p><strong>Validé par :</strong> ${minutes.validator ? `${minutes.validator.firstName} ${minutes.validator.lastName}` : ''}</p>
        <p><strong>Date de validation :</strong> ${minutes.validatedAt ? new Date(minutes.validatedAt).toLocaleDateString('fr-FR') : ''}</p>
        <p><strong>Signature électronique :</strong> [Signature électronique]</p>
      ` : ''}
    </div>
    <p style="margin-top: 30px; font-size: 0.8em; color: #999;">
      Document généré automatiquement par Academia Hub le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}
    </p>
  </div>
</body>
</html>
    `;
  }

  /**
   * Convertit le markdown en HTML
   * NOTE: Pour une conversion complète, utiliser une bibliothèque comme marked ou markdown-it
   */
  private markdownToHtml(markdown: string): string {
    let html = markdown;

    // Conversion basique du markdown en HTML
    // Titres
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');

    // Gras
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // Listes
    html = html.replace(/^- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');

    // Tableaux (format markdown basique)
    // TODO: Améliorer le parsing des tableaux markdown

    // Paragraphes
    html = html.replace(/\n\n/g, '</p><p>');
    html = '<p>' + html + '</p>';

    return html;
  }

  /**
   * Rend le PDF depuis le HTML en utilisant Puppeteer
   */
  private async renderPdfFromHtml(htmlContent: string): Promise<Buffer> {
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
      });
      return Buffer.from(pdfBuffer);
    } catch (error) {
      this.logger.error('Error generating PDF with Puppeteer:', error);
      throw new Error(`PDF generation failed: ${error.message}`);
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  /**
   * Sauvegarde le PDF sur le système de fichiers
   */
  private async savePdf(minutesId: string, pdfBuffer: Buffer): Promise<string> {
    try {
      const pdfDir = path.join(process.cwd(), 'uploads', 'meeting-minutes');
      
      // Créer le répertoire s'il n'existe pas
      if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir, { recursive: true });
      }

      const timestamp = Date.now();
      const pdfFileName = `minutes-${minutesId}-${timestamp}.pdf`;
      const pdfPath = path.join(pdfDir, pdfFileName);

      // Sauvegarder le PDF
      fs.writeFileSync(pdfPath, pdfBuffer);

      // Retourner le chemin relatif pour stockage en base
      return `uploads/meeting-minutes/${pdfFileName}`;
    } catch (error) {
      this.logger.error('Error saving PDF:', error);
      throw new Error(`Failed to save PDF: ${error.message}`);
    }
  }

  /**
   * Récupère le PDF d'un compte rendu
   */
  async getPdf(minutesId: string, tenantId: string): Promise<{ pdfPath: string; pdfBuffer?: Buffer }> {
    const minutes = await this.prisma.meetingMinutes.findFirst({
      where: {
        id: minutesId,
        meeting: {
          tenantId,
        },
      },
    });

    if (!minutes) {
      throw new Error(`Minutes with ID ${minutesId} not found`);
    }

    if (!minutes.pdfPath) {
      // Générer le PDF s'il n'existe pas encore
      return this.generatePdf(minutesId, tenantId);
    }

    // Lire le PDF depuis le système de fichiers
    try {
      const fullPath = path.join(process.cwd(), minutes.pdfPath);
      if (fs.existsSync(fullPath)) {
        const pdfBuffer = fs.readFileSync(fullPath);
        return { pdfPath: minutes.pdfPath, pdfBuffer };
      } else {
        // Si le fichier n'existe pas, régénérer
        this.logger.warn(`PDF file not found at ${fullPath}, regenerating...`);
        return this.generatePdf(minutesId, tenantId);
      }
    } catch (error) {
      this.logger.error('Error reading PDF file:', error);
      // Régénérer en cas d'erreur
      return this.generatePdf(minutesId, tenantId);
    }
  }
}

