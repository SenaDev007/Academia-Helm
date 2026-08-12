/**
 * ============================================================================
 * TAURI-SQL-FETCH — Adaptateur SQLite pour Tauri
 * ============================================================================
 *
 * ⭐ OFFLINE-FIRST DESKTOP : quand l'app tourne dans Tauri (window.__TAURI__
 *    détecté), cet adaptateur remplace IndexedDB par SQLite via tauri-plugin-sql.
 *
 * Architecture :
 *   - Web (navigateur) → IndexedDB (offline-fetch.ts, existant)
 *   - Desktop (Tauri) → SQLite (tauri-plugin-sql, cet adaptateur)
 *
 * L'adaptateur est injecté dans global-fetch-interceptor.ts : si Tauri est
 * détecté, on utilise tauriSqlFetch au lieu d'offlineFetch.
 *
 * Mapping URL → table SQLite : réutilise store-names.ts (deriveStoreName)
 *   ex: /api/students → SELECT * FROM students
 *   ex: /api/finance/transactions → SELECT * FROM finance_transactions
 *
 * Pour les mutations (POST/PUT/DELETE), on écrit directement dans SQLite
 * et les triggers (migration 003) alimentent automatiquement _sync_outbox.
 * ============================================================================
 */

'use client';

// ─── Détection Tauri ─────────────────────────────────────────────────────

/** Vérifie si on tourne dans une webview Tauri */
export function isTauriEnvironment(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).__TAURI__?.core || !!(window as any).__TAURI__;
}

// ─── Cache de la connexion SQLite ────────────────────────────────────────

let sqlDb: any = null;

async function getSqlDb(): Promise<any> {
  if (sqlDb) return sqlDb;
  try {
    const sql = (window as any).__TAURI__?.sql;
    if (sql) {
      sqlDb = await sql.Database.load('sqlite:academia_helm.db');
      return sqlDb;
    }
  } catch (e) {
    console.error('[TauriSQL] Failed to load database:', e);
  }
  return null;
}

// ─── Mapping store name → SQLite table name ──────────────────────────────

/**
 * Convertit un nom de store IDB (ex: 'student') en nom de table SQLite
 * (ex: 'students'). La convention Prisma utilise le pluriel pour les tables.
 */
function storeToTableName(store: string): string {
  // Cas particuliers de mapping
  const SPECIAL: Record<string, string> = {
    'student': 'students',
    'class': 'classes',
    'staff': 'hr_staff',
    'teacher': 'teachers',
    'guardian': 'guardians',
    'feeoverride': 'fee_overrides',
    'feestructure': 'fee_structures',
    'financetransaction': 'finance_transactions',
    'studentaccount': 'student_accounts',
    'attendance': 'attendance_records',
    'absence': 'absences',
    'exam': 'exams',
    'grade': 'grades',
    'examscore': 'exam_scores',
    'payment': 'payments',
    'invoice': 'helm_invoices',
    'academicyear': 'academic_years',
    'schoollevel': 'school_levels',
    'subject': 'subjects',
    'classdiary': 'class_diaries',
    'lessonplan': 'lesson_plans',
    'timetable': 'timetables',
    'pedagogicalmaterial': 'pedagogical_materials',
    'message': 'messages',
    'announcement': 'announcements',
    'notification': 'notifications',
    'meeting': 'meetings',
    'vehicle': 'transport_vehicles',
    'route': 'transport_routes',
    'transportdriver': 'transport_drivers',
    'canteenmenu': 'canteen_menus',
    'librarybook': 'library_books',
    'shopproduct': 'shop_products',
    'shoporder': 'shop_orders',
    'educastcontent': 'educast_contents',
    'educastchannel': 'educast_channels',
    'tenantidentityprofile': 'tenant_identity_profiles',
    'settingsbilingual': 'settings_bilingual',
    'securitysettings': 'security_settings',
    'tenantfeature': 'tenant_features',
    'academiclevel': 'pedagogy_academic_levels',
    'academicclass': 'pedagogy_academic_classes',
    'academicseries': 'pedagogy_academic_series',
    'academiccycle': 'pedagogy_academic_cycles',
    'position': 'positions',
    'contract': 'contracts',
    'leaverequest': 'leave_requests',
    'salaryslip': 'salary_slips',
    'schooldirectors': 'school_directors',
    'admission': 'admissions',
    'studenttransfer': 'student_transfers',
    'studentdocument': 'student_documents',
    'studentidcard': 'student_id_cards',
    'reportcard': 'report_cards',
    'evaluation': 'evaluations',
    'cashregister': 'cash_registers',
    'feearrear': 'fee_arrears',
    'subscription': 'subscriptions',
    'billinginvoice': 'billing_invoices',
    'room': 'rooms',
    'dailylog': 'pedagogy_daily_logs',
    'classlog': 'pedagogy_class_logs',
    'weeklyreport': 'pedagogy_weekly_reports',
  };
  return SPECIAL[store] || store;
}

// ─── Lecture (GET) ───────────────────────────────────────────────────────

