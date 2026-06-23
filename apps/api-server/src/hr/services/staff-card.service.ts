import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { PuppeteerPoolService } from '../../common/services/puppeteer-pool.service';
import { StorageService } from '../../common/services/storage.service';
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
