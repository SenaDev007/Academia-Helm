"use client";

/**
 * Parent Portal — Mes Enfants
 * Liste des enfants liés au parent + sélection pour voir les détails.
 */

import { useState, useEffect, useCallback } from "react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import {
  Users, Loader2, ChevronRight, GraduationCap, User,
  CreditCard, CalendarCheck, FileText,
} from "lucide-react";
import Link from "next/link";

export default function ParentChildrenPage() {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadChildren = useCallback(async () => {
    if (!academicYear?.id || !user?.id) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/parent/children?parentId=${user.id}&academicYearId=${academicYear.id}`,
        { credentials: "include" }
      );
      const data = await res.json();
      setChildren(Array.isArray(data) ? data : []);
    } catch {
      setChildren([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, academicYear?.id]);

  useEffect(() => { loadChildren(); }, [loadChildren]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 text-slate-300 mx-auto mb-3" />
        <p className="font-medium text-slate-700">Aucun enfant lié à votre compte</p>
        <p className="text-sm text-slate-500 mt-1">
          Contactez l'administration de l'école pour lier vos enfants à votre compte.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Users className="h-5 w-5 text-emerald-600" />
        <h2 className="text-lg font-bold text-slate-900">Mes Enfants</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {children.map((child) => (
          <Link
            key={child.id}
            href={`/app/parent/children/${child.id}`}
            className="bg-white rounded-xl border border-slate-200 p-5 hover:border-emerald-300 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${child.gender === 'FEMALE' ? 'bg-pink-100' : 'bg-blue-100'}`}>
                  <User className={`h-6 w-6 ${child.gender === 'FEMALE' ? 'text-pink-600' : 'text-blue-600'}`} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900">{child.firstName} {child.lastName}</h3>
                  <p className="text-xs text-slate-500">{child.matricule || "—"}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-slate-300" />
            </div>

            <div className="flex items-center gap-3 text-xs">
              {child.className && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 text-emerald-700 font-medium">
                  <GraduationCap className="h-3 w-3" />
                  {child.className}
                </span>
              )}
              {child.levelName && (
                <span className="text-slate-500">{child.levelName}</span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100">
              <Link href={`/app/parent/payments?studentId=${child.id}`} className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-blue-50">
                <CreditCard className="h-5 w-5 text-blue-600" />
                <span className="text-[10px] font-medium text-slate-600">Paiements</span>
              </Link>
              <Link href={`/app/parent/attendance?studentId=${child.id}`} className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-amber-50">
                <CalendarCheck className="h-5 w-5 text-amber-600" />
                <span className="text-[10px] font-medium text-slate-600">Présences</span>
              </Link>
              <Link href={`/app/parent/results?studentId=${child.id}`} className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-purple-50">
                <FileText className="h-5 w-5 text-purple-600" />
                <span className="text-[10px] font-medium text-slate-600">Bulletins</span>
              </Link>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
