"use client";

/**
 * ============================================================================
 * MA PRÉSENCE & CONGÉS — Page self-service partagée par TOUT le personnel
 * ============================================================================
 *
 * ⭐ 2026-11-21 — Extension du self-service RH à tous les membres du personnel
 * (directeur, secrétaire, secrétaire-comptable, comptable, surveillant,
 * censeur… et enseignants via /app/teacher/presence) :
 *
 * Chaque membre du personnel peut, DEPUIS SON INTERFACE :
 *   - pointer SA présence du jour (auto-pointage GPS vérifié serveur)
 *   - consulter l'historique de ses présences (synchronisé avec l'onglet
 *     Présences du module RH — les données alimentent la paie)
 *   - déclarer ses heures supplémentaires (validées par le RH)
 *   - créer ses demandes de congé ET d'absence justifiée (motif libre) —
 *     le RH les reçoit dans le module RH → Congés & Absences, les approuve
 *     ou les refuse, et le personnel est notifié dans son interface (cloche)
 *
 * Le Staff est résolu CÔTÉ SERVEUR par l'email de l'utilisateur connecté
 * (anti-usurpation) — la même page sert tous les métiers. Le rendu se fait
 * dans le shell du portail de CHAQUE métier (voir admin-portal-map.ts).
 * ============================================================================
 */

import { TeacherPresenceWorkspace } from "@/components/teacher/TeacherPresenceWorkspace";

export default function MyPresencePage() {
  return <TeacherPresenceWorkspace />;
}
