"use client";

/**
 * ============================================================================
 * MA PAIE — Page self-service du portail enseignant
 * ============================================================================
 *
 * ⭐ 22/11/2026 — Self-service paie des enseignants (retour promoteur) :
 * chaque enseignant consulte SES fiches de paie / états de paiement émis et
 * télécharge le PDF original archivé, directement depuis son portail. Il est
 * notifié dans sa cloche à chaque émission mensuelle de paie.
 *
 * Le Staff est résolu CÔTÉ SERVEUR par l'email de l'utilisateur connecté
 * (anti-usurpation — le même workspace sert tous les métiers).
 * ============================================================================
 */

import { MyPayslipsWorkspace } from "@/components/hr/MyPayslipsWorkspace";

export default function TeacherPaiePage() {
  return <MyPayslipsWorkspace />;
}
