"use client";

/**
 * ============================================================================
 * PORTAIL ENSEIGNANT — Module « Présence & Absences »
 * ============================================================================
 *
 * ⭐ 2026-09-15 — INTÉGRATION CAHIER DE SEMAINE ↔ RH :
 * Chaque enseignant peut :
 *   - pointer SA présence du jour (auto-pointage GPS vérifié serveur)
 *   - déclarer un RETARD au pointage
 *   - consulter l'historique de ses présences (y compris celles marquées
 *     par le semainier depuis le cahier de semaine — synchronisées)
 *   - déclarer ses heures supplémentaires (validées par la direction)
 *   - créer / suivre / annuler ses demandes de congé et d'absence
 *     (approuvées par la direction dans le module RH → Congés & Absences)
 *
 * Le promoteur et la direction suivent tout depuis le module Personnel RH
 * (onglets Présences et Congés & Absences) — les deux canaux sont
 * synchronisés via la table staff_attendances (source de vérité unique).
 * ============================================================================
 */

import { TeacherPresenceWorkspace } from "@/components/teacher/TeacherPresenceWorkspace";

export default function TeacherPresencePage() {
  return <TeacherPresenceWorkspace />;
}