/**
 * Lit des données depuis SQLite via tauri-plugin-sql.
 * Équivalent de offlineFetch mais pour Tauri.
 *
 * @param url - URL API (ex: /api/students?classId=xxx)
 * @param store - Nom du store IDB (ex: 'student')
 * @returns données parsées (array ou objet)
 */
export async function tauriSqlFetch(url: string, store: string): Promise<any> {
  const db = await getSqlDb();
  if (!db) {
    throw new Error('SQLite database not available');
  }

  const tableName = storeToTableName(store);

  // Parser les query params de l'URL
  const urlObj = new URL(url, 'http://localhost');
  const params = urlObj.searchParams;

  // Construire la requête SQL
  let sql = `SELECT * FROM ${tableName}`;
  const conditions: string[] = [];
  const bindings: any[] = [];

  // Filtres communs
  if (params.has('academicYearId')) {
    conditions.push('academic_year_id = ?');
    bindings.push(params.get('academicYearId'));
  }
  if (params.has('schoolLevelId') && params.get('schoolLevelId') !== 'ALL') {
    conditions.push('school_level_id = ?');
    bindings.push(params.get('schoolLevelId'));
  }
  if (params.has('classId')) {
    conditions.push('class_id = ?');
    bindings.push(params.get('classId'));
  }
  if (params.has('status')) {
    conditions.push('status = ?');
    bindings.push(params.get('status'));
  }
  if (params.has('studentId')) {
    conditions.push('student_id = ?');
    bindings.push(params.get('studentId'));
  }
  if (params.has('search')) {
    const search = `%${params.get('search')}%`;
    conditions.push('(first_name LIKE ? OR last_name LIKE ? OR matricule LIKE ?)');
    bindings.push(search, search, search);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  // Tri par défaut
  sql += ' ORDER BY created_at DESC LIMIT 200';

  try {
    const results = await db.select(sql, bindings);
    return results;
  } catch (e) {
    console.warn(`[TauriSQL] Query failed for ${tableName}:`, e);
    // Si la table n'existe pas, retourner un tableau vide
    return [];
  }
}

// ─── Écriture (POST/PUT/PATCH/DELETE) ────────────────────────────────────

/**
 * Écrit une mutation dans SQLite via tauri-plugin-sql.
 * Les triggers (migration 003) alimentent automatiquement _sync_outbox.
 *
 * @param url - URL API (ex: /api/students)
 * @param method - POST | PUT | PATCH | DELETE
 * @param body - données à écrire
 * @param store - nom du store IDB
 * @returns résultat synthétique
 */
export async function tauriSqlMutation(
  url: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body: any,
  store: string,
): Promise<{ data?: any; offline: boolean; error?: string }> {
  const db = await getSqlDb();
  if (!db) {
    throw new Error('SQLite database not available');
  }

  const tableName = storeToTableName(store);

  try {
    switch (method) {
      case 'POST': {
        // INSERT
        const columns = Object.keys(body);
        const values = Object.values(body);
        const placeholders = columns.map(() => '?').join(', ');
        const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
        await db.execute(sql, values);
        return { data: { id: body.id || `local-${Date.now()}`, ...body }, offline: true };
      }
      case 'PUT':
      case 'PATCH': {
        // UPDATE
        const id = body.id || extractIdFromUrl(url);
        if (!id) return { error: 'No ID for UPDATE', offline: true };
        const columns = Object.keys(body).filter(k => k !== 'id');
        const values = Object.values(body).filter((_, i) => Object.keys(body)[i] !== 'id');
        const setClause = columns.map(c => `${c} = ?`).join(', ');
        const sql = `UPDATE ${tableName} SET ${setClause} WHERE id = ?`;
        await db.execute(sql, [...values, id]);
        return { data: body, offline: true };
      }
      case 'DELETE': {
        // DELETE
        const id = extractIdFromUrl(url);
        if (!id) return { error: 'No ID for DELETE', offline: true };
        const sql = `DELETE FROM ${tableName} WHERE id = ?`;
        await db.execute(sql, [id]);
        return { data: { success: true }, offline: true };
      }
      default:
        return { error: `Unsupported method: ${method}`, offline: true };
    }
  } catch (e: any) {
    console.error(`[TauriSQL] Mutation failed for ${tableName}:`, e);
    return { error: e?.message || 'SQLite mutation failed', offline: true };
  }
}

// ─── Helper ──────────────────────────────────────────────────────────────

/** Extrait l'ID depuis une URL (ex: /api/students/abc-123 → abc-123) */
function extractIdFromUrl(url: string): string | null {
  const parts = url.split('/').filter(Boolean);
  const lastPart = parts[parts.length - 1];
  // Retirer les query params
  return lastPart?.split('?')[0] || null;
}

// ─── Statistiques SQLite ─────────────────────────────────────────────────

/**
 * Récupère le nombre d'écritures en attente dans _sync_outbox.
 * Utilisé par le badge du bouton Sync.
 */
export async function tauriGetPendingCount(): Promise<number> {
  const db = await getSqlDb();
  if (!db) return 0;
  try {
    const result = await db.select("SELECT COUNT(*) as count FROM _sync_outbox WHERE status = 'pending'");
    return result?.[0]?.count || 0;
  } catch {
    return 0;
  }
}
