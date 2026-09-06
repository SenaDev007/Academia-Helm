"use client";

/**
 * Portail Enseignant — Dashboard
 * Vue d'ensemble avec classes assignées, cours du jour et raccourcis.
 * Données réelles chargées depuis /api/pedagogy-space/my-classes
 */

import { useState, useEffect, useCallback } from "react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import { useSchoolIdentity } from "@/hooks/useSchoolIdentity";
import Link from "next/link";
import {
  BookOpen, Users, CalendarDays, ClipboardList, Video,
  Library, MessageSquare, BarChart3, GraduationCap,
  Clock, FileText, CheckCircle2, Building2, Loader2, FileEdit,
  AlertCircle, CalendarRange,
} from "lucide-react";
import { MyAttendanceCard } from "@/components/hr/MyAttendanceCard";
import { SemainierNotificationBanner } from "@/components/pedagogy/production/SemainierNotificationBanner";
// ⭐ P4-final : dashboard bilingue — piste EN → interface 100% anglaise
import { useL } from "@/lib/i18n/bilingual";

export default function TeacherDashboardPage() {
  const { user, tenant } = useAppSession();
  const { academicYear } = useModuleContext();
  const { identity: school } = useSchoolIdentity();
  const L = useL();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ⭐ Profil Teacher pédagogique en priorité (double-casquette : rôle DB
  //    administratif mais profil Teacher actif) ; fallback user.id — le
  //    backend résout User→Teacher par email si teacherId absent.
  const teacherId = user?.teacherId || user?.id || "";

  const loadClasses = useCallback(async () => {
    if (!academicYear?.id || !teacherId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/pedagogy-space/my-classes?teacherId=${teacherId}&academicYearId=${academicYear.id}`,
        { credentials: "include" }
      );
      const data = await res.json();
      setClasses(Array.isArray(data) ? data : []);
    } catch {
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }, [teacherId, academicYear?.id]);

  useEffect(() => {
    loadClasses();
  }, [loadClasses]);

  const teacherName = user ? `${user.firstName} ${user.lastName}`.trim() : "Enseignant";
  const totalStudents = classes.reduce((sum, c) => sum + (c.totalStudents || 0), 0);
  const totalBoys = classes.reduce((sum, c) => sum + (c.boys || 0), 0);
  const totalGirls = classes.reduce((sum, c) => sum + (c.girls || 0), 0);

  // ⭐ Libellés bilingues — modules du dashboard enseignant
  const modules = [
    { href: "/app/teacher/timetable", label: L("Emploi du Temps", "Timetable"), icon: CalendarDays, desc: L("Consulter votre emploi du temps", "View your timetable"), color: "bg-purple-50 text-purple-700 border-purple-200" },
    { href: "/app/teacher/annual-planning", label: L("Planification annuelle", "Annual Planning"), icon: ClipboardList, desc: L("Planification pédagogique officielle de chaque niveau (CI à CM2 + Maternelle)", "Official pedagogical planning for each level (CI to CM2 + Maternelle)"), color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
    { href: "/app/teacher/pedagogy", label: L("Espace Pédagogique", "Pedagogy Space"), icon: BookOpen, desc: L("Cahier journal, fiches pédagogiques, registre d'appel, cahier de texte, devoirs", "Daily log, lesson sheets, attendance register, textbook, homework"), color: "bg-blue-50 text-blue-700 border-blue-200" },
    { href: "/app/teacher/tasks", label: L("Travaux & Suivi", "Tasks & Tracking"), icon: ClipboardList, desc: L("Tâches assignées, suivi pédagogique", "Assigned tasks, pedagogical follow-up"), color: "bg-amber-50 text-amber-700 border-amber-200" },
    { href: "/app/teacher/exams", label: L("Examens & Notes", "Exams & Grades"), icon: FileEdit, desc: L("Mes évaluations, saisie des notes, bulletins", "My assessments, grade entry, report cards"), color: "bg-rose-50 text-rose-700 border-rose-200" },
    { href: "/app/teacher/educast", label: "EduCast", icon: Video, desc: L("Vidéos pédagogiques, podcasts", "Educational videos, podcasts"), color: "bg-pink-50 text-pink-700 border-pink-200" },
    { href: "/app/teacher/library", label: L("Bibliothèque", "Library"), icon: Library, desc: L("Ressources pédagogiques", "Teaching resources"), color: "bg-slate-50 text-slate-700 border-slate-200" },
    { href: "/app/teacher/orion", label: "ORION", icon: BarChart3, desc: L("Alertes pédagogiques", "Pedagogical alerts"), color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    { href: "/app/teacher/communication", label: "Helm Connect", icon: MessageSquare, desc: L("Communiquez. Collaborez. Restez connectés.", "Communicate. Collaborate. Stay connected."), color: "bg-teal-50 text-teal-700 border-teal-200" },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome — photo de l'enseignant (ou initiales) au lieu du logo école */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          {/* ⭐ Avatar enseignant : photo ou initiales (comme module RH) */}
          {user?.photoUrl ? (
            <img
              src={user.photoUrl}
              alt={teacherName}
              className="h-12 w-12 rounded-full object-cover border-2 border-white/30"
            />
          ) : (
            <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center text-white text-lg font-bold border-2 border-white/30">
              {(user?.firstName?.[0] || '')}{(user?.lastName?.[0] || '')}
            </div>
          )}
          <div>
            <h2 className="text-2xl font-bold">{L("Bienvenue", "Welcome")}, {teacherName}</h2>
            <p className="text-blue-100 text-sm">
              {school?.schoolName || tenant?.name || L("École", "School")} · {academicYear?.label || ""}
            </p>
          </div>
        </div>
      </div>

      {/* ⭐ Bannière de notification "Vous êtes le semainier cette semaine / la semaine prochaine"
          S'affiche automatiquement quand l'enseignant a été désigné comme semainier.
          Apparaît dès le week-end (samedi/dimanche) AVANT la semaine concernée,
          et reste visible pendant toute la semaine. */}
      <SemainierNotificationBanner
        teacherId={teacherId}
        academicYearId={academicYear?.id || ""}
      />

      {/* Stats rapides — données réelles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-5 w-5 text-blue-600" />
            <span className="text-xs font-semibold text-slate-500 uppercase">{L("Mes Classes", "My Classes")}</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{loading ? "…" : classes.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-5 w-5 text-cyan-600" />
            <span className="text-xs font-semibold text-slate-500 uppercase">{L("Garçons", "Boys")}</span>
          </div>
          <p className="text-2xl font-bold text-cyan-600">{loading ? "…" : totalBoys}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-5 w-5 text-pink-600" />
            <span className="text-xs font-semibold text-slate-500 uppercase">{L("Filles", "Girls")}</span>
          </div>
          <p className="text-2xl font-bold text-pink-600">{loading ? "…" : totalGirls}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-5 w-5 text-emerald-600" />
            <span className="text-xs font-semibold text-slate-500 uppercase">{L("Total élèves", "Total students")}</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{loading ? "…" : totalStudents}</p>
        </div>
      </div>

      {/* ⭐ Carte présence du jour — auto-pointage géolocalisé */}
      <MyAttendanceCard />

      {/* Liste des classes */}
      {!loading && classes.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-slate-700 uppercase mb-3">{L("Mes classes assignées", "My assigned classes")}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {classes.map((cls) => (
              <Link
                key={cls.classId}
                href="/app/teacher/pedagogy"
                className="bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-300 hover:shadow-md transition-all"
              >
                <h4 className="font-bold text-slate-900 text-sm">{cls.className}</h4>
                <p className="text-xs text-slate-500 mb-2">{cls.schoolLevelName}</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="font-semibold text-slate-700">{cls.totalStudents} {L("élèves", "students")}</span>
                  <span className="text-cyan-600">{L(cls.boys + "G", cls.boys + "B")}</span>
                  <span className="text-pink-600">{L(cls.girls + "F", cls.girls + "G")}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Modules */}
      <div>
        <h3 className="text-lg font-bold text-slate-900 mb-4">{L("Mes modules", "My modules")}</h3>
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
