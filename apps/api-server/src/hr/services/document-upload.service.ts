import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../common/services/storage.service';
import { EmailService } from '../../communication/services/email.service';
import { randomBytes } from 'crypto';
import { Inject, forwardRef } from '@nestjs/common';
import { renderDocumentUploadRequest, TenantBranding } from '../recruitment-email-templates';

export interface RequiredDoc { type: string; label: string; required: boolean; category: string; }
export interface SendDocumentUploadDto {
  /** Candidate ID (HrCandidate). Si absent, staffId sera utilisé pour résoudre le candidat via HrApplication. */
  candidateId?: string;
  /** Staff ID (Staff). Si fourni sans candidateId, résolution automatique via HrApplication. */
  staffId?: string;
  requiredDocs?: RequiredDoc[];
}
export interface UploadDocumentDto { docType: string; fileName: string; fileContent: string; contentType?: string; }

const DEFAULT_REQUIRED_DOCS: RequiredDoc[] = [
  { type: 'CNI', label: "Carte d'identité / Passeport", required: true, category: 'IDENTITE' },
  { type: 'DIPLOMA', label: 'Diplôme le plus élevé', required: true, category: 'DIPLOMES' },
  { type: 'CV', label: 'CV / Curriculum Vitae', required: true, category: 'EXPERIENCE' },
  { type: 'APPLICATION_LETTER', label: 'Lettre de demande d\'emploi', required: true, category: 'EXPERIENCE' },
  { type: 'COVER_LETTER', label: 'Lettre de motivation', required: false, category: 'EXPERIENCE' },
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

    // ─── Résolution du destinataire via Prisma client ─────────────────────
    // Utilise le Prisma client (et non raw SQL) pour éviter les erreurs de
    // mapping de noms de colonnes (camelCase vs snake_case).
    // Accepte soit candidateId direct, soit staffId (résolution via HrApplication).
    let candidate: { id: string; firstName: string; lastName: string; email: string | null } | null = null;

    if (dto.candidateId) {
      const found = await this.prisma.hrCandidate.findFirst({
        where: { id: dto.candidateId, tenantId },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      candidate = found ?? null;
    } else if (dto.staffId) {
      // 1. Résolution: staffId → HrApplication.staffId → candidate
      const app = await this.prisma.hrApplication.findFirst({
        where: { staffId: dto.staffId, tenantId },
        select: { candidate: { select: { id: true, firstName: true, lastName: true, email: true } } },
      });
      candidate = app?.candidate ?? null;

      // 2. Fallback: si pas de candidature liée, on utilise directement les infos du staff
      if (!candidate) {
        const staff = await this.prisma.staff.findFirst({
          where: { id: dto.staffId, tenantId },
          select: { id: true, firstName: true, lastName: true, email: true },
        });
        if (staff) {
          candidate = { id: staff.id, firstName: staff.firstName, lastName: staff.lastName, email: staff.email };
        }
      }
    }

    if (!candidate) throw new NotFoundException('Aucun candidat ou personnel correspondant trouvé. Vérifiez que le personnel existe.');
    if (!candidate.email) throw new BadRequestException("Le destinataire n'a pas d'email");

    // hr_document_upload_tokens est une table créée en raw SQL (snake_case) — on garde le raw SQL pour elle
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

      // ─── Récupérer le branding du tenant (logo + nom école) ─────────────
      // Même logique que recruitment-notification.service.ts getTenantBranding()
      const branding = await this.getTenantBranding(tenantId);

      // ─── Générer l'email avec le template standard Helm ──────────────────
      // (header: logo + nom école / footer: Academia Helm)
      const { subject, html } = renderDocumentUploadRequest({
        branding,
        candidateName: `${candidate.firstName} ${candidate.lastName}`,
        candidateFirstName: candidate.firstName,
        jobTitle: 'Finalisation de votre dossier',
        uploadUrl,
        expiresAtFormatted: expiresAt.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }),
        requiredDocs: reqList,
        optionalDocs: optList,
      });

      await this.emailService.sendCategorized({
        tenantId,
        category: 'RECRUTEMENT' as any,
        subCategory: 'upload_documents',
        module: 'hr',
        to: candidate.email,
        toName: `${candidate.firstName} ${candidate.lastName}`,
        recipientType: 'CANDIDAT' as any,
        recipientId: candidate.id,
        fromEmail,
        fromName: branding.schoolName, // ← nom de l'école, pas 'Academia Helm'
        subject,
        html,
        triggeredBy: 'SYSTEM',
        relatedEntityId: candidate.id,
        relatedEntityType: 'HrCandidate',
      });
    } catch (e: any) { this.logger.error(`Email failed: ${e.message}`); }
    return { token, uploadUrl };
  }

  /**
   * Récupère le branding (logo + nom + contact) du tenant.
   * Même logique que recruitment-notification.service.ts getTenantBranding().
   */
  private async getTenantBranding(tenantId: string): Promise<TenantBranding> {
    try {
      // 0. Récupérer le RecruiterProfile (config recruteur) pour l'email + signature
      const recruiterProfile = await this.prisma.recruiterProfile
        .findFirst({
          where: { tenantId, isActive: true },
          select: {
            fullName: true,
            email: true,
            phone: true,
            functionLabel: true,
            signatureText: true,
            signatureLogoUrl: true,
          },
        })
        .catch(() => null);

      // 1. Essayer tenant_identity_profiles (identité école)
      const profile = await this.prisma.tenantIdentityProfile.findFirst({
        where: { tenantId, isActive: true },
        select: {
          schoolName: true,
          logoUrl: true,
          address: true,
          phonePrimary: true,
          email: true,
        },
      });

      if (profile?.schoolName) {
        // Utiliser l'URL publique du logo au lieu du base64 (Gmail/Outlook bloquent les base64 volumineux)
        const apiBaseUrl = this.config.get<string>('APP_PUBLIC_URL')
          || 'https://academia-helm-api.fly.dev';
        const logoUrl = profile.logoUrl
          ? `${apiBaseUrl}/api/tenants/${tenantId}/logo`
          : null;

        return {
          schoolName: profile.schoolName,
          schoolLogo: logoUrl,
          schoolAddress: profile.address,
          schoolPhone: profile.phonePrimary,
          schoolEmail: profile.email,
          recruiterName: recruiterProfile?.fullName,
          recruiterEmail: recruiterProfile?.email,
          recruiterFunction: recruiterProfile?.functionLabel,
          recruiterPhone: recruiterProfile?.phone,
          signatureText: recruiterProfile?.signatureText,
          signatureLogoUrl: recruiterProfile?.signatureLogoUrl,
        };
      }

      // 2. Fallback sur le tenant directement
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });
      return {
        schoolName: tenant?.name || 'Établissement',
        recruiterName: recruiterProfile?.fullName,
        recruiterEmail: recruiterProfile?.email,
        recruiterFunction: recruiterProfile?.functionLabel,
        recruiterPhone: recruiterProfile?.phone,
        signatureText: recruiterProfile?.signatureText,
        signatureLogoUrl: recruiterProfile?.signatureLogoUrl,
      };
    } catch (err: any) {
      this.logger.warn(`getTenantBranding failed for tenant ${tenantId}: ${err.message}`);
      return { schoolName: 'Établissement' };
    }
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

  private async ensureTableExists() {
    try { await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "hr_document_upload_tokens" ("id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,"tenant_id" TEXT NOT NULL,"candidate_id" TEXT NOT NULL,"staff_id" TEXT,"token" TEXT NOT NULL UNIQUE,"status" TEXT NOT NULL DEFAULT 'PENDING',"required_docs" TEXT NOT NULL DEFAULT '[]',"uploaded_docs" TEXT,"expires_at" TIMESTAMP(3),"completed_at" TIMESTAMP(3),"candidate_email" TEXT,"candidate_name" TEXT,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "hr_document_upload_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE);CREATE INDEX IF NOT EXISTS "idx_hr_document_upload_tokens_tenant" ON "hr_document_upload_tokens" ("tenant_id");CREATE INDEX IF NOT EXISTS "idx_hr_document_upload_tokens_token" ON "hr_document_upload_tokens" ("token");`); } catch (e: any) { this.logger.warn(`Table: ${e.message}`); }
  }
}
