"use client";

/**
 * Teacher Tasks — Travaux & Suivi
 * Page route pour la sidebar enseignant (déplacé depuis Espace Pédagogique).
 * Utilise le composant TeacherTasksWorkspace refondu (6 fichiers, CRUD complet).
 */

import TeacherTasksWorkspace from "@/components/pedagogy/tasks/TeacherTasksWorkspace";

export default function TeacherTasksPage() {
  return <TeacherTasksWorkspace />;
}
