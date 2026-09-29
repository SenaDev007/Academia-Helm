/**
 * ============================================================================
 * BILLING RECEIPT SERVICE — Reçus & factures automatiques (onboarding)
 * ============================================================================
 *
 * ⭐ Génération AUTOMATIQUE de documents financiers professionnels pour
 *    chaque transaction du flux d'abonnement Academia Helm :
 *
 *    - REÇU d'encaissement (REC-AH-AAAA-NNNNN) : émis dès qu'une somme est
 *      encaissée en espèces — paiement intégral (Article 4.3) ou acompte /
 *      tranche de l'échéancier (Article 4.4). Chaque reçu porte le détail
 *      exact des montants couverts (activation au barème progressif, frais
 *      annuels, option bilingue), le montant en toutes lettres, l'agent
 *      encaisseur, la date et l'heure de l'encaissement.
 *
 *    - FACTURE de souscription (FAC-AH-AAAA-NNNNN) : document de référence
 *      de la souscription Année 1 — détail par ligne, barème annexe, et,
 *      en paiement échelonné, l'échéancier complet avec les reçus déjà
 *      émis et le solde restant.
 *
 *    Les PDF (HTML → Puppeteer, même pool que les contrats) sont joints à
 *    l'email du promoteur avec le contrat signé. Les numéros sont reportés
 *    dans le contrat (sections 4.3 / 4.4) AVANT son rendu.
 *
 *    Numérotation séquentielle annuelle, unique en base (billing_documents).
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { PuppeteerPoolService } from '../common/services/puppeteer-pool.service';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import { amountToFrenchWords } from './contract-generation.service';

/** Ligne de détail d'un reçu / facture. */
export interface ReceiptLine {
  label: string;
  amount: number; // FCFA
}

/** Tranche de l'échéancier (facture en paiement échelonné). */
export interface ReceiptInstallment {
  label: string;
  amount: number;
  dueDate?: string;
  receiptNumber?: string;
  paidAt?: string;
}

export interface EmitBillingDocumentInput {
  kind: 'RECEIPT' | 'INVOICE';
  transactionType:
    | 'FULL_SUBSCRIPTION'
    | 'DOWN_PAYMENT'
    | 'INSTALLMENT'
    | 'ACTIVATION'
    | 'ANNUAL'
    | 'BILINGUAL';
  draftId?: string;
  tenantId?: string;
  payerName: string;
  payerEmail?: string;
  /** Émetteur : agent YEHI OR Tech ayant encaissé / émis. */
  issuedByName?: string;
  issuedByEmail?: string;
  paymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'MOBILE_MONEY' | 'ONLINE';
  paidAt?: Date;
  lines: ReceiptLine[];
  amount: number;
  contractRef?: string;
  schoolName?: string;
  schoolCity?: string;
  /** Référence du reçu remplacé/annulé éventuel, notes diverses. */
  note?: string;
  /** Échéancier complet (facture en paiement échelonné). */
  installments?: ReceiptInstallment[];
}

export interface EmittedBillingDocument {
  id: string;
  kind: 'RECEIPT' | 'INVOICE';
  documentNumber: string;
  amount: number;
  filePath: string;
  fileName: string;
  fileUrl: string;
  pdf: { buffer: Buffer; filename: string } | null;
}

@Injectable()
export class BillingReceiptService {
  private readonly logger = new Logger(BillingReceiptService.name);

  private logoCache: { yehiOrTech?: string; academiaHelm?: string } = {};

  constructor(
    private readonly prisma: PrismaService,
    private readonly puppeteerPool: PuppeteerPoolService,
  ) {}

  // ── Numérotation ────────────────────────────────────────────────────────

  /**
   * Numéro séquentiel annuel : REC-AH-2026-00001 (reçu) / FAC-AH-2026-00001
   * (facture). Sécurisé par l'unicité en base (retry en cas de collision).
   */
  private async nextNumber(kind: 'RECEIPT' | 'INVOICE'): Promise<{
    documentNumber: string;
    sequenceYear: number;
  }> {
    const sequenceYear = new Date().getFullYear();
    const prefix = kind === 'RECEIPT' ? 'REC' : 'FAC';
    for (let attempt = 0; attempt < 8; attempt++) {
      const count = await this.prisma.billingDocument.count({
        where: { kind, sequenceYear },
      });
      const seq = count + 1 + attempt;
      const documentNumber = `${prefix}-AH-${sequenceYear}-${String(seq).padStart(5, '0')}`;
      const exists = await this.prisma.billingDocument.findUnique({
        where: { documentNumber },
        select: { id: true },
      });
      if (!exists) return { documentNumber, sequenceYear };
    }
    // Filet de sécurité : suffixe horodaté (collision extrême)
    return {
      documentNumber: `${prefix}-AH-${sequenceYear}-${Date.now().toString().slice(-5)}`,
      sequenceYear,
    };
  }

