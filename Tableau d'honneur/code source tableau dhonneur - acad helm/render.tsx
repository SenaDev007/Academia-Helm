import { renderToStaticMarkup } from 'react-dom/server';
import { PDFDocument } from 'pdf-lib';
import chromium from '@sparticuz/chromium';
import puppeteer, { type Browser } from 'puppeteer-core';
import { prepare } from './assets.js';
import { ALL_CSS } from './css.js';
import { fontCss } from './fonts.js';
import { slug } from './format.js';
import { THEMES } from './themes.js';
import { Board } from './templates/Board.js';
import { Maternel } from './templates/Maternel.js';
import { Primaire } from './templates/Primaire.js';
import { Secondaire } from './templates/Secondaire.js';
import { toDataUri } from './assets.js';
import type { BoardInput, DistinctionInput, Level, PreparedDistinction } from './types.js';

// ---------- HTML ----------

function Certificate({ d }: { d: PreparedDistinction }) {
  const theme = THEMES[d.code];
  switch (theme.level) {
    case 'maternel': return <Maternel d={d} theme={theme} />;
    case 'primaire': return <Primaire d={d} theme={theme} />;
    case 'secondaire': return <Secondaire d={d} theme={theme} />;
  }
}

function wrap(levels: Level[], body: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Academia Helm</title><style>${fontCss(levels)}\n${ALL_CSS}</style></head><body>${body}</body></html>`;
}

/** HTML complet de plusieurs certificats (un certificat par page). Utile aussi pour un aperçu navigateur. */
export async function renderDistinctionsHtml(inputs: DistinctionInput[]): Promise<string> {
  const prepared = await Promise.all(inputs.map(prepare));
  const body = prepared.map((d) => renderToStaticMarkup(<Certificate d={d} />)).join('');
  return wrap(inputs.map((i) => THEMES[i.code].level), body);
}

export async function renderBoardHtml(board: BoardInput): Promise<string> {
  const logoUrl = await toDataUri(board.school.logoUrl);
  const b: BoardInput = { ...board, school: { ...board.school, logoUrl } };
  return wrap([board.level], renderToStaticMarkup(<Board b={b} />));
}

// ---------- PDF ----------

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      const local = process.env.CHROMIUM_PATH;
      const browser = await puppeteer.launch(
        local
          ? { executablePath: local, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'] }
          : { executablePath: await chromium.executablePath(), headless: 'shell', args: [...chromium.args, '--font-render-hinting=none'] },
      );
      browser.on('disconnected', () => { browserPromise = null; });
      return browser;
    })();
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const b = await browserPromise;
    browserPromise = null;
    await b.close();
  }
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
    await page.evaluate(() => document.fonts.ready.then(() => true));
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

export async function generateDistinctionPdf(input: DistinctionInput): Promise<Buffer> {
  return htmlToPdf(await renderDistinctionsHtml([input]));
}

export async function generateBoardPdf(board: BoardInput): Promise<Buffer> {
  return htmlToPdf(await renderBoardHtml(board));
}

export interface BatchFile { fileName: string; pdf: Buffer; input: DistinctionInput }

/**
 * Génère toute une classe en un seul rendu, puis découpe le PDF fusionné en fichiers individuels.
 * Un seul chargement de page et de polices : 60 certificats en quelques secondes.
 */
export async function generateBatch(inputs: DistinctionInput[]): Promise<{ merged: Buffer; files: BatchFile[] }> {
  if (inputs.length === 0) throw new Error('Aucun certificat à générer');
  const merged = await htmlToPdf(await renderDistinctionsHtml(inputs));
  const src = await PDFDocument.load(merged);
  if (src.getPageCount() !== inputs.length) {
    throw new Error(`Incohérence de pagination : ${src.getPageCount()} pages pour ${inputs.length} certificats`);
  }
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
