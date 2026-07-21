"use client";

/**
 * Portail Enseignant — Dashboard
 * Vue d'ensemble avec cours du jour, classes assignées et raccourcis
 */

import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import Link from "next/link";
import {
  BookOpen, Users, CalendarDays, ClipboardList, Video,
  Library, MessageSquare, BarChart3, GraduationCap,
  Clock, FileText, CheckCircle2,
} from "lucide-react";

export default function TeacherDashboardPage() {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();

  const teacherName = user ? `${user.firstName} ${user.lastName}`.trim() : "Enseignant";

  const modules = [
    { href: "/app/teacher/pedagogy", label: "Espace Pédagogique", icon: BookOpen, desc: "Cahier journal, fiches pédagogiques, registre d'appel, cahier de texte, devoirs", color: "bg-blue-50 text-blue-700 border-blue-200" },
    { href: "/app/teacher/timetable", label: "Emploi du Temps", icon: CalendarDays, desc: "Consulter votre emploi du temps par classe et par jour", color: "bg-purple-50 text-purple-700 border-purple-200" },
    { href: "/app/teacher/classes", label: "Mes Classes", icon: Users, desc: "Liste des élèves, effectifs, suivi par classe", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { href: "/app/teacher/tasks", label: "Travaux & Suivi", icon: ClipboardList, desc: "Tâches assignées, suivi pédagogique, évaluations", color: "bg-amber-50 text-amber-700 border-amber-200" },
    { href: "/app/teacher/educast", label: "EduCast", icon: Video, desc: "Vidéos pédagogiques, podcasts, capsules de révision", color: "bg-pink-50 text-pink-700 border-pink-200" },
    { href: "/app/teacher/library", label: "Bibliothèque", icon: Library, desc: "Ressources, documents, catalogue", color: "bg-slate-50 text-slate-700 border-slate-200" },
    { href: "/app/teacher/orion", label: "ORION", icon: BarChart3, desc: "Alertes pédagogiques, élèves en difficulté, notes manquantes", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    { href: "/app/teacher/communication", label: "Communication", icon: MessageSquare, desc: "Messages, chats, annonces", color: "bg-teal-50 text-teal-700 border-teal-200" },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <GraduationCap className="h-8 w-8" />
          <h2 className="text-2xl font-bold">Bienvenue, {teacherName}</h2>
        </div>
        <p className="text-blue-100">
          Année académique {academicYear?.label || "—"} · Portail Enseignant
        </p>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-5 w-5 text-blue-600" />
            <span className="text-xs font-semibold text-slate-500 uppercase">Mes Classes</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">—</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-5 w-5 text-purple-600" />
            <span className="text-xs font-semibold text-slate-500 uppercase">Cours du jour</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">—</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-5 w-5 text-amber-600" />
            <span className="text-xs font-semibold text-slate-500 uppercase">Fiches à valider</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">—</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span className="text-xs font-semibold text-slate-500 uppercase">Tâches en cours</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">—</p>
        </div>
      </div>

      {/* Modules */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Mes modules</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link
                key={mod.href}
                href={mod.href}
                className={`rounded-xl border p-5 hover:shadow-md transition-all ${mod.color}`}
              >
                <Icon className="h-8 w-8 mb-3" />
                <h4 className="font-bold text-sm mb-1">{mod.label}</h4>
                <p className="text-xs opacity-70">{mod.desc}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
