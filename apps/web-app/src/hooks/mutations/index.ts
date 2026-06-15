/**
 * ============================================================================
 * Mutation Hooks — Barrel export
 * ============================================================================
 *
 * Hooks de mutation optimiste pour les opérations fréquentes.
 * Chaque hook utilise @tanstack/react-query useMutation avec :
 *   - onMutate : mise à jour optimiste du cache (réponse instantanée)
 *   - onError : rollback automatique en cas d'erreur
 *   - onSuccess : invalidation des queries pour synchroniser avec le serveur
 * ============================================================================
 */

export { useRecordPayment } from './useRecordPayment';
export { useMarkAttendance } from './useMarkAttendance';
export { useSaveGrades } from './useSaveGrades';
