import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { EmailService } from '../../communication/services/email.service';
import { randomBytes } from 'crypto';
import { Inject, forwardRef } from '@nestjs/common';

export interface RequiredDoc { type: string; label: string; required: boolean; category: string; }
export interface SendDocumentUploadDto { candidateId: string; staffId?: string; requiredDocs?: RequiredDoc[]; }
export interface UploadDocumentDto { docType: string; fileName: string; fileContent: string; contentType?: string; }

const DEFAULT_REQUIRED_DOCS: RequiredDoc[] = [
  { type: 'CNI', label: "Carte d'identité / Passeport", required: true, category: 'IDENTITE' },
  { type: 'DIPLOMA', label: 'Diplôme le plus élevé', required: true, category: 'DIPLOMES' },
  { type: 'CV', label: 'CV / Curriculum Vitae', required: false, category: 'EXPERIENCE' },
  { type: 'WORK_CERTIFICATE', label: 'Attestations de travail', required: false, category: 'EXPERIENCE' },
  { type: 'CNSS_CERTIFICATE', label: 'Attestation CNSS', required: false, category: 'ADMINISTRATIF' },
  { type: 'MEDICAL_CERTIFICATE', label: 'Certificat médical', required: false, category: 'MEDICAL' },
  { type: 'OTHER', label: 'Autre document', required: false, category: 'GENERAL' },
];

@Injectable()
export class DocumentUploadService {
  private readonly logger = new Logger(DocumentUploadService.name);
  constructor(private prisma: PrismaService, private config: ConfigService, private storageService: StorageService, @Inject(forwardRef(() => EmailService)) private emailService: EmailService) {}

