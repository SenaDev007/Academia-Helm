/**
 * ============================================================================
 * CONTRACT DOCUMENT CONFIG SERVICE
 * ============================================================================
 *
 * Gère la configuration visuelle des contrats pour chaque école :
 *   - En-tête (logo, nom, adresse, contact, n° autorisation, ligne décorative)
 *   - Pied de page (signature, n° page, réf contrat, QR code)
 *   - Filigrane (texte personnalisable, opacité, rotation)
 *   - Style (couleurs, police, tailles, marges)
 *
 * Une config par tenant (UNIQUE sur tenant_id). Si pas de config, on utilise
 * les valeurs par défaut (définies dans la migration SQL).
 *
 * Utilise raw SQL ($queryRawUnsafe / $executeRawUnsafe) car le Prisma client
 * n'est pas régénéré (même pattern que scheduled-emails).
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface ContractDocumentConfig {
  id: string;
  tenant_id: string;

  // En-tête
  header_logo_url: string | null;
  header_logo_position: string;
  header_logo_max_height: number;
  header_show_school_name: boolean;
  header_show_address: boolean;
  header_show_contact: boolean;
  header_show_authorization_number: boolean;
  header_show_decorative_line: boolean;
  header_decorative_line_color: string;
  header_background_color: string;

  // Filigrane
  watermark_text: string | null;
  watermark_opacity: number;
  watermark_font_size: number;
  watermark_rotation: number;
  watermark_color: string;

  // Pied de page
  footer_show_academia_signature: boolean;
  footer_show_page_number: boolean;
  footer_show_contract_ref: boolean;
  footer_show_qr_code: boolean;
  footer_background_color: string;
  footer_accent_color: string;

  // Style
  style_primary_color: string;
  style_accent_color: string;
  style_font_family: string;
  style_title_font_size: number;
  style_body_font_size: number;
  style_line_height: number;
  style_margin_top: number;
  style_margin_bottom: number;
  style_margin_left: number;
  style_margin_right: number;

  created_at: Date;
  updated_at: Date;
}

export interface UpdateContractDocumentConfigDto {
  // En-tête
  header_logo_url?: string;
  header_logo_position?: string;
  header_logo_max_height?: number;
  header_show_school_name?: boolean;
  header_show_address?: boolean;
  header_show_contact?: boolean;
  header_show_authorization_number?: boolean;
  header_show_decorative_line?: boolean;
  header_decorative_line_color?: string;
  header_background_color?: string;

  // Filigrane
  watermark_text?: string;
  watermark_opacity?: number;
  watermark_font_size?: number;
  watermark_rotation?: number;
  watermark_color?: string;

  // Pied de page
  footer_show_academia_signature?: boolean;
  footer_show_page_number?: boolean;
  footer_show_contract_ref?: boolean;
  footer_show_qr_code?: boolean;
  footer_background_color?: string;
  footer_accent_color?: string;

  // Style
  style_primary_color?: string;
  style_accent_color?: string;
  style_font_family?: string;
  style_title_font_size?: number;
  style_body_font_size?: number;
  style_line_height?: number;
  style_margin_top?: number;
  style_margin_bottom?: number;
  style_margin_left?: number;
  style_margin_right?: number;
}

@Injectable()
export class ContractDocumentConfigService {
  private readonly logger = new Logger(ContractDocumentConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère la config d'un tenant. Si elle n'existe pas, la crée avec les
   * valeurs par défaut (upsert).
   */
  async getConfig(tenantId: string): Promise<ContractDocumentConfig> {
    // Vérifier si la table existe (OnModuleInit la crée normalement)
    await this.ensureTableExists();

    const rows = await this.prisma.$queryRawUnsafe<ContractDocumentConfig[]>(`
      SELECT * FROM contract_document_configs WHERE tenant_id = $1
    `, tenantId);

    if (rows[0]) return rows[0];

    // Pas de config → créer avec les valeurs par défaut
    return this.createDefaultConfig(tenantId);
  }

  /**
   * Met à jour la config d'un tenant (upsert).
   */
  async updateConfig(
    tenantId: string,
    dto: UpdateContractDocumentConfigDto,
  ): Promise<ContractDocumentConfig> {
    await this.ensureTableExists();

    // Construire la liste des colonnes à mettre à jour
    const fields: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    const fieldMap: Record<string, any> = {
      header_logo_url: dto.header_logo_url,
      header_logo_position: dto.header_logo_position,
      header_logo_max_height: dto.header_logo_max_height,
      header_show_school_name: dto.header_show_school_name,
      header_show_address: dto.header_show_address,
      header_show_contact: dto.header_show_contact,
      header_show_authorization_number: dto.header_show_authorization_number,
      header_show_decorative_line: dto.header_show_decorative_line,
      header_decorative_line_color: dto.header_decorative_line_color,
      header_background_color: dto.header_background_color,
      watermark_text: dto.watermark_text,
      watermark_opacity: dto.watermark_opacity,
      watermark_font_size: dto.watermark_font_size,
      watermark_rotation: dto.watermark_rotation,
      watermark_color: dto.watermark_color,
      footer_show_academia_signature: dto.footer_show_academia_signature,
      footer_show_page_number: dto.footer_show_page_number,
      footer_show_contract_ref: dto.footer_show_contract_ref,
      footer_show_qr_code: dto.footer_show_qr_code,
      footer_background_color: dto.footer_background_color,
      footer_accent_color: dto.footer_accent_color,
      style_primary_color: dto.style_primary_color,
      style_accent_color: dto.style_accent_color,
      style_font_family: dto.style_font_family,
      style_title_font_size: dto.style_title_font_size,
      style_body_font_size: dto.style_body_font_size,
      style_line_height: dto.style_line_height,
      style_margin_top: dto.style_margin_top,
      style_margin_bottom: dto.style_margin_bottom,
      style_margin_left: dto.style_margin_left,
      style_margin_right: dto.style_margin_right,
    };

    for (const [key, value] of Object.entries(fieldMap)) {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIdx++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) {
      return this.getConfig(tenantId);
    }

    fields.push(`updated_at = NOW()`);
    values.push(tenantId);

    // Upsert : INSERT ... ON CONFLICT UPDATE
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO contract_document_configs (tenant_id)
      VALUES ($${paramIdx})
      ON CONFLICT (tenant_id) DO NOTHING
    `, tenantId);

    await this.prisma.$executeRawUnsafe(`
      UPDATE contract_document_configs
      SET ${fields.join(', ')}
      WHERE tenant_id = $${paramIdx}
    `, ...values);

    return this.getConfig(tenantId);
  }

  /**
   * Crée une config avec les valeurs par défaut pour un tenant.
   */
  private async createDefaultConfig(tenantId: string): Promise<ContractDocumentConfig> {
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO contract_document_configs (tenant_id)
      VALUES ($1)
      ON CONFLICT (tenant_id) DO NOTHING
    `, tenantId);

    const rows = await this.prisma.$queryRawUnsafe<ContractDocumentConfig[]>(`
      SELECT * FROM contract_document_configs WHERE tenant_id = $1
    `, tenantId);

    return rows[0];
  }

  /**
   * Vérifie que la table existe, la crée si nécessaire (idempotent).
   */
  private async ensureTableExists(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "contract_document_configs" (
            "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
            "tenant_id"       TEXT NOT NULL UNIQUE,
            "header_logo_url"         TEXT,
            "header_logo_position"    TEXT DEFAULT 'left',
            "header_logo_max_height"  INT DEFAULT 60,
            "header_show_school_name" BOOLEAN DEFAULT true,
            "header_show_address"     BOOLEAN DEFAULT true,
            "header_show_contact"     BOOLEAN DEFAULT true,
            "header_show_authorization_number" BOOLEAN DEFAULT true,
            "header_show_decorative_line" BOOLEAN DEFAULT true,
            "header_decorative_line_color" TEXT DEFAULT '#F5A623',
            "header_background_color" TEXT DEFAULT '#0D1F6E',
            "watermark_text"          TEXT,
            "watermark_opacity"       DECIMAL(3,2) DEFAULT 0.05,
            "watermark_font_size"     INT DEFAULT 72,
            "watermark_rotation"      INT DEFAULT -45,
            "watermark_color"         TEXT DEFAULT '#1A2BA6',
            "footer_show_academia_signature" BOOLEAN DEFAULT true,
            "footer_show_page_number"        BOOLEAN DEFAULT true,
            "footer_show_contract_ref"       BOOLEAN DEFAULT true,
            "footer_show_qr_code"            BOOLEAN DEFAULT true,
            "footer_background_color"        TEXT DEFAULT '#0D1F6E',
            "footer_accent_color"            TEXT DEFAULT '#F5A623',
            "style_primary_color"     TEXT DEFAULT '#0D1F6E',
            "style_accent_color"      TEXT DEFAULT '#F5A623',
            "style_font_family"       TEXT DEFAULT 'Times New Roman, serif',
            "style_title_font_size"   INT DEFAULT 15,
            "style_body_font_size"    INT DEFAULT 12,
            "style_line_height"       DECIMAL(3,2) DEFAULT 1.7,
            "style_margin_top"        INT DEFAULT 20,
            "style_margin_bottom"     INT DEFAULT 20,
            "style_margin_left"       INT DEFAULT 15,
            "style_margin_right"      INT DEFAULT 15,
            "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "contract_document_configs_tenant_id_fkey"
                FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS "idx_contract_document_configs_tenant"
            ON "contract_document_configs" ("tenant_id");
      `);
    } catch (err: any) {
      this.logger.warn(`Failed to ensure contract_document_configs table: ${err.message}`);
    }
  }
}
