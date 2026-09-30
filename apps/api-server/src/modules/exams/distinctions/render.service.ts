/**
 * ============================================================================
 * DISTINCTIONS RENDER SERVICE — Adapté pour Academia Helm (PuppeteerPool)
 * ============================================================================
 *
 * Rendu HTML → PDF via le PuppeteerPoolService existant (au lieu de lancer
 * son propre navigateur comme dans le code source d'origine).
 *
 * Les templates React (Maternel, Primaire, Secondaire, Board) sont rendus
 * en HTML via renderToStaticMarkup, puis le HTML est passé à Puppeteer qui
 * génère le PDF.
 * ============================================================================
 */

import { renderToStaticMarkup } from 'react-dom/server';
import { PDFDocument } from 'pdf-lib';
import * as QRCode from 'qrcode';
import { Injectable, Logger } from '@nestjs/common';
import { PuppeteerPoolService } from '../../../common/services/puppeteer-pool.service';
import { ALL_CSS } from './css';
import { slug } from './format';
import { THEMES } from './themes';
import { Board } from './Board';
import { Maternel } from './Maternel';
import { Primaire } from './Primaire';
import { Secondaire } from './Secondaire';
import { toDataUri, qrSvg, prepare } from './assets';
import type { BoardInput, DistinctionInput, Level, PreparedDistinction } from './types';

function Certificate({ d }: { d: PreparedDistinction }) {
  const theme = THEMES[d.code];
  switch (theme.level) {
    case 'maternel': return Maternel({ d, theme });
    case 'primaire': return Primaire({ d, theme });
    case 'secondaire': return Secondaire({ d, theme });
  }
}

function wrap(levels: Level[], body: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Academia Helm</title><style>${ALL_CSS}</style></head><body>${body}</body></html>`;
}

@Injectable()
export class DistinctionsRenderService {
  private readonly logger = new Logger(DistinctionsRenderService.name);

  constructor(private readonly puppeteerPool: PuppeteerPoolService) {}

  async renderDistinctionsHtml(inputs: DistinctionInput[]): Promise<string> {
    const prepared = await Promise.all(inputs.map(prepare));
    const body = prepared.map((d) => renderToStaticMarkup(Certificate({ d }))).join('');
    return wrap(inputs.map((i) => THEMES[i.code].level), body);
  }

  async renderBoardHtml(board: BoardInput): Promise<string> {
    const logoUrl = await toDataUri(board.school.logoUrl);
    const b: BoardInput = { ...board, school: { ...board.school, logoUrl } };
    return wrap([board.level], renderToStaticMarkup(Board({ b })));
  }

  async htmlToPdf(html: string): Promise<Buffer> {
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 200));
      const pdfBuffer = await page.pdf({
        preferCSSPageSize: true,
        printBackground: true,
        timeout: 60000,
      });
      return Buffer.from(pdfBuffer);
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  async generateDistinctionPdf(input: DistinctionInput): Promise<Buffer> {
    return this.htmlToPdf(await this.renderDistinctionsHtml([input]));
  }

  async generateBoardPdf(board: BoardInput): Promise<Buffer> {
    return this.htmlToPdf(await this.renderBoardHtml(board));
  }

  export interface BatchFile { fileName: string; pdf: Buffer; input: DistinctionInput }

  async generateBatch(inputs: DistinctionInput[]): Promise<{ merged: Buffer; files: BatchFile[] }> {
    if (inputs.length === 0) throw new Error('Aucun certificat à générer');
    const merged = await this.htmlToPdf(await this.renderDistinctionsHtml(inputs));
    const src = await PDFDocument.load(merged);
    const files: BatchFile[] = [];
    for (let i = 0; i < inputs.length; i++) {
      const doc = await PDFDocument.create();
      const [pg] = await doc.copyPages(src, [i]);
      doc.addPage(pg);
      const input = inputs[i];
      files.push({ fileName: `${input.code}_${slug(input.student.fullName)}.pdf`, pdf: Buffer.from(await doc.save()), input });
    }
    return { merged, files };
  }
}
