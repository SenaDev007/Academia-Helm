"use client";

/**
 * ============================================================================
 * TEACHER EDUCAST — Interface unifiée type YouTube (vue enseignant)
 * ============================================================================
 *
 * Affiche le module EduCast avec le contenu filtré pour l'enseignant courant.
 * L'enseignant voit son propre canal (ses vidéos, podcasts, etc.) dans
 * l'interface YouTube-like unifiée.
 * ============================================================================
 */

import EduCastModulePage from '@/components/pilotage/modules/EduCastModulePage';

export default function TeacherEduCastPage() {
  // ⭐ L'enseignant voit la même interface unifiée que la direction,
  //    mais sans le sélecteur d'enseignant (il voit son propre contenu).
  //    Le filtrage par teacherId est géré automatiquement par le backend
  //    en fonction du user connecté.
  return <EduCastModulePage />;
}
