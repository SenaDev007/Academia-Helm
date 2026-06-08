/**
 * ============================================================================
 * AUDIT LOG DECORATOR - LOGGING CIBLÉ
 * ============================================================================
 * 
 * Decorator pour forcer le logging d'une action même si elle n'est pas
 * normalement considérée comme sensible
 * 
 * Usage:
 * @AuditLog('CUSTOM_ACTION', 'custom_resource')
 * @Get()
 * async customAction() { ... }
 * 
 * ============================================================================
 */

import { SetMetadata } from '@nestjs/common';

export const AUDIT_LOG_KEY = 'audit_log';
export interface AuditLogMetadata {
  action: string;
  resource: string;
}

export const AuditLog = (action: string, resource: string) =>
  SetMetadata(AUDIT_LOG_KEY, { action, resource } as AuditLogMetadata);

