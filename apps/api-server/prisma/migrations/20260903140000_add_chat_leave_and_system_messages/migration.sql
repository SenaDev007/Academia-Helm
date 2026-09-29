-- ═════════════════════════════════════════════════════════════════
--  ⭐ MESSAGES SYSTÈME « X a rejoint / a quitté le groupe »
--    Type de message 'SYSTEM' (colonne type = TEXT libre — aucun CHECK
--    à modifier), métadonnées structurées dans callMeta (JSONB, recyclé
--    comme pour CALL_LOG) : { kind: 'member_join' | 'member_leave',
--    userId, name, byName }.
-- ═════════════════════════════════════════════════════════════════
-- Rien à créer : chat_messages existe déjà ; ce migration marque
-- l'introduction du type SYSTEM + l'endpoint conversations/:id/leave.
SELECT 1;
