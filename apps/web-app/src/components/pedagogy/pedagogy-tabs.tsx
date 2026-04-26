'use client';

import {
  LayoutDashboard,
  Layers,
  BookOpen,
  Users,
  ClipboardList,
  Calendar,
  FileText,
  ShieldCheck,
  BarChart3,
  Package,
  Book,
  CalendarDays,
  NotebookPen,
} from 'lucide-react';

export const PEDAGOGY_SUBMODULE_TABS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/app/pedagogy',
    icon: LayoutDashboard,
  },
  {
    id: 'academic-structure',
    label: 'Structure académique',
    path: '/app/pedagogy/academic-structure',
    icon: Layers,
  },
  {
    id: 'subjects',
    label: 'Matières & programmes',
    path: '/app/pedagogy/subjects',
    icon: BookOpen,
  },
  {
    id: 'teachers-academic',
    label: 'Enseignants académiques',
    path: '/app/pedagogy/teachers',
    icon: Users,
  },
  {
    id: 'assignments',
    label: 'Affectations & charges',
    path: '/app/pedagogy/assignments',
    icon: ClipboardList,
  },
  {
    id: 'timetables',
    label: 'Emploi du temps',
    path: '/app/pedagogy/timetables',
    icon: Calendar,
  },
  {
    id: 'lesson-plans',
    label: 'Fiches pédagogiques',
    path: '/app/pedagogy/lesson-plans',
    icon: FileText,
  },
  {
    id: 'daily-logs',
    label: 'Cahier journal',
    path: '/app/pedagogy/daily-logs',
    icon: NotebookPen,
  },
  {
    id: 'class-diaries',
    label: 'Cahier de texte',
    path: '/app/pedagogy/class-diaries',
    icon: Book,
  },
  {
    id: 'semainier',
    label: 'Semainier',
    path: '/app/pedagogy/semainier',
    icon: CalendarDays,
  },
  {
    id: 'materials',
    label: 'Matériel pédagogique',
    path: '/app/pedagogy/pedagogical-materials',
    icon: Package,
  },
  {
    id: 'control',
    label: 'Contrôle direction',
    path: '/app/pedagogy/control',
    icon: ShieldCheck,
  },
  {
    id: 'orion-pedagogy',
    label: 'Analytique ORION',
    path: '/app/pedagogy/orion',
    icon: BarChart3,
  },
] as const;