  // ── Logos (base64, self-contained PDF) ───────────────────────────────────

  private async fetchImageAsBase64(url: string): Promise<string | null> {
    try {
      const data = url.startsWith('data:')
        ? url
        : await new Promise<string>((resolve, reject) => {
            const req = https.get(url, (res) => {
              if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
              }
              const chunks: Buffer[] = [];
              res.on('data', (c) => chunks.push(c));
              res.on('end', () =>
                resolve(
                  'data:' +
                    (res.headers['content-type'] || 'image/png') +
                    ';base64,' +
                    Buffer.concat(chunks).toString('base64'),
                ),
              );
            });
            req.setTimeout(8000, () => {
              req.destroy(new Error('timeout'));
            });
            req.on('error', reject);
          });
      return data;
    } catch {
      return null;
    }
  }

  private async getLogos(): Promise<{ yehiOrTech: string; academiaHelm: string }> {
    if (this.logoCache.yehiOrTech && this.logoCache.academiaHelm) return this.logoCache;
    const yehiOrTech =
      (await this.fetchImageAsBase64(
        process.env.BILLING_LOGO_YOT_URL || 'https://www.academiahelm.com/images/yehi-or-tech-logo.png',
      )) || '';
    const academiaHelm =
      (await this.fetchImageAsBase64(
        process.env.BILLING_LOGO_AH_URL || 'https://www.academiahelm.com/images/logo.png',
      )) || '';
    this.logoCache = { yehiOrTech, academiaHelm };
    return this.logoCache;
  }

  // ── Émission ─────────────────────────────────────────────────────────────

  /**
   * Émet (persiste + rend) un reçu ou une facture. Idempotent par clé
   * logique (`idempotencyKey` — ex : `full-{draftId}`, `installment-{idx}-{draftId}`)
   * : évite le double émission au rejeu du flux de signature OU d'un reçu de
   * tranche. La clé est stockée dans le snapshot (JSONB) et recherchée telle
   * quelle — pas de collision entre REÇU/FACTURE ni entre tranches.
   */
  async emit(
    input: EmitBillingDocumentInput,
    idempotencyKey?: string,
  ): Promise<EmittedBillingDocument | null> {
    try {
      // Idempotence : déjà émis pour cette clé ?
      if (idempotencyKey && input.draftId) {
        const existing = await this.prisma.billingDocument.findFirst({
          where: {
            draftId: input.draftId,
            status: 'EMITTED',
            snapshot: { path: ['idempotencyKey'], equals: idempotencyKey },
          },
        });
        if (existing) {
          const reRendered = await this.rehydrate(existing);
          if (reRendered) return reRendered;
          return {
            id: existing.id,
            kind: existing.kind as 'RECEIPT' | 'INVOICE',
            documentNumber: existing.documentNumber,
            amount: existing.amount,
            filePath: existing.filePath || '',
            fileName: existing.fileName || '',
            fileUrl: existing.fileName ? `/api/onboarding/contract/billing/${existing.fileName}` : '',
            pdf: null,
          };
        }
      }

      const { documentNumber, sequenceYear } = await this.nextNumber(input.kind);
      const logos = await this.getLogos();
      const html = this.renderHtml(input, documentNumber, logos);

      const dir = path.join(process.cwd(), 'uploads', 'billing');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const fileName = `${documentNumber}.html`;
      const filePath = path.join(dir, fileName);
      fs.writeFileSync(filePath, html, 'utf-8');

      const doc = await this.prisma.billingDocument.create({
        data: {
          kind: input.kind,
          documentNumber,
          sequenceYear,
          transactionType: input.transactionType,
          draftId: input.draftId || null,
          tenantId: input.tenantId || null,
          issuedByName: input.issuedByName || null,
          issuedByEmail: input.issuedByEmail || null,
          payerName: input.payerName || null,
          payerEmail: input.payerEmail || null,
          paymentMethod: input.paymentMethod || 'CASH',
          paidAt: input.paidAt || new Date(),
          amount: Math.max(0, Math.round(input.amount)),
          snapshot: {
            lines: input.lines,
            installments: input.installments || null,
            contractRef: input.contractRef || null,
            schoolName: input.schoolName || null,
            note: input.note || null,
            ...(idempotencyKey ? { idempotencyKey } : {}),
          } as any,
          filePath,
          fileName,
          status: 'EMITTED',
        },
      });

      const pdf = await this.renderPdf(filePath, fileName);
      this.logger.log(
        `✅ ${input.kind === 'RECEIPT' ? 'Reçu' : 'Facture'} ${documentNumber} émis (${input.transactionType}) — ${input.amount} FCFA`,
      );
      return {
        id: doc.id,
        kind: input.kind,
        documentNumber,
        amount: doc.amount,
        filePath,
        fileName,
        fileUrl: `/api/onboarding/contract/billing/${fileName}`,
        pdf,
      };
    } catch (err: any) {
      // ⚠️ Non-bloquant : l'échec d'un reçu ne doit JAMAIS bloquer la
      // signature du contrat — l'agent peut relancer l'émission.
      this.logger.error(`Failed to emit ${input.kind}: ${err.message}`, err.stack);
      return null;
    }
  }

  /** Re-rend le PDF d'un document déjà persisté (retour au flux existant). */
  private async rehydrate(doc: any): Promise<EmittedBillingDocument | null> {
    if (!doc.filePath || !fs.existsSync(doc.filePath)) return null;
    const pdf = await this.renderPdf(doc.filePath, doc.fileName || '');
    return {
      id: doc.id,
      kind: doc.kind,
      documentNumber: doc.documentNumber,
      amount: doc.amount,
      filePath: doc.filePath,
      fileName: doc.fileName || '',
      fileUrl: doc.fileName ? `/api/onboarding/contract/billing/${doc.fileName}` : '',
      pdf,
    };
  }

  /** HTML → PDF (Puppeteer, même pool que les contrats). */
  private async renderPdf(
    filePath: string,
    fileName: string,
  ): Promise<{ buffer: Buffer; filename: string } | null> {
    try {
      if (!fs.existsSync(filePath)) return null;
      const html = fs.readFileSync(filePath, 'utf-8');
      const { page } = await this.puppeteerPool.acquirePage();
      try {
        await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await new Promise((r) => setTimeout(r, 250));
        const pdf = await page.pdf({
          format: 'A5',
          printBackground: true,
          margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
        });
        return { buffer: Buffer.from(pdf), filename: (fileName || 'document').replace(/\.html$/, '.pdf') };
      } finally {
        await this.puppeteerPool.releasePage(page);
      }
    } catch {
      // Chromium indisponible → HTML brut en secours
      try {
        return { buffer: fs.readFileSync(filePath), filename: fileName || 'document' };
      } catch {
        return null;
      }
    }
  }

  // ── Rendu HTML ───────────────────────────────────────────────────────────

  private fmt(n: number): string {
    return Math.round(n).toLocaleString('fr-FR').replace(/\u202f|\u00a0/g, ' ');
  }

  private fmtDateTime(d: Date): string {
    return (
      d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
      ' à ' +
      d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    );
  }

  private fmtDate(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? String(iso)
      : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  private esc(v: string): string {
    return String(v ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private renderHtml(
    input: EmitBillingDocumentInput,
    documentNumber: string,
    logos: { yehiOrTech: string; academiaHelm: string },
  ): string {
    const isReceipt = input.kind === 'RECEIPT';
    const now = input.paidAt || new Date();
    const accent = isReceipt ? '#1a7a4a' : '#0a1d3f';

    const linesRows = input.lines
      .map(
        (l) =>
          `<tr><td>${this.esc(l.label)}</td><td class="r">${this.fmt(l.amount)}</td></tr>`,
      )
      .join('');

    const installmentsBlock =
      input.installments && input.installments.length > 0
        ? `
    <p class="section">Échéancier convenu (Article 4.4 du contrat)</p>
    <table>
      <thead><tr><th>#</th><th>Libellé</th><th class="r">Montant (FCFA)</th><th>Échéance</th><th>Reçu émis</th></tr></thead>
      <tbody>
        ${input.installments
          .map(
            (t, i) =>
              `<tr${t.receiptNumber ? ' class="paid"' : ''}><td class="c">${i + 1}</td><td>${this.esc(t.label)}</td><td class="r">${this.fmt(t.amount)}</td><td>${t.dueDate ? this.fmtDate(t.dueDate) : 'à la signature'}</td><td>${t.receiptNumber ? this.esc(t.receiptNumber) : '—'}</td></tr>`,
          )
          .join('')}
        <tr class="total"><td colspan="2">TOTAL À RÉGLER</td><td class="r">${this.fmt(input.installments.reduce((s, t) => s + (Number(t.amount) || 0), 0))}</td><td colspan="2"></td></tr>
      </tbody>
    </table>`
        : '';

    const scheduleTotal =
      input.installments?.reduce((s, t) => s + (Number(t.amount) || 0), 0) || 0;
    const paidSoFar = isReceipt
      ? input.amount
      : (input.installments || []).reduce((s, t) => s + (t.receiptNumber ? Number(t.amount) || 0 : 0), 0);
    const balanceBlock =
      input.installments && input.installments.length > 0
        ? `<p class="balance">Encaissé à ce jour : <strong>${this.fmt(paidSoFar)} FCFA</strong> — solde restant : <strong>${this.fmt(Math.max(0, scheduleTotal - paidSoFar))} FCFA</strong>.</p>`
        : '';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A5 portrait; margin: 0; }
  body { font-family: 'Georgia', 'Times New Roman', serif; font-size: 10px; line-height: 1.5; color: #1a1a2e; background: #fff; padding: 10mm 9mm; }
  .logos { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4mm; }
  .logos img { height: 11mm; width: auto; }
  .title { text-align: center; margin: 2mm 0 1.5mm; }
  .title h1 { font-size: 14px; letter-spacing: .8px; text-transform: uppercase; color: ${accent}; }
  .title p { font-size: 8.5px; color: #555; margin-top: .5mm; }
  .refband { display: flex; justify-content: space-between; font-size: 9px; background: ${accent}; color: #fff; border-radius: 2mm; padding: 2mm 3mm; margin: 2.5mm 0; }
  .refband strong { font-size: 10px; letter-spacing: .4px; }
  .parties { display: flex; gap: 3mm; margin: 2.5mm 0; }
  .parties > div { flex: 1; border: .5pt solid #b9c2d0; border-radius: 2mm; padding: 2mm 2.5mm; font-size: 9px; }
  .parties .lbl { font-size: 7px; text-transform: uppercase; letter-spacing: .8px; color: #6b7280; margin-bottom: 1mm; }
  .parties strong { color: #0a1d3f; }
  p.section { font-weight: 700; color: #0a1d3f; font-size: 9.5px; text-transform: uppercase; letter-spacing: .4px; border-bottom: .5pt solid #b9c2d0; margin: 3mm 0 1.5mm; padding-bottom: .8mm; }
  table { width: 100%; border-collapse: collapse; margin: 1.5mm 0 2mm; font-size: 9.5px; }
  th { background: #0a1d3f; color: #fff; font-weight: 600; border: .4pt solid #0a1d3f; padding: 1.4mm 2mm; text-align: left; }
  td { border: .4pt solid #8a94a6; padding: 1.3mm 2mm; vertical-align: top; }
  tr.total td { background: #f5f0e1; font-weight: 700; border-top: .8pt solid #0a1d3f; }
  tr.paid td { background: #f0fdf4; }
  .r { text-align: right; }
  .c { text-align: center; }
  .amount-box { background: ${accent}; color: #fff; border-radius: 2mm; padding: 2.5mm 3mm; display: flex; justify-content: space-between; align-items: center; margin: 2.5mm 0; }
  .amount-box .lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; }
  .amount-box .val { font-size: 14px; font-weight: 900; }
  .words { font-size: 8.5px; font-style: italic; color: #444; margin: 1mm 0 2mm; }
  .balance { font-size: 9px; margin: 1.5mm 0; }
  .sign { display: flex; gap: 4mm; margin-top: 3.5mm; }
  .sign > div { flex: 1; text-align: center; font-size: 8.5px; }
  .sign .who { font-weight: 700; text-transform: uppercase; letter-spacing: .4px; color: #0a1d3f; }
  .sign .box { border: .5pt dashed #9ca3af; border-radius: 1.5mm; height: 11mm; margin: 1mm 0 .8mm; }
  .note { font-size: 8px; color: #666; font-style: italic; margin-top: 2mm; border-top: .4pt solid #ccc; padding-top: 1.2mm; }
</style>
</head>
<body>
  <div class="logos">
    <img src="${logos.yehiOrTech}" alt="YEHI OR Tech" onerror="this.style.display='none'" />
    <img src="${logos.academiaHelm}" alt="Academia Helm" onerror="this.style.display='none'" />
  </div>

  <div class="title">
    <h1>${isReceipt ? 'Reçu d\u2019encaissement' : 'Facture de souscription'}</h1>
    <p>YEHI OR Tech — Academia Helm · Parakou, République du Bénin</p>
  </div>

  <div class="refband">
    <div><strong>${this.esc(documentNumber)}</strong><br />${isReceipt ? 'Encaissé le' : 'Émise le'} ${this.fmtDateTime(now)}</div>
    <div style="text-align:right">${input.contractRef ? `Contrat : <strong>${this.esc(input.contractRef)}</strong><br />` : ''}${input.paymentMethod === 'CASH' ? 'Règlement en espèces' : this.esc(String(input.paymentMethod || ''))}</div>
  </div>

  <div class="parties">
    <div>
      <div class="lbl">Émetteur</div>
      <strong>YEHI OR Tech</strong><br />
      ${input.issuedByName ? `Agent : <strong>${this.esc(input.issuedByName)}</strong><br />` : ''}
      ${input.issuedByEmail ? `${this.esc(input.issuedByEmail)}<br />` : ''}support@academiahelm.com
    </div>
    <div>
      <div class="lbl">Client (payeur)</div>
      <strong>${this.esc(input.payerName || '—')}</strong><br />
      ${input.schoolName && input.schoolName !== input.payerName ? this.esc(input.schoolName) + '<br />' : ''}
      ${input.payerEmail ? this.esc(input.payerEmail) : ''}
    </div>
  </div>

  <p class="section">${isReceipt ? 'Détail de l\u2019encaissement' : 'Détail de la souscription — Année 1'}</p>
  <table>
    <thead><tr><th>Rubrique</th><th class="r">Montant (FCFA)</th></tr></thead>
    <tbody>
      ${linesRows}
      <tr class="total"><td>${isReceipt ? 'MONTANT ENCAISSÉ' : 'TOTAL ANNÉE 1'}</td><td class="r">${this.fmt(input.amount)}</td></tr>
    </tbody>
  </table>

  <div class="amount-box">
    <span class="lbl">${isReceipt ? 'Montant encaissé' : 'Total'}</span>
    <span class="val">${this.fmt(input.amount)} FCFA</span>
  </div>
  <p class="words">Montant en toutes lettres : ${this.esc(amountToFrenchWords(input.amount))} francs CFA.</p>

  ${installmentsBlock}
  ${balanceBlock}

  <div class="sign">
    <div>
      <div class="who">Le Client (payeur)</div>
      <div class="box"></div>
      <div>${this.esc(input.payerName || '')}</div>
    </div>
    <div>
      <div class="who">L'émetteur — YEHI OR Tech</div>
      <div class="box"></div>
      <div>${this.esc(input.issuedByName || 'YEHI OR Tech')}</div>
    </div>
  </div>

  <p class="note">
    ${isReceipt
      ? 'Ce reçu atteste de l\u2019encaissement des sommes indiquées ci-dessus et tient lieu de quittance. Document généré automatiquement par la plateforme Academia Helm — numéro unique, opposable.'
      : 'Facture émise par YEHI OR Tech au titre de la souscription Academia Helm. TVA non applicable (activité non assujettie). Les règlements en espèces sont attestés par des reçus d\u2019encaissement numérotés.'}
    ${input.note ? ' ' + this.esc(input.note) : ''}
    contact : support@academiahelm.com · www.academiahelm.com
  </p>
</body>
</html>`;
  }
}
