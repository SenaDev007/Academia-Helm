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
    id: 'pedagogical-workspace',
    label: 'Espace pédagogique',
    path: '/app/pedagogy/workspace',
    icon: FileText,
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

