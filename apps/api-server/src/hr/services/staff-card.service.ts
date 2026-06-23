import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { PuppeteerPoolService } from '../../common/services/puppeteer-pool.service';
import { StorageService } from '../../common/services/storage.service';
import { EmailService } from '../../communication/services/email.service';
import { Inject, forwardRef } from '@nestjs/common';
import { randomBytes } from 'crypto';

@Injectable()
export class StaffCardService {
  private readonly logger = new Logger(StaffCardService.name);
  private qrcode: any = null;

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private puppeteerPool: PuppeteerPoolService,
    private storageService: StorageService,
    @Inject(forwardRef(() => EmailService)) private emailService: EmailService,
  ) {
    this.loadQrcode();
  }

  private async loadQrcode() {
    try { this.qrcode = await import('qrcode'); } catch {}
  }

  async getOrCreateCard(staffId: string, tenantId: string, cardType = 'PROFESSIONAL') {
    await this.ensureTableExists();

    // Vérifier si une carte active existe déjà
    const existing = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM hr_staff_cards WHERE staff_id=$1 AND tenant_id=$2 AND card_type=$3 AND status='ACTIVE'`,
      staffId, tenantId, cardType,
    );
    if (existing[0]) return this.parse(existing[0]);

    // Récupérer les infos du staff via Prisma client
    // ⚠️ Staff n'a pas de champ photoUrl — la photo est dans StaffPhoto (relation Staff.photo)
    const staff = await this.prisma.staff.findFirst({
      where: { id: staffId, tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        position: true,
        email: true,
        phone: true,
        employeeNumber: true,
        tenantMatricule: true,
        globalMatricule: true,
        tenant: { select: { name: true } },
        photo: { select: { originalUrl: true } },
      },
    });
    if (!staff) throw new NotFoundException('Personnel introuvable');

    const token = randomBytes(16).toString('hex');
    const baseUrl = this.config.get('PUBLIC_WEB_URL') || 'https://www.academiahelm.com';
    const qrData = `${baseUrl.replace(/\/+$/, '')}/staff-card/${token}`;
    let qrCodeDataUrl = '';
    if (this.qrcode) {
      try {
        qrCodeDataUrl = await this.qrcode.toDataURL(qrData, {
          width: 240,
          margin: 1,
          color: { dark: '#0b2f73', light: '#ffffff' },
          errorCorrectionLevel: 'H',
        });
      } catch (e: any) {
        this.logger.warn(`QR code generation failed: ${e.message}`);
      }
    }

    const ss = await this.prisma.schoolSettings.findFirst({
      where: { tenantId },
      select: { schoolName: true, logoUrl: true, address: true, phone: true, city: true },
    }).catch(() => null);

    const schoolName = ss?.schoolName || staff.tenant?.name || 'École';

    // Résoudre les URLs (data URLs ou S3/R2)
    let logoUrl = ss?.logoUrl || '';
    let photoUrl = staff.photo?.originalUrl || '';
    try { if (logoUrl) logoUrl = await this.storageService.resolveFileUrl(logoUrl); } catch {}
    try { if (photoUrl) photoUrl = await this.storageService.resolveFileUrl(photoUrl); } catch {}

    const html = this.buildHtml({
      staffName: `${staff.firstName} ${staff.lastName}`,
      staffPosition: staff.position || 'Personnel',
      staffMatricule: staff.tenantMatricule || staff.globalMatricule || staff.employeeNumber || 'N/A',
      staffEmail: staff.email || '',
      staffPhone: staff.phone || '',
      schoolName,
      schoolAddress: ss?.address || '',
      schoolCity: ss?.city || '',
      schoolPhone: ss?.phone || '',
      logoUrl,
      photoUrl,
      qrCodeDataUrl,
    });

    let pdfUrl = '';
    try {
      const buf = await this.renderPdf(html);
      const key = `staff-cards/${tenantId}/${staffId}.pdf`;
      pdfUrl = await this.storageService.uploadBuffer(buf, key, 'application/pdf');
    } catch (e: any) {
      this.logger.error(`PDF generation failed: ${e.message}`);
    }

    // hr_staff_cards est une table créée en raw SQL (snake_case)
    await this.prisma.$executeRawUnsafe(
      `INSERT INTO hr_staff_cards (tenant_id, staff_id, card_type, token, status, pdf_url, qr_data) VALUES ($1,$2,$3,$4,'ACTIVE',$5,$6)`,
      tenantId, staffId, cardType, token, pdfUrl, qrData,
    );
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT * FROM hr_staff_cards WHERE token=$1`, token);
    return this.parse(rows[0]);
  }

  async getCardByToken(token: string) {
    await this.ensureTableExists();

    const cardRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM hr_staff_cards WHERE token=$1 AND status='ACTIVE'`,
      token,
    );
    if (!cardRows[0]) throw new NotFoundException('Carte invalide');
    const card = cardRows[0];

    const staff = await this.prisma.staff.findFirst({
      where: { id: card.staff_id },
      select: {
        firstName: true,
        lastName: true,
        position: true,
        email: true,
        phone: true,
        tenantMatricule: true,
        globalMatricule: true,
        employeeNumber: true,
        tenant: { select: { name: true, subdomain: true, slug: true } },
        photo: { select: { originalUrl: true } },
      },
    });

    if (!staff) throw new NotFoundException('Personnel introuvable');

    const ss = await this.prisma.schoolSettings.findFirst({
      where: { tenantId: card.tenant_id },
      select: { schoolName: true, logoUrl: true, address: true, phone: true, city: true },
    }).catch(() => null);

    let photoUrl = staff.photo?.originalUrl || '';
    let logoUrl = ss?.logoUrl || '';
    try { if (photoUrl) photoUrl = await this.storageService.resolveFileUrl(photoUrl); } catch {}
    try { if (logoUrl) logoUrl = await this.storageService.resolveFileUrl(logoUrl); } catch {}

    return {
      token: card.token,
      cardType: card.card_type,
      staffName: `${staff.firstName} ${staff.lastName}`,
      staffPosition: staff.position || 'Personnel',
      staffMatricule: staff.tenantMatricule || staff.globalMatricule || staff.employeeNumber || 'N/A',
      staffEmail: staff.email || '',
      staffPhone: staff.phone || '',
      staffPhotoUrl: photoUrl,
      schoolName: ss?.schoolName || staff.tenant?.name || '',
      schoolLogoUrl: logoUrl,
      tenantSubdomain: staff.tenant?.subdomain || staff.tenant?.slug || '',
    };
  }

  async listCards(staffId: string, tenantId: string) {
    await this.ensureTableExists();
    const r = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM hr_staff_cards WHERE staff_id=$1 AND tenant_id=$2 ORDER BY created_at DESC`,
      staffId, tenantId,
    );
    // Résoudre les URLs PDF pour chaque carte
    const resolved = await Promise.all(r.map(async (x) => {
      const parsed = this.parse(x);
      if (parsed.pdfUrl) {
        try { parsed.pdfUrl = await this.storageService.resolveFileUrl(parsed.pdfUrl); } catch {}
      }
      return parsed;
    }));
    return resolved;
  }

  /**
   * Télécharge le PDF d'une carte (retourne un Buffer).
   */
  async downloadCardPdf(cardId: string, tenantId: string): Promise<Buffer> {
    await this.ensureTableExists();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM hr_staff_cards WHERE id=$1 AND tenant_id=$2 AND status='ACTIVE'`,
      cardId, tenantId,
    );
    if (!rows[0]) throw new NotFoundException('Carte introuvable');
    const pdfUrl = rows[0].pdf_url;
    if (!pdfUrl) throw new NotFoundException('PDF non généré pour cette carte');

    // Si data URL, décoder
    if (pdfUrl.startsWith('data:')) {
      const m = /^data:[^;]+;base64,(.+)$/i.exec(pdfUrl);
      if (m) return Buffer.from(m[1], 'base64');
    }

    // Si URL HTTP, télécharger
    const resolvedUrl = await this.storageService.resolveFileUrl(pdfUrl);
    const response = await fetch(resolvedUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Récupère TOUTES les cartes actives du tenant avec infos staff (pour trombinoscope).
   */
  async listAllCards(tenantId: string) {
    await this.ensureTableExists();
    const cardRows = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT c.* FROM hr_staff_cards c WHERE c.tenant_id=$1 AND c.status='ACTIVE' ORDER BY c.created_at DESC`,
      tenantId,
    );

    const staffIds = cardRows.map(c => c.staff_id);
    if (staffIds.length === 0) return [];

    const staffRecords = await this.prisma.staff.findMany({
      where: { id: { in: staffIds } },
      select: { id: true, firstName: true, lastName: true, position: true, email: true, phone: true, tenantMatricule: true, globalMatricule: true, employeeNumber: true, photo: { select: { originalUrl: true } } },
    });
    const staffMap = new Map(staffRecords.map(s => [s.id, s]));

    const ss = await this.prisma.schoolSettings.findFirst({
      where: { tenantId },
      select: { schoolName: true, logoUrl: true },
    }).catch(() => null);
    let logoUrl = ss?.logoUrl || '';
    try { if (logoUrl) logoUrl = await this.storageService.resolveFileUrl(logoUrl); } catch {}

    return cardRows.map(c => {
      const staff = staffMap.get(c.staff_id);
      const parsed = this.parse(c);
      let photoUrl = staff?.photo?.originalUrl || '';
      try { if (photoUrl) photoUrl = this.storageService.resolveFileUrl(photoUrl) as any; } catch {}
      return {
        ...parsed,
        staffName: staff ? `${staff.firstName} ${staff.lastName}` : 'N/A',
        staffPosition: staff?.position || 'Personnel',
        staffMatricule: staff?.tenantMatricule || staff?.globalMatricule || staff?.employeeNumber || 'N/A',
        staffEmail: staff?.email || '',
        staffPhone: staff?.phone || '',
        staffPhotoUrl: photoUrl,
        schoolName: ss?.schoolName || '',
        schoolLogoUrl: logoUrl,
        cardLink: `${this.config.get('PUBLIC_WEB_URL') || 'https://www.academiahelm.com'}/staff-card/${c.token}`,
      };
    });
  }

  async revokeCard(id: string, tenantId: string) {
    await this.ensureTableExists();
    await this.prisma.$executeRawUnsafe(
      `UPDATE hr_staff_cards SET status='REVOKED', updated_at=NOW() WHERE id=$1 AND tenant_id=$2`,
      id, tenantId,
    );
  }

  private async renderPdf(html: string) {
    const { page } = await this.puppeteerPool.acquirePage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '8mm', bottom: '8mm', left: '8mm', right: '8mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await this.puppeteerPool.releasePage(page);
    }
  }

  /**
   * Template HTML professionnel et moderne pour la carte personnel (recto-verso).
   * Design : carte de visite premium avec palette Helm (Navy/Blue/Gold),
   * photo circulaire, QR code, hologramme de sécurité, filigrane.
   */
  private buildHtml(d: any) {
    const N = '#0b2f73';   // Navy Helm
    const B = '#1d4fa5';   // Blue Helm
    const G = '#f5b335';   // Gold Helm
    const initials = d.staffName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase();

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;background:#f0f2f5;padding:20px}
.card{width:340px;height:214px;margin:0 auto 24px;border-radius:14px;overflow:hidden;box-shadow:0 12px 40px rgba(11,47,115,.18);position:relative}
/* ── RECTO ── */
.front{background:linear-gradient(135deg,${N} 0%,${B} 100%);color:#fff;height:214px;position:relative;overflow:hidden}
.front::before{content:'';position:absolute;top:-60%;right:-30%;width:200%;height:200%;background:radial-gradient(circle,rgba(245,179,53,.12) 0%,transparent 50%);pointer-events:none}
.front::after{content:'';position:absolute;bottom:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,${G},transparent)}
.front-header{padding:12px 16px 8px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid rgba(255,255,255,.12)}
.front-header .logo{display:flex;align-items:center;gap:8px}
.front-header .logo img{height:28px;max-width:100px;object-fit:contain}
.front-header .logo .fallback{width:28px;height:28px;border-radius:6px;background:rgba(255,255,255,.15);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;color:${G}}
.front-header .badge-type{font-size:8px;font-weight:bold;color:${G};text-transform:uppercase;letter-spacing:1px;background:rgba(245,179,53,.15);padding:3px 8px;border-radius:4px}
.front-body{padding:14px 16px;display:flex;align-items:center;gap:14px}
.photo-wrap{width:64px;height:64px;border-radius:50%;border:3px solid ${G};overflow:hidden;background:rgba(255,255,255,.1);flex-shrink:0;position:relative}
.photo-wrap img{width:100%;height:100%;object-fit:cover}
.photo-wrap .initials{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:bold;color:rgba(255,255,255,.7)}
.staff-info{flex:1;min-width:0}
.staff-info h1{font-size:15px;font-weight:700;margin-bottom:2px;letter-spacing:.3px}
.staff-info .position{font-size:11px;color:${G};margin-bottom:8px;font-weight:500}
.staff-info .matricule{font-size:9px;color:rgba(255,255,255,.6);font-family:'Courier New',monospace;letter-spacing:.5px}
.front-footer{position:absolute;bottom:0;left:0;right:0;padding:8px 16px;background:rgba(0,0,0,.25);display:flex;align-items:center;justify-content:space-between}
.front-footer .qr{width:36px;height:36px;background:#fff;padding:2px;border-radius:4px}
.front-footer .qr img{width:100%;height:100%}
.front-footer .school-name{font-size:9px;color:rgba(255,255,255,.7);font-weight:600;text-align:right}
.front-footer .school-name strong{display:block;color:#fff;font-size:10px}

/* ── VERSO ── */
.back{background:#fff;height:214px;position:relative;overflow:hidden;border:1px solid #e2e8f0}
.back::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,${N},${G},${B})}
.back-header{padding:10px 16px 6px;border-bottom:1px solid #f1f5f9}
.back-header h2{font-size:10px;color:${N};text-transform:uppercase;letter-spacing:1.5px;font-weight:700}
.back-header .school{font-size:11px;color:#334155;font-weight:600;margin-top:2px}
.back-body{padding:10px 16px}
.info-row{display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px dotted #e2e8f0}
.info-row:last-child{border-bottom:none}
.info-row .label{font-size:8px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;font-weight:600}
.info-row .value{font-size:10px;color:#0f172a;font-weight:600;text-align:right}
.back-footer{position:absolute;bottom:0;left:0;right:0;padding:8px 16px;background:linear-gradient(90deg,${N},${B});display:flex;align-items:center;justify-content:space-between}
.back-footer .brand{font-size:9px;color:rgba(255,255,255,.8)}
.back-footer .brand strong{color:${G};font-size:10px}
.back-footer .qr-large{width:32px;height:32px;background:#fff;padding:2px;border-radius:3px}
.back-footer .qr-large img{width:100%;height:100%}

/* ── Hologramme de sécurité ── */
.hologram{position:absolute;top:8px;right:8px;width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,${G},#fff,${G});opacity:.6;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:bold;color:${N};transform:rotate(-15deg)}
</style></head><body>

<!-- RECTO -->
<div class="card front">
  <div class="hologram">AH</div>
  <div class="front-header">
    <div class="logo">
      ${d.logoUrl
        ? `<img src="${d.logoUrl}" />`
        : `<div class="fallback">${(d.schoolName || 'EC').substring(0, 2).toUpperCase()}</div>`}
      <div style="font-size:9px;color:rgba(255,255,255,.8);font-weight:600;">${d.schoolName}</div>
    </div>
    <div class="badge-type">Carte Professionnelle</div>
  </div>
  <div class="front-body">
    <div class="photo-wrap">
      ${d.photoUrl
        ? `<img src="${d.photoUrl}" />`
        : `<div class="initials">${initials}</div>`}
    </div>
    <div class="staff-info">
      <h1>${d.staffName}</h1>
      <div class="position">${d.staffPosition}</div>
      <div class="matricule">N° ${d.staffMatricule}</div>
    </div>
  </div>
  <div class="front-footer">
    <div class="qr">${d.qrCodeDataUrl ? `<img src="${d.qrCodeDataUrl}" />` : ''}</div>
    <div class="school-name">
      <strong>${d.schoolName}</strong>
      ${d.schoolCity ? `<span>${d.schoolCity}</span>` : ''}
    </div>
  </div>
</div>

<!-- VERSO -->
<div class="card back">
  <div class="back-header">
    <h2>Informations</h2>
    <div class="school">${d.schoolName}</div>
  </div>
  <div class="back-body">
    <div class="info-row"><span class="label">Établissement</span><span class="value">${d.schoolName}</span></div>
    <div class="info-row"><span class="label">Adresse</span><span class="value">${d.schoolAddress || 'N/A'}${d.schoolCity ? ', ' + d.schoolCity : ''}</span></div>
    <div class="info-row"><span class="label">Téléphone</span><span class="value">${d.schoolPhone || 'N/A'}</span></div>
    <div class="info-row"><span class="label">Personnel</span><span class="value">${d.staffName}</span></div>
    <div class="info-row"><span class="label">Matricule</span><span class="value">${d.staffMatricule}</span></div>
    <div class="info-row"><span class="label">Contact</span><span class="value">${d.staffPhone || 'N/A'}</span></div>
  </div>
  <div class="back-footer">
    <div class="brand"><strong>Academia Helm</strong><br/>Plateforme de pilotage éducatif</div>
    <div class="qr-large">${d.qrCodeDataUrl ? `<img src="${d.qrCodeDataUrl}" />` : ''}</div>
  </div>
</div>

</body></html>`;
  }

  private parse(r: any) {
    return {
      id: r.id,
      tenantId: r.tenant_id,
      staffId: r.staff_id,
      cardType: r.card_type,
      token: r.token,
      status: r.status,
      pdfUrl: r.pdf_url,
      qrData: r.qr_data,
      createdAt: r.created_at,
    };
  }

  /**
   * Génère les cartes professionnelles pour TOUS les personnels actifs.
   * Révoque les anciennes cartes actives et en génère de nouvelles.
   */
  async generateAllCards(tenantId: string, cardType = 'PROFESSIONAL') {
    await this.ensureTableExists();

    // Récupérer tous les personnels actifs avec email
    const staffList = await this.prisma.staff.findMany({
      where: { tenantId, status: { not: 'ARCHIVED' } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    let generated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const staff of staffList) {
      try {
        // Révoquer l'ancienne carte active si elle existe
        await this.prisma.$executeRawUnsafe(
          `UPDATE hr_staff_cards SET status='REVOKED', updated_at=NOW() WHERE staff_id=$1 AND tenant_id=$2 AND status='ACTIVE'`,
          staff.id, tenantId,
        ).catch(() => {});

        // Générer la nouvelle carte
        await this.getOrCreateCard(staff.id, tenantId, cardType);
        generated++;
      } catch (e: any) {
        failed++;
        errors.push(`${staff.firstName} ${staff.lastName}: ${e.message}`);
        this.logger.error(`Card generation failed for ${staff.id}: ${e.message}`);
      }
    }

    return { generated, failed, errors, total: staffList.length };
  }

  /**
   * Distribue les cartes par email aux personnels.
   * Envoie la carte PDF en pièce jointe + lien public QR.
   */
  async distributeCardsByEmail(tenantId: string, staffIds?: string[]) {
    await this.ensureTableExists();

    // Récupérer les cartes actives via raw SQL (table hr_staff_cards en snake_case)
    let cardRows: any[];
    if (staffIds && staffIds.length > 0) {
      cardRows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM hr_staff_cards WHERE tenant_id=$1 AND status='ACTIVE' AND staff_id = ANY($2)`,
        tenantId, staffIds,
      );
    } else {
      cardRows = await this.prisma.$queryRawUnsafe<any[]>(
        `SELECT * FROM hr_staff_cards WHERE tenant_id=$1 AND status='ACTIVE'`,
        tenantId,
      );
    }

    // Récupérer les infos staff via Prisma client (gère le mapping camelCase)
    const staffIdsList = cardRows.map(c => c.staff_id);
    const staffMap = new Map<string, any>();
    if (staffIdsList.length > 0) {
      const staffRecords = await this.prisma.staff.findMany({
        where: { id: { in: staffIdsList } },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      staffRecords.forEach(s => staffMap.set(s.id, s));
    }

    // Combiner les données
    const cards = cardRows.map(c => ({
      ...c,
      first_name: staffMap.get(c.staff_id)?.firstName || '',
      last_name: staffMap.get(c.staff_id)?.lastName || '',
      email: staffMap.get(c.staff_id)?.email || '',
    }));

    // Récupérer le branding pour l'email
    const branding = await this.getTenantBrandingForCard(tenantId);
    const baseUrl = this.config.get('PUBLIC_WEB_URL') || 'https://www.academiahelm.com';

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const card of cards) {
      try {
        if (!card.email) {
          failed++;
          errors.push(`${card.first_name} ${card.last_name}: aucun email`);
          continue;
        }

        // Résoudre l'URL du PDF
        let pdfUrl = card.pdf_url;
        if (pdfUrl && !pdfUrl.startsWith('data:')) {
          try { pdfUrl = await this.storageService.resolveFileUrl(pdfUrl); } catch {}
        }

        // Télécharger le PDF pour l'attachement
        let pdfBuffer: Buffer | null = null;
        if (pdfUrl) {
          try {
            if (pdfUrl.startsWith('data:')) {
              const m = /^data:[^;]+;base64,(.+)$/i.exec(pdfUrl);
              if (m) pdfBuffer = Buffer.from(m[1], 'base64');
            } else {
              const resp = await fetch(pdfUrl);
              if (resp.ok) pdfBuffer = Buffer.from(await resp.arrayBuffer());
            }
          } catch (e: any) {
            this.logger.warn(`PDF download failed for card ${card.id}: ${e.message}`);
          }
        }

        const staffName = `${card.first_name} ${card.last_name}`;
        const cardLink = `${baseUrl.replace(/\/+$/, '')}/staff-card/${card.token}`;

        // Email HTML
        const html = this.buildDistributionEmail({
          staffName,
          staffFirstName: card.first_name,
          schoolName: branding.schoolName,
          schoolLogo: branding.schoolLogo,
          cardLink,
        });

        await this.emailService.sendCategorized({
          tenantId,
          category: 'ADMINISTRATIF' as any,
          subCategory: 'distribution_carte_personnel',
          module: 'hr',
          to: card.email,
          toName: staffName,
          recipientType: 'STAFF' as any,
          recipientId: card.staff_id,
          fromEmail: this.config.get('EMAIL_FROM_NOREPLY') || 'noreply@academiahelm.com',
          fromName: branding.schoolName,
          subject: `${branding.schoolName} — Votre carte professionnelle`,
          html,
          attachments: pdfBuffer ? [{
            filename: `Carte_${card.first_name}_${card.last_name}.pdf`,
            content: pdfBuffer.toString('base64'),
            contentType: 'application/pdf',
          }] : undefined,
          triggeredBy: 'SYSTEM',
          relatedEntityId: card.id,
          relatedEntityType: 'StaffCard',
        });

        sent++;
      } catch (e: any) {
        failed++;
        errors.push(`${card.first_name} ${card.last_name}: ${e.message}`);
        this.logger.error(`Card distribution failed for ${card.staff_id}: ${e.message}`);
      }
    }

    return { sent, failed, errors, total: cards.length };
  }

  /**
   * Email de distribution de carte (template standard Helm).
   */
  private buildDistributionEmail(d: { staffName: string; staffFirstName: string; schoolName: string; schoolLogo?: string | null; cardLink: string }): string {
    const N = '#0b2f73', B = '#1d4fa5', G = '#f5b335';
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,sans-serif;">
<table cellpadding="0" cellspacing="0" width="100%" style="background:#eef2f7;">
<tr><td align="center" style="padding:24px 12px;">
<table cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(11,47,115,.08);">
<tr><td style="background:linear-gradient(160deg,${N} 0%,${B} 100%);padding:28px 24px;border-bottom:3px solid ${G};text-align:center;">
${d.schoolLogo ? `<img src="${d.schoolLogo}" alt="${d.schoolName}" style="max-height:48px;max-width:160px;object-fit:contain;margin-bottom:8px;" />` : ''}
<div style="font-size:22px;font-weight:bold;color:#fff;">${d.schoolName}</div>
<div style="font-size:13px;color:${G};margin-top:4px;">Carte professionnelle</div>
</td></tr>
<tr><td style="padding:32px 28px;background:#f8fafc;">
<div style="display:inline-block;padding:8px 14px;border-radius:999px;background:#eff6ff;border:1px solid #93c5fd;color:#1e40af;font-size:13px;font-weight:bold;margin-bottom:20px;">🎫 Votre carte professionnelle</div>
<h2 style="margin:0 0 8px;color:#0f172a;font-size:20px;">Bonjour ${d.staffFirstName},</h2>
<p style="margin:0 0 20px;color:#475569;line-height:1.6;">Votre carte professionnelle a été générée par l'administration de <strong style="color:${N};">${d.schoolName}</strong>. Vous la trouverez en pièce jointe de cet email.</p>
<table cellpadding="0" cellspacing="0" width="100%" style="background:#fff;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:20px;">
<tr><td style="padding:16px 20px;">
<p style="margin:0 0 8px;font-size:13px;color:#334155;"><strong>QR Code d'accès :</strong> Scannez le QR code sur votre carte pour accéder à votre profil public sécurisé.</p>
<p style="margin:0;font-size:12px;color:#64748b;">Lien direct : <a href="${d.cardLink}" style="color:${N};">${d.cardLink}</a></p>
</td></tr>
</table>
<div style="text-align:center;margin:24px 0;">
<a href="${d.cardLink}" style="display:inline-block;background:${N};color:#fff;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:bold;text-decoration:none;">Voir ma carte en ligne</a>
</div>
<p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.6;">⚠️ Conservez votre carte en lieu sûr. Elle constitue une pièce d'identification professionnelle au sein de l'établissement. En cas de perte, contactez l'administration.</p>
</td></tr>
<tr><td style="background:${N};padding:24px 28px;text-align:center;border-top:3px solid ${G};">
<div style="font-size:15px;font-weight:bold;color:#fff;">Academia Helm</div>
<div style="font-size:11px;color:${G};margin-top:2px;">Plateforme de pilotage éducatif</div>
<div style="font-size:11px;color:#94a3b8;line-height:1.6;margin-top:12px;">Cet email a été envoyé automatiquement. Merci de ne pas répondre directement.</div>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
  }

  /**
   * Récupère le branding pour l'email de distribution.
   */
  private async getTenantBrandingForCard(tenantId: string): Promise<{ schoolName: string; schoolLogo: string | null }> {
    try {
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
        select: { schoolName: true, logoUrl: true },
      });
      if (profile?.schoolName) {
        const apiBaseUrl = this.config.get<string>('APP_PUBLIC_URL') || 'https://academia-helm-api.fly.dev';
        const logoUrl = profile.logoUrl ? `${apiBaseUrl}/api/tenants/${tenantId}/logo` : null;
        return { schoolName: profile.schoolName, schoolLogo: logoUrl };
      }
      const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } });
      return { schoolName: tenant?.name || 'Établissement', schoolLogo: null };
    } catch {
      return { schoolName: 'Établissement', schoolLogo: null };
    }
  }

  private async ensureTableExists() {
    try {
      await this.prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS "hr_staff_cards" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,"tenant_id" TEXT NOT NULL,"staff_id" TEXT NOT NULL,"card_type" TEXT NOT NULL DEFAULT 'PROFESSIONAL',"token" TEXT NOT NULL UNIQUE,"status" TEXT NOT NULL DEFAULT 'ACTIVE',"pdf_url" TEXT,"qr_data" TEXT,"expires_at" TIMESTAMP(3),"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "hr_staff_cards_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE);CREATE INDEX IF NOT EXISTS "idx_hr_staff_cards_tenant" ON "hr_staff_cards" ("tenant_id");CREATE INDEX IF NOT EXISTS "idx_hr_staff_cards_staff" ON "hr_staff_cards" ("staff_id");CREATE INDEX IF NOT EXISTS "idx_hr_staff_cards_token" ON "hr_staff_cards" ("token");`,
      );
    } catch (e: any) {
      this.logger.warn(`Table creation: ${e.message}`);
    }
  }
}
