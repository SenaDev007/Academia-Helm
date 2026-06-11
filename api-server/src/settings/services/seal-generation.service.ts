/**
 * ============================================================================
 * SEAL GENERATION SERVICE
 * ============================================================================
 * 
 * Service pour la génération réelle des cachets administratifs
 * - Génération SVG vectorielle
 * - Conversion SVG → PNG/PDF
 * - Support des différents types de cachets (institutionnel, nominatif, transactionnel)
 * - Paramètres avancés (couleurs, formes, textes circulaires, etc.)
 * 
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PuppeteerPoolService } from '../../common/services/puppeteer-pool.service';

@Injectable()
export class SealGenerationService {
  private readonly logger = new Logger(SealGenerationService.name);

  constructor(
    private readonly puppeteerPool: PuppeteerPoolService,
  ) {}

  /**
   * Génère un cachet au format SVG
   */
  async generateSVG(seal: any, versionData: any): Promise<string> {
    const {
      shape = 'ROUND',
      primaryColor = '#000000',
      secondaryColor = '#000000',
      textLayout = {},
      fontFamily = 'Arial, sans-serif',
      fontWeight = 'bold',
      fontSize = {},
      borderStyle = 'solid',
      borderThickness = 2,
      innerSymbols = [],
      rotation = 0,
      opacity = 100,
      logoUrl,
      signatureUrl,
    } = versionData;

    const {
      label,
      role,
      holderName,
      holderTitle,
      type,
    } = seal;

    // Dimensions du cachet
    const size = 200; // Taille de base en pixels
    const centerX = size / 2;
    const centerY = size / 2;
    const radius = size / 2 - 10;

    // Construire le SVG
    let svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" style="opacity: ${opacity / 100}">`;
    
    // Groupe avec rotation
    svg += `<g transform="rotate(${rotation} ${centerX} ${centerY})">`;

    // Fond selon la forme
    if (shape === 'ROUND') {
      svg += this.generateRoundSeal(centerX, centerY, radius, primaryColor, secondaryColor, borderStyle, borderThickness);
    } else if (shape === 'OVAL') {
      svg += this.generateOvalSeal(centerX, centerY, radius, primaryColor, secondaryColor, borderStyle, borderThickness);
    } else if (shape === 'RECTANGULAR') {
      svg += this.generateRectangularSeal(centerX, centerY, size, primaryColor, secondaryColor, borderStyle, borderThickness);
    }

    // Texte circulaire externe (pour cachets institutionnels)
    if (type === 'INSTITUTIONAL' && textLayout.externalText) {
      svg += this.generateCircularText(centerX, centerY, radius - 5, textLayout.externalText, primaryColor, fontFamily, fontWeight, fontSize.external || 12);
    }

    // Texte central
    if (type === 'INSTITUTIONAL' && role) {
      svg += this.generateCenterText(centerX, centerY, role, primaryColor, fontFamily, fontWeight, fontSize.center || 16);
    }

    // Texte pour cachets nominatifs
    if (type === 'NOMINATIVE') {
      if (holderName) {
        svg += this.generateCenterText(centerX, centerY - 10, holderName, primaryColor, fontFamily, fontWeight, fontSize.name || 14);
      }
      if (holderTitle) {
        svg += this.generateCenterText(centerX, centerY + 10, holderTitle, primaryColor, fontFamily, 'normal', fontSize.title || 12);
      }
    }

    // Texte pour cachets transactionnels
    if (type === 'TRANSACTIONAL' && label) {
      svg += this.generateCenterText(centerX, centerY, label, primaryColor, fontFamily, fontWeight, fontSize.transactional || 18);
    }

    // Logo si présent
    if (logoUrl) {
      svg += `<image href="${logoUrl}" x="${centerX - 20}" y="${centerY - 20}" width="40" height="40" opacity="0.8"/>`;
    }

    // Symboles intérieurs (étoiles, traits, etc.)
    if (innerSymbols && innerSymbols.length > 0) {
      svg += this.generateInnerSymbols(centerX, centerY, radius, innerSymbols, primaryColor);
    }

    // Signature si présente
    if (signatureUrl && type === 'NOMINATIVE') {
      svg += `<image href="${signatureUrl}" x="${centerX - 30}" y="${centerY + 20}" width="60" height="30" opacity="0.9"/>`;
    }

    svg += '</g>'; // Fin du groupe de rotation
    svg += '</svg>';

    return svg;
  }

  /**
   * Génère un cachet rond
   */
  private generateRoundSeal(
    centerX: number,
    centerY: number,
    radius: number,
    primaryColor: string,
    secondaryColor: string,
    borderStyle: string,
    borderThickness: number,
  ): string {
    let svg = '';

    // Cercle extérieur
    if (borderStyle === 'double') {
      svg += `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="${primaryColor}" stroke-width="${borderThickness}"/>`;
      svg += `<circle cx="${centerX}" cy="${centerY}" r="${radius - borderThickness - 2}" fill="none" stroke="${secondaryColor}" stroke-width="${borderThickness}"/>`;
    } else if (borderStyle === 'dashed') {
      svg += `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="${primaryColor}" stroke-width="${borderThickness}" stroke-dasharray="5,5"/>`;
    } else {
      svg += `<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="none" stroke="${primaryColor}" stroke-width="${borderThickness}"/>`;
    }

    return svg;
  }

  /**
   * Génère un cachet ovale
   */
  private generateOvalSeal(
    centerX: number,
    centerY: number,
    radius: number,
    primaryColor: string,
    secondaryColor: string,
    borderStyle: string,
    borderThickness: number,
  ): string {
    const rx = radius;
    const ry = radius * 0.7; // Ovale plus large que haut

    let svg = '';

    if (borderStyle === 'double') {
      svg += `<ellipse cx="${centerX}" cy="${centerY}" rx="${rx}" ry="${ry}" fill="none" stroke="${primaryColor}" stroke-width="${borderThickness}"/>`;
      svg += `<ellipse cx="${centerX}" cy="${centerY}" rx="${rx - borderThickness - 2}" ry="${ry - borderThickness - 2}" fill="none" stroke="${secondaryColor}" stroke-width="${borderThickness}"/>`;
    } else if (borderStyle === 'dashed') {
      svg += `<ellipse cx="${centerX}" cy="${centerY}" rx="${rx}" ry="${ry}" fill="none" stroke="${primaryColor}" stroke-width="${borderThickness}" stroke-dasharray="5,5"/>`;
    } else {
      svg += `<ellipse cx="${centerX}" cy="${centerY}" rx="${rx}" ry="${ry}" fill="none" stroke="${primaryColor}" stroke-width="${borderThickness}"/>`;
    }

    return svg;
  }

  /**
   * Génère un cachet rectangulaire
   */
  private generateRectangularSeal(
    centerX: number,
    centerY: number,
    size: number,
    primaryColor: string,
    secondaryColor: string,
    borderStyle: string,
    borderThickness: number,
  ): string {
    const width = size * 0.8;
    const height = size * 0.5;
    const x = centerX - width / 2;
    const y = centerY - height / 2;

    let svg = '';

    if (borderStyle === 'double') {
      svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="${primaryColor}" stroke-width="${borderThickness}"/>`;
      svg += `<rect x="${x + borderThickness + 2}" y="${y + borderThickness + 2}" width="${width - (borderThickness + 2) * 2}" height="${height - (borderThickness + 2) * 2}" fill="none" stroke="${secondaryColor}" stroke-width="${borderThickness}"/>`;
    } else if (borderStyle === 'dashed') {
      svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="${primaryColor}" stroke-width="${borderThickness}" stroke-dasharray="5,5"/>`;
    } else {
      svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="none" stroke="${primaryColor}" stroke-width="${borderThickness}"/>`;
    }

    return svg;
  }

  /**
   * Génère du texte circulaire (pour le bord extérieur)
   */
  private generateCircularText(
    centerX: number,
    centerY: number,
    radius: number,
    text: string,
    color: string,
    fontFamily: string,
    fontWeight: string,
    fontSize: number,
  ): string {
    const chars = text.split('');
    const angleStep = (360 / chars.length) * (Math.PI / 180);
    let svg = '';

    chars.forEach((char, index) => {
      const angle = index * angleStep - Math.PI / 2; // Commencer en haut
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      const rotation = (angle * 180) / Math.PI + 90;

      svg += `<text x="${x}" y="${y}" fill="${color}" font-family="${fontFamily}" font-weight="${fontWeight}" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle" transform="rotate(${rotation} ${x} ${y})">${char}</text>`;
    });

    return svg;
  }

  /**
   * Génère du texte centré
   */
  private generateCenterText(
    x: number,
    y: number,
    text: string,
    color: string,
    fontFamily: string,
    fontWeight: string,
    fontSize: number,
  ): string {
    return `<text x="${x}" y="${y}" fill="${color}" font-family="${fontFamily}" font-weight="${fontWeight}" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle">${text}</text>`;
  }

  /**
   * Génère des symboles intérieurs (étoiles, traits, etc.)
   */
  private generateInnerSymbols(
    centerX: number,
    centerY: number,
    radius: number,
    symbols: any[],
    color: string,
  ): string {
    let svg = '';

    symbols.forEach((symbol, index) => {
      const angle = (index * 360) / symbols.length * (Math.PI / 180);
      const distance = radius * 0.6;
      const x = centerX + distance * Math.cos(angle);
      const y = centerY + distance * Math.sin(angle);

      if (symbol.type === 'star') {
        svg += this.generateStar(x, y, symbol.size || 5, color);
      } else if (symbol.type === 'line') {
        svg += `<line x1="${x - 5}" y1="${y}" x2="${x + 5}" y2="${y}" stroke="${color}" stroke-width="1"/>`;
      } else if (symbol.type === 'dot') {
        svg += `<circle cx="${x}" cy="${y}" r="${symbol.size || 2}" fill="${color}"/>`;
      }
    });

    return svg;
  }

  /**
   * Génère une étoile SVG
   */
  private generateStar(x: number, y: number, size: number, color: string): string {
    const points: string[] = [];
    const outerRadius = size;
    const innerRadius = size / 2;
    const spikes = 5;

    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      const px = x + radius * Math.cos(angle);
      const py = y + radius * Math.sin(angle);
      points.push(`${px},${py}`);
    }

    return `<polygon points="${points.join(' ')}" fill="${color}"/>`;
  }

  /**
   * Convertit SVG en PNG via Puppeteer
   */
  async convertSVGToPNG(svgContent: string, outputPath: string): Promise<string> {
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(svgContent, { waitUntil: 'networkidle0' });

      // Capturer la page en PNG
      await page.screenshot({
        path: outputPath,
        type: 'png',
        fullPage: false,
      });

      return outputPath;
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  /**
   * Convertit SVG en PDF via Puppeteer
   */
  async convertSVGToPDF(svgContent: string, outputPath: string): Promise<string> {
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(svgContent, { waitUntil: 'networkidle0' });

      // Générer le PDF
      await page.pdf({
        path: outputPath,
        format: 'A4',
        printBackground: true,
      });

      return outputPath;
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  /**
   * Génère le fichier du cachet selon le format demandé
   */
  async generateSealFile(
    seal: any,
    versionData: any,
    outputDir: string,
    fileName: string,
  ): Promise<string> {
    // Générer le SVG
    const svgContent = await this.generateSVG(seal, versionData);

    const format = versionData.format.toLowerCase();
    const filePath = path.join(outputDir, `${fileName}.${format}`);

    if (format === 'svg') {
      // Sauvegarder directement le SVG
      await fs.writeFile(filePath, svgContent, 'utf-8');
      return filePath;
    } else if (format === 'png') {
      // Convertir SVG → PNG
      await this.convertSVGToPNG(svgContent, filePath);
      return filePath;
    } else if (format === 'pdf') {
      // Convertir SVG → PDF
      await this.convertSVGToPDF(svgContent, filePath);
      return filePath;
    } else {
      throw new Error(`Format non supporté: ${format}`);
    }
  }

  /**
   * Génère une URL publique pour le cachet
   */
  getSealPublicUrl(sealId: string, versionNumber: number, format: string): string {
    return `/uploads/seals/${sealId}/seal-v${versionNumber}.${format.toLowerCase()}`;
  }
}
