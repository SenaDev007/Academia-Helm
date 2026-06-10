/**
 * Local Audit Service
 * 
 * Journalisation des actions critiques effectuées en mode offline.
 * 
 * RÈGLE : Section 21.1 du Cahier Technique
 */

import { localDb } from './local-db.service';

export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'SYNC' | 'CONFLICT_RESOLVED';

export interface LocalAuditLog {
  id: string;
  tenantId: string;
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  details: string;
  timestamp: string;
  deviceId: string;
}

export class LocalAuditService {
  /**
   * Enregistre une action dans le journal d'audit local
   */
  static async log(
    tenantId: string, 
    userId: string, 
    action: AuditAction, 
    entityType: string, 
    entityId: string, 
    details: any
  ): Promise<void> {
    const log: LocalAuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      tenantId,
      userId,
      action,
      entityType,
      entityId,
      details: typeof details === 'string' ? details : JSON.stringify(details),
      timestamp: new Date().toISOString(),
      deviceId: localStorage.getItem('device_id') || 'unknown'
    };

    await localDb.execute('local_audit_log', 'add', log);
    console.log(`[Audit] ${action} logged for ${entityType}:${entityId}`);
  }

  /**
   * Récupère les derniers logs d'audit
   */
  static async getLogs(tenantId: string, limit = 50): Promise<LocalAuditLog[]> {
    const logs = await localDb.query<LocalAuditLog>('local_audit_log');
    return logs
      .filter(l => l.tenantId === tenantId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  }
}
