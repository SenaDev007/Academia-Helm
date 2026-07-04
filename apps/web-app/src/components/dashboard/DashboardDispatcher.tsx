/**
 * ============================================================================
 * DASHBOARD DISPATCHER - DISPATCHER PAR RÔLE ET ACCRÉDITATION
 * ============================================================================
 * 
 * Composant qui dispatch le bon dashboard selon le rôle de l'utilisateur
 * et son portail d'accréditation.
 * 
 * Conforme au document academia-helm-portails.md :
 *   - PLATFORM_OWNER → PlatformOwnerDashboard
 *   - Rôles ÉCOLE (direction) → DirectorDashboard
 *   - Rôles ÉCOLE (finance) → AccountantDashboard
 *   - Rôles ENSEIGNANT → TeacherDashboard
 *   - Rôles PARENT/ÉLÈVE → ParentDashboard / StudentDashboard
 * 
 * ============================================================================
 */

'use client';

import { useTenantContext } from '@/contexts/TenantContext';
import { getPortalForRole } from '@/lib/auth/role-portal-map';
import { PlatformOwnerDashboard } from './roles/PlatformOwnerDashboard';
import { PromoterDashboard } from './roles/PromoterDashboard';
import { DirectorDashboard } from './roles/DirectorDashboard';
import { AccountantDashboard } from './roles/AccountantDashboard';
import { TeacherDashboard } from './roles/TeacherDashboard';
import { ParentDashboard } from './roles/ParentDashboard';
import { StudentDashboard } from './roles/StudentDashboard';

export function DashboardDispatcher() {
  const { context } = useTenantContext();

  if (!context) {
    return null;
  }

  const { role } = context;
  const portal = getPortalForRole(role);

  // ── Portail PLATEFORME ──
  if (portal === 'PLATFORM') {
    return <PlatformOwnerDashboard />;
  }

  // ── Portail ENSEIGNANT ──
  if (portal === 'TEACHER') {
    return <TeacherDashboard />;
  }

  // ── Portail PARENT / ÉLÈVE ──
  if (portal === 'PARENT') {
    if (role === 'STUDENT' || role === 'CLASS_DELEGATE') {
      return <StudentDashboard />;
    }
    return <ParentDashboard />;
  }

  // ── Portail ÉCOLE — dispatcher par fonction ──
  // Direction / Gouvernance
  const directionRoles = [
    'SCHOOL_OWNER', 'BOARD_PRESIDENT', 'DIRECTOR_GENERAL', 'SCHOOL_DIRECTOR',
    'DEPUTY_DIRECTOR', 'PROMOTEUR', 'SUPER_DIRECTOR', 'DIRECTEUR_GENERAL',
    'DIRECTEUR_ETABLISSEMENT', 'director',
  ];
  if (directionRoles.includes(role)) {
    if (role === 'PROMOTEUR') return <PromoterDashboard />;
    return <DirectorDashboard />;
  }

  // Finance / Comptabilité
  const financeRoles = [
    'CFO', 'FINANCE_MANAGER', 'ACCOUNTANT', 'CASHIER', 'RECOVERY_MANAGER',
    'COMPTABLE', 'CAISSIER', 'ECONOME', 'accountant',
  ];
  if (financeRoles.includes(role)) {
    return <AccountantDashboard />;
  }

  // Administration / Scolarité
  const adminRoles = [
    'SCHOOL_ADMIN', 'RESP_SCOLARITE', 'SECRETARY', 'SCOLARITE',
    'admin', 'ADMIN_AGENT', 'DATA_MANAGER',
  ];
  if (adminRoles.includes(role)) {
    return <AccountantDashboard />;
  }

  // Pédagogie
  const pedagogyRoles = [
    'PEDAGOGIC_DIRECTOR', 'CENSOR', 'RESP_SECONDAIRE', 'RESP_PRIMAIRE',
    'RESP_MATERNELLE', 'PEDAGOGIC_COORDINATOR', 'CENSEUR',
    'EXAM_MANAGER', 'ORIENTATION_MANAGER',
  ];
  if (pedagogyRoles.includes(role)) {
    return <DirectorDashboard />;
  }

  // RH / Personnel
  const hrRoles = [
    'HR_MANAGER', 'PAYROLL_MANAGER', 'IT_MANAGER',
    'SCHOOL_LIFE_MANAGER', 'GENERAL_MONITOR', 'SURVEILLANT_GENERAL',
  ];
  if (hrRoles.includes(role)) {
    return <AccountantDashboard />;
  }

  // Default pour les rôles école non spécifiquement mappés
  return <DirectorDashboard />;
}
