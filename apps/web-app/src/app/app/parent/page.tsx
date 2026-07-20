"use client";

/**
 * Portail Parent — Page d'accueil
 * Dashboard avec enfants liés, situation financière et raccourcis
 */

import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import Link from "next/link";
import {
  Users, CreditCard, FileText, CalendarCheck, MessageSquare,
  Folder, Heart, GraduationCap,
} from "lucide-react";

export default function ParentDashboardPage() {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();

  const parentName = user ? `${user.firstName} ${user.lastName}`.trim() : "Parent";

  const quickLinks = [
    { href: "/app/parent/children", label: "Mes Enfants", icon: Users, desc: "Suivi scolaire de vos enfants", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    { href: "/app/parent/payments", label: "Paiements", icon: CreditCard, desc: "Solde, reçus, échéanciers", color: "bg-blue-50 text-blue-700 border-blue-200" },
    { href: "/app/parent/results", label: "Bulletins", icon: FileText, desc: "Résultats et appréciations", color: "bg-purple-50 text-purple-700 border-purple-200" },
    { href: "/app/parent/attendance", label: "Présences", icon: CalendarCheck, desc: "Absences et retards", color: "bg-amber-50 text-amber-700 border-amber-200" },
    { href: "/app/parent/messages", label: "Messages", icon: MessageSquare, desc: "Communication avec l'école", color: "bg-pink-50 text-pink-700 border-pink-200" },
    { href: "/app/parent/documents", label: "Documents", icon: Folder, desc: "Attestations et certificats", color: "bg-slate-50 text-slate-700 border-slate-200" },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 rounded-xl p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <Heart className="h-8 w-8" />
          <h2 className="text-2xl font-bold">Bienvenue, {parentName}</h2>
        </div>
        <p className="text-emerald-100">
          Année académique {academicYear?.label || "—"} · Portail Parent
        </p>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap className="h-5 w-5 text-emerald-600" />
            <span className="text-xs font-semibold text-slate-500 uppercase">Enfants</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">—</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CreditCard className="h-5 w-5 text-blue-600" />
            <span className="text-xs font-semibold text-slate-500 uppercase">Solde</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">—</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <FileText className="h-5 w-5 text-purple-600" />
            <span className="text-xs font-semibold text-slate-500 uppercase">Bulletins</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">—</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-1">
            <CalendarCheck className="h-5 w-5 text-amber-600" />
            <span className="text-xs font-semibold text-slate-500 uppercase">Présences</span>
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
