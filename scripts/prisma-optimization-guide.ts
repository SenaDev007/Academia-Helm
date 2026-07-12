/**
 * ============================================================================
 * OPTIMISATIONS PRISMA — Réduire le transfert réseau de la BDD
 * ============================================================================
 *
 * Ce fichier documente les optimisations à appliquer pour réduire
 * la consommation de bande passante Neon.
 *
 * Règles d'or :
 * 1. Toujours utiliser select au lieu de include quand possible
 * 2. Paginer (limit 50 max, jamais 200)
 * 3. Ne jamais include des relations profondes sans besoin
 * 4. Mettre en cache les données peu changeantes
 * ============================================================================
 */

// ═══════════════════════════════════════════════════════════════════
// AVANT (consomme beaucoup de bande passante)
// ═══════════════════════════════════════════════════════════════════

// ❌ MAUVAIS : include trop large + limit 200
const mauvais = await prisma.student.findMany({
  take: 200,
  include: {
    studentEnrollments: {
      include: {
        class: true,
        academicClass: { include: { level: true, cycle: true, series: true } },
        academicYear: true,
      },
    },
    studentGuardians: { include: { guardian: true } },
    schoolLevel: true,
    academicYear: true,
    idCards: true,
  },
});
// → Retourne ~200 Ko par requête × 100 req/jour = 20 Mo/jour = 600 Mo/mois

// ═══════════════════════════════════════════════════════════════════
// APRÈS (optimisé)
// ═══════════════════════════════════════════════════════════════════

// ✅ BON : select ciblé + limit 50 + relations plates
const bon = await prisma.student.findMany({
  take: 50,
  select: {
    id: true,
    firstName: true,
    lastName: true,
    matricule: true,
    photoUrl: true,
    status: true,
    schoolLevelId: true,
    studentEnrollments: {
      where: { status: 'ACTIVE' },
      take: 1,
      select: {
        classId: true,
        academicClassId: true,
        status: true,
      },
    },
  },
});
// → Retourne ~5 Ko par requête × 100 req/jour = 500 Ko/jour = 15 Mo/mois
// → Économie : 585 Mo/mois !

// ═══════════════════════════════════════════════════════════════════
// RÈGLES PAR MODULE
// ═══════════════════════════════════════════════════════════════════

// Module Élèves (liste) — select ciblé
const listeEleves = {
  select: {
    id: true,
    firstName: true,
    lastName: true,
    matricule: true,
    photoUrl: true,
    status: true,
    schoolLevelId: true,
    gender: true,
    dateOfBirth: true,
    npi: true,
  },
  take: 50,
};

// Module Admissions — pas de include convertedStudent (déjà optimisé)
const listeAdmissions = {
  select: {
    id: true,
    firstName: true,
    lastName: true,
    status: true,
    admissionNumber: true,
    gender: true,
    dateOfBirth: true,
    schoolLevelId: true,
    requestedAcademicClassId: true,
    convertedStudentId: true,
  },
  take: 50,
};

// Module Cartes Scolaires — IDs uniquement
const listeCartes = {
  select: {
    id: true,
    cardNumber: true,
    studentId: true,
    isActive: true,
    isRevoked: true,
    generatedAt: true,
  },
  take: 50,
};

// Module Inscriptions — sans includes profonds
const listeInscriptions = {
  select: {
    id: true,
    studentId: true,
    classId: true,
    academicClassId: true,
    status: true,
    enrollmentType: true,
    enrollmentDate: true,
  },
  take: 50,
};

// ═══════════════════════════════════════════════════════════════════
// CACHE FRONTEND — données peu changeantes
// ═══════════════════════════════════════════════════════════════════

// Les données suivantes changent rarement et peuvent être mises en cache
// côté frontend avec SWR ou React Query :
//
// - /api/school-levels → cache 1 heure
// - /api/all-classes → cache 30 minutes
// - /api/academic-classes → cache 30 minutes
// - /api/academic-years → cache 1 heure
// - /api/settings/identity → cache 1 heure
//
// Économie estimée : ~200 Mo/mois de transfert réseau

export { listeEleves, listeAdmissions, listeCartes, listeInscriptions };
