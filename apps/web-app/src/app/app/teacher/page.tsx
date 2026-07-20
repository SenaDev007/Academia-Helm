"use client";

/**
 * Portail Enseignant — Page d'accueil
 * Dashboard avec cours du jour, classes assignées et raccourcis
 */

import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import Link from "next/link";
import {
  BookOpen, Users, ClipboardList, FileText, Video, Library,
  MessageSquare, GraduationCap, Clock,
} from "lucide-react";

export default function TeacherDashboardPage() {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();

  const teacherName = user ? `${user.firstName} ${user.lastName}`.trim() : "Enseignant";

  const quickLinks = [
    { href: "/app/teacher/pedagogy", label: "Espace Pédagogique", icon: BookOpen, desc: "Cahier journal, fiches, registre d'appel, cahier de texte", color: "bg-blue-50 text-blue-700 border-blue-200" },
    { href: "/app/teacher/classes", label: "Mes Classes", icon: Users, desc: "Liste des élèves, suivi par classe", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { href: "/app/teacher/educast", label: "EduCast", icon: Video, desc: "Vidéos et contenus pédagogiques", color: "bg-purple-50 text-purple-700 border-purple-200" },
    { href: "/app/teacher/library", label: "Bibliothèque", icon: Library, desc: "Ressources et documents", color: "bg-amber-50 text-amber-700 border-amber-200" },
    { href: "/app/teacher/communication", label: "Communication", icon: MessageSquare, desc: "Messages et chats", color: "bg-pink-50 text-pink-700 border-pink-200" },
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
            <span className="text-xs font-semibold text-slate-500 uppercase">Classes</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">—</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardList className="h-5 w-5 text-emerald-600" />
            <span className="text-xs font-semibold text-slate-500 uppercase">Devoirs</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">—</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-5 w-5 text-purple-600" />
            <span className="text-xs font-semibold text-slate-500 uppercase">Fiches</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">—</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-5 w-5 text-amber-600" />
            <span className="text-xs font-semibold text-slate-500 uppercase">Cours du jour</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">—</p>
        </div>
      </div>

      {/* Raccourcis */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4">Mes modules</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-xl border p-5 hover:shadow-md transition-all ${link.color}`}
              >
                <Icon className="h-8 w-8 mb-3" />
                <h4 className="font-bold text-sm mb-1">{link.label}</h4>
                <p className="text-xs opacity-70">{link.desc}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
