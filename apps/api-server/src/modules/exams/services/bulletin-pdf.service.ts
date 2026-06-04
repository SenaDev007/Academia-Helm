/**
 * ============================================================================
 * BULLETIN PDF SERVICE - MODULE 3
 * ============================================================================
 * 
 * Génération de bulletins officiels haute fidélité avec QR Code.
 * Utilise Handlebars pour le template et Puppeteer pour le rendu PDF.
 * 
 * ============================================================================
 */

import { Injectable, InternalServerErrorException } from '@nestjs/common';
// Puppeteer loaded dynamically to avoid OOM at startup (lazy import)
import * as handlebars from 'handlebars';
import * as QRCode from 'qrcode';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class BulletinPdfService {
  
  async generateBulletin(data: any): Promise<Buffer> {
    try {
      // 1. Charger le template Handlebars
      const templatePath = path.join(__dirname, '../templates/bulletin.hbs');
      const templateHtml = fs.readFileSync(templatePath, 'utf8');
      const template = handlebars.compile(templateHtml);

      // 2. Générer le QR Code (Base64)
      // On encode l'URL de vérification (ex: https://academia.helm/verify/BULLETIN_ID)
      const qrDataUrl = await QRCode.toDataURL(`https://academia.helm/verify/bulletin/${data.bulletinId}`);

      // 3. Préparer les données pour le template
      const htmlContent = template({
        ...data,
        qrCode: qrDataUrl,
        dateNow: new Date().toLocaleDateString('fr-FR'),
      });

      // 4. Lancer Puppeteer pour générer le PDF
      const puppeteer = await import('puppeteer');
      const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true,
      });
      
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });

      await browser.close();
      return Buffer.from(pdfBuffer);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new InternalServerErrorException('Erreur lors de la génération du bulletin PDF');
    }
  }
}
