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
  constructor(private prisma: PrismaService, private config: ConfigService, private puppeteerPool: PuppeteerPoolService, private storageService: StorageService) { this.loadQrcode(); }
  private async loadQrcode() { try { this.qrcode = await import('qrcode'); } catch {} }

  async getOrCreateCard(staffId: string, tenantId: string, cardType = 'PROFESSIONAL') {
    await this.ensureTableExists();
    const existing = await this.prisma.$queryRawUnsafe<any[]>(`SELECT * FROM hr_staff_cards WHERE staff_id=$1 AND tenant_id=$2 AND card_type=$3 AND status='ACTIVE'`, staffId, tenantId, cardType);
    if (existing[0]) return this.parse(existing[0]);
    const staff = await this.prisma.staff.findFirst({ where: { id: staffId, tenantId }, select: { id: true, firstName: true, lastName: true, position: true, email: true, phone: true, employeeNumber: true, tenantMatricule: true, globalMatricule: true, photoUrl: true, tenant: { select: { name: true } } } });
    if (!staff) throw new NotFoundException('Personnel introuvable');
    const token = randomBytes(16).toString('hex');
    const baseUrl = this.config.get('PUBLIC_WEB_URL') || 'https://www.academiahelm.com';
    const qrData = `${baseUrl.replace(/\/+$/, '')}/staff-card/${token}`;
    let qrCodeDataUrl = '';
    if (this.qrcode) { try { qrCodeDataUrl = await this.qrcode.toDataURL(qrData, { width: 200, margin: 1, color: { dark: '#0D1F6E', light: '#ffffff' } }); } catch {} }
    const ss = await this.prisma.schoolSettings.findFirst({ where: { tenantId }, select: { schoolName: true, logoUrl: true, address: true, phone: true, city: true } }).catch(() => null);
    const schoolName = ss?.schoolName || staff.tenant?.name || 'Ecole';
    let logoUrl = ss?.logoUrl || ''; let photoUrl = staff.photoUrl || '';
    try { if (logoUrl) logoUrl = await this.storageService.resolveFileUrl(logoUrl); } catch {}
    try { if (photoUrl) photoUrl = await this.storageService.resolveFileUrl(photoUrl); } catch {}
    const html = this.buildHtml({ staffName: `${staff.firstName} ${staff.lastName}`, staffPosition: staff.position || 'Personnel', staffMatricule: staff.tenantMatricule || staff.globalMatricule || staff.employeeNumber || 'N/A', staffEmail: staff.email || '', staffPhone: staff.phone || '', schoolName, schoolAddress: ss?.address || '', schoolCity: ss?.city || '', schoolPhone: ss?.phone || '', logoUrl, photoUrl, qrCodeDataUrl });
    let pdfUrl = '';
    try { const buf = await this.renderPdf(html); const key = `staff-cards/${tenantId}/${staffId}.pdf`; pdfUrl = await this.storageService.uploadBuffer(buf, key, 'application/pdf'); } catch (e: any) { this.logger.error(`PDF failed: ${e.message}`); }
    await this.prisma.$executeRawUnsafe(`INSERT INTO hr_staff_cards (tenant_id, staff_id, card_type, token, status, pdf_url, qr_data) VALUES ($1,$2,$3,$4,'ACTIVE',$5,$6)`, tenantId, staffId, cardType, token, pdfUrl, qrData);
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT * FROM hr_staff_cards WHERE token=$1`, token);
    return this.parse(rows[0]);
  }

  async getCardByToken(token: string) {
    await this.ensureTableExists();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT c.*, s.first_name, s.last_name, s.position, s.email, s.phone, s.tenant_matricule, s.global_matricule, s.employee_number, s.photo_url FROM hr_staff_cards c JOIN staff s ON c.staff_id=s.id WHERE c.token=$1 AND c.status='ACTIVE'`, token);
    if (!rows[0]) throw new NotFoundException('Carte invalide');
    const c = rows[0]; const t = await this.prisma.tenant.findFirst({ where: { id: c.tenant_id }, select: { name: true, subdomain: true, slug: true } });
    const ss = await this.prisma.schoolSettings.findFirst({ where: { tenantId: c.tenant_id }, select: { schoolName: true, logoUrl: true, address: true, phone: true, city: true } }).catch(() => null);
    let photoUrl = c.photo_url || ''; let logoUrl = ss?.logoUrl || '';
    try { if (photoUrl) photoUrl = await this.storageService.resolveFileUrl(photoUrl); } catch {}
    try { if (logoUrl) logoUrl = await this.storageService.resolveFileUrl(logoUrl); } catch {}
    return { token: c.token, cardType: c.card_type, staffName: `${c.first_name} ${c.last_name}`, staffPosition: c.position || 'Personnel', staffMatricule: c.tenant_matricule || c.global_matricule || c.employee_number || 'N/A', staffEmail: c.email || '', staffPhone: c.phone || '', staffPhotoUrl: photoUrl, schoolName: ss?.schoolName || t?.name || '', schoolLogoUrl: logoUrl, tenantSubdomain: t?.subdomain || t?.slug || '' };
  }

  async listCards(staffId: string, tenantId: string) { await this.ensureTableExists(); const r = await this.prisma.$queryRawUnsafe<any[]>(`SELECT * FROM hr_staff_cards WHERE staff_id=$1 AND tenant_id=$2 ORDER BY created_at DESC`, staffId, tenantId); return r.map(x => this.parse(x)); }
  async revokeCard(id: string, tenantId: string) { await this.ensureTableExists(); await this.prisma.$executeRawUnsafe(`UPDATE hr_staff_cards SET status='REVOKED', updated_at=NOW() WHERE id=$1 AND tenant_id=$2`, id, tenantId); }

  private async renderPdf(html: string) { const { page } = await this.puppeteerPool.acquirePage(); try { await page.setContent(html, { waitUntil: 'networkidle0' }); const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' } }); return Buffer.from(pdf); } finally { await this.puppeteerPool.releasePage(page); } }

  private buildHtml(d: any) {
    const N='#0D1F6E',G='#F5A623';
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:20px}.card{width:340px;height:540px;margin:0 auto 20px;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.15);position:relative}.front{background:linear-gradient(160deg,${N} 0%,#0D3B85 100%);color:#fff}.hdr{padding:20px;text-align:center;border-bottom:3px solid ${G}}.hdr img{height:40px;max-width:120px;margin-bottom:8px}.hdr h2{font-size:11px;color:${G};text-transform:uppercase}.body{padding:20px;text-align:center}.body .ph{width:100px;height:100px;border-radius:50%;border:3px solid ${G};margin:0 auto 12px;overflow:hidden;background:#fff}.body .ph img{width:100%;height:100%;object-fit:cover}.body .pp{width:100px;height:100px;border-radius:50%;border:3px solid ${G};margin:0 auto 12px;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;font-size:36px;color:rgba(255,255,255,.5)}.body h1{font-size:16px;font-weight:bold;margin-bottom:4px}.body p{font-size:12px;color:rgba(255,255,255,.7);margin-bottom:2px}.body .m{font-size:10px;color:${G};font-weight:bold;margin-top:8px}.ft{position:absolute;bottom:0;left:0;right:0;padding:12px 20px;background:rgba(0,0,0,.2);display:flex;justify-content:space-between;align-items:center}.ft .qr img{width:60px;height:60px;background:#fff;padding:4px;border-radius:4px}.ft .i{font-size:8px;color:rgba(255,255,255,.6);text-align:right}.back{background:#fff;color:#333;padding:20px}.back h3{font-size:10px;color:${N};text-transform:uppercase;margin-bottom:8px}.back .r{display:flex;justify-content:space-between;font-size:10px;padding:4px 0;border-bottom:1px solid #eee}.back .r .l{color:#999}.back .r .v{font-weight:bold}.back .ql{text-align:center;margin-top:16px}.back .ql img{width:120px;height:120px}.back .ql p{font-size:8px;color:#999;margin-top:4px}</style></head><body>
<div class="card front"><div class="hdr">${d.logoUrl?`<img src="${d.logoUrl}"/>`:''}<h2>${d.schoolName}</h2></div><div class="body">${d.photoUrl?`<div class="ph"><img src="${d.photoUrl}"/></div>`:`<div class="pp">${d.staffName.charAt(0)}</div>`}<h1>${d.staffName}</h1><p>${d.staffPosition}</p><p>${d.staffPhone}</p><p>${d.staffEmail}</p><div class="m">Matricule: ${d.staffMatricule}</div></div><div class="ft"><div class="qr">${d.qrCodeDataUrl?`<img src="${d.qrCodeDataUrl}"/>`:''}</div><div class="i"><p>Carte professionnelle</p><p>Academia Helm</p></div></div></div>
<div class="card back"><h3>Informations</h3><div class="r"><span class="l">Etablissement</span><span class="v">${d.schoolName}</span></div><div class="r"><span class="l">Adresse</span><span class="v">${d.schoolAddress||'N/A'}${d.schoolCity?', '+d.schoolCity:''}</span></div><div class="r"><span class="l">Telephone</span><span class="v">${d.schoolPhone||'N/A'}</span></div><div class="r"><span class="l">Personnel</span><span class="v">${d.staffName}</span></div><div class="r"><span class="l">Matricule</span><span class="v">${d.staffMatricule}</span></div><div class="ql">${d.qrCodeDataUrl?`<img src="${d.qrCodeDataUrl}"/><p>Scannez pour le profil</p>`:''}</div></div>
</body></html>`;
  }

  private parse(r: any) { return { id: r.id, tenantId: r.tenant_id, staffId: r.staff_id, cardType: r.card_type, token: r.token, status: r.status, pdfUrl: r.pdf_url, qrData: r.qr_data, createdAt: r.created_at }; }
  private async ensureTableExists() { try { await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "hr_staff_cards" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,"tenant_id" TEXT NOT NULL,"staff_id" TEXT NOT NULL,"card_type" TEXT NOT NULL DEFAULT 'PROFESSIONAL',"token" TEXT NOT NULL UNIQUE,"status" TEXT NOT NULL DEFAULT 'ACTIVE',"pdf_url" TEXT,"qr_data" TEXT,"expires_at" TIMESTAMP(3),"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "hr_staff_cards_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE);CREATE INDEX IF NOT EXISTS "idx_hr_staff_cards_tenant" ON "hr_staff_cards" ("tenant_id");CREATE INDEX IF NOT EXISTS "idx_hr_staff_cards_staff" ON "hr_staff_cards" ("staff_id");CREATE INDEX IF NOT EXISTS "idx_hr_staff_cards_token" ON "hr_staff_cards" ("token");`); } catch (e: any) { this.logger.warn(`Table: ${e.message}`); } }
}
