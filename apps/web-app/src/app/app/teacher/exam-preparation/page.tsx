/**
 * ============================================================================
 * PRÉPARATION D'EXAMEN — Page enseignant (épreuves d'évaluation)
 * ============================================================================
 *
 * Module de la sidebar enseignante, positionné JUSTE EN DESSOUS de
 * « Travaux & Suivi » et AVANT « Examens & Notes » :
 *   - Signal quand une évaluation est programmée (matières à évaluer)
 *   - Préparation des épreuves par matière avec l'éditeur riche complet
 *     (tous les outils des fiches pédagogiques, y compris les lignes
 *     calligraphiques script/cursive pour le graphisme)
 *   - Sauvegarde automatique invisible + brouillon local anti-perte
 *   - Envoi du BLOC à la direction → validation → envoi au secrétariat
 *   - Catalogue hiérarchisé (classe → trimestre → mois)
 * ============================================================================
 */

'use client';

import { ExamPreparationWorkspace } from '@/components/pedagogy/exam-preparation/ExamPreparationWorkspace';

export default function ExamPreparationPage() {
  return <ExamPreparationWorkspace />;
}