  async sendUploadLink(tenantId: string, dto: SendDocumentUploadDto) {
    await this.ensureTableExists();
    const candidate = await this.prisma.hrCandidate.findFirst({ where: { id: dto.candidateId, tenantId }, select: { id: true, firstName: true, lastName: true, email: true } });
    if (!candidate) throw new NotFoundException('Candidat introuvable');
    if (!candidate.email) throw new BadRequestException("Le candidat n'a pas d'email");
    await this.prisma.$executeRawUnsafe(`UPDATE hr_document_upload_tokens SET status='EXPIRED' WHERE candidate_id=$1 AND status='PENDING'`, candidate.id);
    const token = randomBytes(16).toString('hex');
    const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + 7);
    const requiredDocs = dto.requiredDocs || DEFAULT_REQUIRED_DOCS;
    await this.prisma.$executeRawUnsafe(`INSERT INTO hr_document_upload_tokens (tenant_id, candidate_id, staff_id, token, status, required_docs, expires_at, candidate_email, candidate_name) VALUES ($1,$2,$3,$4,'PENDING',$5,$6,$7,$8)`, tenantId, candidate.id, dto.staffId || null, token, JSON.stringify(requiredDocs), expiresAt, candidate.email, `${candidate.firstName} ${candidate.lastName}`);
    const baseUrl = this.config.get('PUBLIC_WEB_URL') || 'https://www.academiahelm.com';
    const uploadUrl = `${baseUrl.replace(/\/+$/, '')}/upload-documents/${token}`;
    try {
      const fromEmail = this.config.get('EMAIL_FROM_NOREPLY') || 'noreply@academiahelm.com';
      const reqList = requiredDocs.filter(d => d.required).map(d => d.label);
      const optList = requiredDocs.filter(d => !d.required).map(d => d.label);
      const html = this.buildEmail(candidate.firstName, candidate.lastName, uploadUrl, expiresAt.toLocaleDateString('fr-FR'), reqList, optList);
      await this.emailService.sendCategorized({ tenantId, category: 'RECRUTEMENT' as any, subCategory: 'upload_documents', module: 'hr', to: candidate.email, toName: `${candidate.firstName} ${candidate.lastName}`, recipientType: 'CANDIDAT' as any, recipientId: candidate.id, fromEmail, fromName: 'Academia Helm', subject: '📎 Documents à fournir', html, triggeredBy: 'SYSTEM', relatedEntityId: candidate.id, relatedEntityType: 'HrCandidate' });
    } catch (e: any) { this.logger.error(`Email failed: ${e.message}`); }
    return { token, uploadUrl };
  }

  async getUploadInfo(token: string) {
    await this.ensureTableExists();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT * FROM hr_document_upload_tokens WHERE token=$1`, token);
    if (!rows[0]) throw new NotFoundException('Lien invalide');
    const r = rows[0];
    if (r.status === 'COMPLETED') throw new BadRequestException('Documents déjà soumis');
    if (r.status === 'EXPIRED' || (r.expires_at && new Date(r.expires_at) < new Date())) throw new BadRequestException('Lien expiré');
    return { token, candidateName: r.candidate_name, requiredDocs: JSON.parse(r.required_docs || '[]'), uploadedDocs: r.uploaded_docs ? JSON.parse(r.uploaded_docs) : [], expiresAt: r.expires_at };
  }

  async uploadDocument(token: string, dto: UploadDocumentDto) {
    await this.ensureTableExists();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT * FROM hr_document_upload_tokens WHERE token=$1 AND status='PENDING'`, token);
    if (!rows[0]) throw new BadRequestException('Lien invalide ou expiré');
    const r = rows[0];
    const buffer = Buffer.from(dto.fileContent, 'base64');
    const key = `staff-documents/${r.tenant_id}/${r.candidate_id}/${dto.docType}-${Date.now()}-${dto.fileName}`;
    let url: string;
    try { url = await this.storageService.uploadBuffer(buffer, key, dto.contentType || 'application/octet-stream'); } catch { throw new BadRequestException('Erreur stockage'); }
    if (r.staff_id) { try { await this.prisma.staffDocument.create({ data: { staffId: r.staff_id, tenantId: r.tenant_id, docType: dto.docType, fileName: dto.fileName, fileUrl: url, status: 'PENDING' } }); } catch {} }
    const uploaded = r.uploaded_docs ? JSON.parse(r.uploaded_docs) : [];
    uploaded.push({ docType: dto.docType, fileName: dto.fileName, url, uploadedAt: new Date().toISOString() });
    await this.prisma.$executeRawUnsafe(`UPDATE hr_document_upload_tokens SET uploaded_docs=$2 WHERE token=$1`, token, JSON.stringify(uploaded));
    return { success: true, url, fileName: dto.fileName };
  }

  async submitDocuments(token: string) {
    await this.ensureTableExists();
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`SELECT * FROM hr_document_upload_tokens WHERE token=$1 AND status='PENDING'`, token);
    if (!rows[0]) throw new BadRequestException('Lien invalide');
    await this.prisma.$executeRawUnsafe(`UPDATE hr_document_upload_tokens SET status='COMPLETED', completed_at=NOW() WHERE token=$1`, token);
    return { success: true };
  }

  async listUploadTokens(tenantId: string, candidateId?: string) {
    await this.ensureTableExists();
    let sql = `SELECT * FROM hr_document_upload_tokens WHERE tenant_id=$1`; const p: any[] = [tenantId];
    if (candidateId) { sql += ` AND candidate_id=$2`; p.push(candidateId); }
    sql += ` ORDER BY created_at DESC`;
    const rows = await this.prisma.$queryRawUnsafe<any[]>(sql, ...p);
    return rows.map(r => ({ id: r.id, tenantId: r.tenant_id, candidateId: r.candidate_id, staffId: r.staff_id, token: r.token, status: r.status, requiredDocs: JSON.parse(r.required_docs || '[]'), uploadedDocs: r.uploaded_docs ? JSON.parse(r.uploaded_docs) : [], candidateEmail: r.candidate_email, candidateName: r.candidate_name, createdAt: r.created_at }));
  }

  private buildEmail(fn: string, ln: string, url: string, exp: string, req: string[], opt: string[]) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;"><table cellpadding="0" cellspacing="0" width="100%" style="background:#eef2f7;"><tr><td align="center" style="padding:24px 12px;"><table cellpadding="0" cellspacing="0" width="600" style="max-width:600px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);"><tr><td style="background:linear-gradient(160deg,#0D1F6E 0%,#0D3B85 100%);padding:28px 24px;border-bottom:3px solid #F5A623;"><h2 style="margin:0;color:#fff;font-size:20px;">📎 Documents à fournir</h2><p style="margin:6px 0 0;color:#F5A623;font-size:13px;">Finalisation de votre candidature</p></td></tr><tr><td style="padding:32px 28px;"><p style="margin:0 0 16px;color:#475569;font-size:14px;">Bonjour <strong>${fn} ${ln}</strong>,</p><p style="margin:0 0 20px;color:#475569;font-size:14px;">Suite à votre entretien, nous avons besoin de certains documents pour finaliser votre dossier.</p><div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:18px;margin-bottom:20px;"><p style="margin:0 0 8px;color:#dc2626;font-weight:bold;font-size:13px;">📋 Obligatoires :</p><ul style="margin:0 0 12px;padding-left:20px;color:#475569;font-size:13px;">${req.map(d=>`<li>${d}</li>`).join('')}</ul>${opt.length?`<p style="margin:0 0 8px;color:#64748b;font-weight:bold;font-size:13px;">📄 Optionnels :</p><ul style="margin:0;padding-left:20px;color:#94a3b8;font-size:13px;">${opt.map(d=>`<li>${d}</li>`).join('')}</ul>`:''}</div><a href="${url}" style="display:inline-block;background:#0D1F6E;color:#fff;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:bold;text-decoration:none;">Télécharger mes documents →</a><p style="margin:16px 0 0;color:#94a3b8;font-size:12px;">⏰ Lien expire le ${exp}<br/><a href="${url}" style="color:#0D1F6E;">${url}</a></p></td></tr><tr><td style="background:#0D1F6E;padding:20px;text-align:center;"><span style="color:#fff;font-weight:bold;font-size:13px;">Academia Helm</span></td></tr></table></td></tr></table></body></html>`;
  }

  private async ensureTableExists() {
    try { await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "hr_document_upload_tokens" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,"tenant_id" TEXT NOT NULL,"candidate_id" TEXT NOT NULL,"staff_id" TEXT,"token" TEXT NOT NULL UNIQUE,"status" TEXT NOT NULL DEFAULT 'PENDING',"required_docs" TEXT NOT NULL DEFAULT '[]',"uploaded_docs" TEXT,"expires_at" TIMESTAMP(3),"completed_at" TIMESTAMP(3),"candidate_email" TEXT,"candidate_name" TEXT,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "hr_document_upload_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE);CREATE INDEX IF NOT EXISTS "idx_hr_document_upload_tokens_tenant" ON "hr_document_upload_tokens" ("tenant_id");CREATE INDEX IF NOT EXISTS "idx_hr_document_upload_tokens_token" ON "hr_document_upload_tokens" ("token");`); } catch (e: any) { this.logger.warn(`Table: ${e.message}`); }
  }
}
