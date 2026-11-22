"use client";

/**
 * ============================================================================
 * MA PAIE — Page self-service partagée par TOUT le personnel
 * ============================================================================
 *
 * ⭐ 22/11/2026 — Extension du self-service RH à la PAIE (retour promoteur) :
 * chaque membre du personnel consulte SES fiches de paie / états de paiement
 * émis (le RH les émet dans le module Personnel → Paie) et télécharge le PDF
 * original archivé. Il est notifié dans sa cloche à CHAQUE émission mensuelle
 * (InAppNotification PAYROLL_DOCUMENT_ISSUED → clic → cette page).
 *
 * Le Staff est résolu CÔTÉ SERVEUR par l'email de l'utilisateur connecté
 * (anti-usurpation) — la même page sert tous les métiers, rendue dans le
 * shell du portail de CHAQUE métier (voir admin-portal-map.ts :
 * /app/my-paie est listé dans les 6 portails administratifs).
 * ============================================================================
 */

import { MyPayslipsWorkspace } from "@/components/hr/MyPayslipsWorkspace";

export default function MyPaiePage() {
  return <MyPayslipsWorkspace />;
}
