/**
 * ============================================================================
 * PERMISSION ACTION ENUM
 * ============================================================================
 */

export enum PermissionAction {
  READ = 'READ', // 👁️ Lecture seule
  WRITE = 'WRITE', // ✅ Écriture
  DELETE = 'DELETE', // ❌ Suppression
  MANAGE = 'MANAGE', // 🔧 Gestion complète (lecture + écriture + suppression)
}
