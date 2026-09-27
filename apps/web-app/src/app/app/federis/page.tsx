/**
 * ============================================================================
 * PATRONATS & EXAMENS FÉDÉRÉS — Page Établissement (portail école Helm)
 * ============================================================================
 *
 * Module des portails DIRECTEUR et SECRETAIRE (+ UI partagée direction) :
 * validation par l'école des demandes de rattachement émises par les patronats
 * scolaires (Academia Federis) — PENDING → JOINED / REJECTED / SUSPENDED.
 *
 * La page hérite du shell du portail selon le rôle (app/app/layout.tsx →
 * AdminPortalShell / PilotageLayout) — aucune duplication d'UI, même pattern
 * que /app/exam-reception.
 * ============================================================================
 */

'use client';

import { SchoolPatronatsPage } from '@/components/federis/SchoolPatronatsPage';

export default function FederisPatronatsRoutePage() {
  return <SchoolPatronatsPage />;
}
