/**
 * Loading page for /school-portal (tenant subdomains)
 *
 * ⭐ Task 25 : utilise le même AcademiaLoader que le site principal.
 * Avant, on utilisait TenantSchoolLoader (logo école + nom école) mais
 * l'utilisateur a demandé d'unifier avec le loading page Academia Helm
 * pour éviter la confusion de deux loading pages différents.
 */

import AcademiaLoader from "@/components/ui/AcademiaLoader";

export default function SchoolPortalLoading() {
  return <AcademiaLoader />;
}
