import { Metadata } from 'next';
import TeacherTasksWorkspace from '@/components/pedagogy/tasks/TeacherTasksWorkspace';

export const metadata: Metadata = {
  title: 'Travaux & Suivi Pédagogique | Academia Helm',
  description: 'Gestion des devoirs, exercices et suivi des élèves par l\'enseignant',
};

export default function TeacherTasksPage() {
  return <TeacherTasksWorkspace />;
}
