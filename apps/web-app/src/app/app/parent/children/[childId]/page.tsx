"use client";

/**
 * ============================================================================
 * PORTAIL PARENT — Détail enfant [/app/parent/children/[childId]]
 * ============================================================================
 *
 * Vue détaillée d'un enfant avec 4 onglets :
 *   1. Suivi journalier  — présence du jour, cours (cahier journal), devoirs
 *   2. Scolarité         — solde, historique paiements, bouton "Payer"
 *   3. Notes             — bulletins validés + téléchargement PDF
 *   4. Assiduité         — historique mensuel des présences
 *
 * Données chargées depuis /api/parent/* (cf. parent-portal.controller).
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import { useSchoolIdentity } from "@/hooks/useSchoolIdentity";
// ⭐ 2026-11-24 — Libellé enrichi du type d'évaluation (nom complet + mois
//    de la date programmée : « Évaluation mensuelle 1 – mois d'octobre 2026 »).
import { enrichedEvalLabel } from "@/lib/evaluation-labels";
import {
  ArrowLeft, Loader2, CalendarCheck, Wallet, FileText, BookOpen,
  CheckCircle2, XCircle, Clock, Download, CreditCard, GraduationCap,
  Phone, Mail, RefreshCw,
  ChevronDown, ChevronRight, Calendar, Award,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  exportBulletinToPdf,
  type SchoolHeader,
} from "@/lib/exports/parent-exports";
import { openFedaPayCheckout } from "@/lib/parent/fedapay-checkout";
import { financeService } from "@/services/finance.service";
import ParentFinancePanel from "@/components/parent/ParentFinancePanel";
import StudentAvatar from "@/components/parent/StudentAvatar";
import { ParentPaymentHistory } from "@/components/parent/ParentPaymentHistory";
import { PaymentSuccessBanner } from "@/components/parent/PaymentSuccessBanner";

type Tab = "today" | "attendance" | "payments" | "results";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  PRESENT: { label: "Présent", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  ABSENT: { label: "Absent", color: "bg-red-100 text-red-700", icon: XCircle },
  ABSENT_HALF: { label: "Demi-journée", color: "bg-amber-100 text-amber-700", icon: Clock },
  LATE: { label: "En retard", color: "bg-amber-100 text-amber-700", icon: Clock },
};

/**
 * Parse attendance notes to extract morning/afternoon/late info.
 * Notes can be a JSON string like {"morning":"PRESENT","afternoon":"ABSENT","late":false}
 * or a plain text string.
 */
function parseAttendanceNotes(notes: any): { morning?: string; afternoon?: string; late?: boolean; raw?: string } {
  if (!notes) return {};
  if (typeof notes === 'object') return notes;
  if (typeof notes === 'string') {
    try {
      const parsed = JSON.parse(notes);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      return { raw: notes };
    }
  }
  return { raw: String(notes) };
}

/**
 * Generate a human-readable status label from the attendance record.
 * Handles half-day absences (morning absent, afternoon present, etc.)
 */
function getAttendanceDisplay(record: { status: string; notes?: any }): { label: string; color: string; icon: any; detail: string } {
  const cfg = STATUS_CONFIG[record.status] || STATUS_CONFIG.PRESENT;
  const parsed = parseAttendanceNotes(record.notes);

  // If notes has morning/afternoon info, build a detailed label
  if (parsed.morning && parsed.afternoon) {
    const morningLabel = parsed.morning === 'PRESENT' ? 'Présent' : parsed.morning === 'ABSENT' ? 'Absent' : parsed.morning === 'LATE' ? 'En retard' : parsed.morning;
    const afternoonLabel = parsed.afternoon === 'PRESENT' ? 'Présent' : parsed.afternoon === 'ABSENT' ? 'Absent' : parsed.afternoon === 'LATE' ? 'En retard' : parsed.afternoon;

    if (parsed.morning === parsed.afternoon) {
      // Both same — single status
      return {
        label: morningLabel,
        color: cfg.color,
        icon: cfg.icon,
        detail: '',
      };
    }

    // Different morning/afternoon — show "Demi-journée"
    return {
      label: 'Demi-journée',
      color: 'bg-amber-100 text-amber-700',
      icon: Clock,
      detail: `Matin: ${morningLabel} · Après-midi: ${afternoonLabel}`,
    };
  }

  // No detailed notes — use status only
  return {
    label: cfg.label,
    color: cfg.color,
    icon: cfg.icon,
    detail: parsed.raw || '',
  };
}

export default function ParentChildDetailPage() {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();
  const { identity: school } = useSchoolIdentity();
  const params = useParams();
  const childId = params.childId as string;

  const [child, setChild] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("today");
  const [todayData, setTodayData] = useState<any>(null);
  const [resultsData, setResultsData] = useState<any[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [loadingTab, setLoadingTab] = useState(false);

  // ── Charger le détail de l'enfant ──
  useEffect(() => {
    if (!academicYear?.id || !childId) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/parent/children/${childId}?parentId=${user?.id}&academicYearId=${academicYear.id}`,
          { credentials: "include" }
        );
        if (!res.ok) throw new Error("Erreur");
        const data = await res.json();
        setChild(data);
      } catch {
        setChild(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [childId, user?.id, academicYear?.id]);

  // ── Charger les données de l'onglet actif ──
  const loadTabData = useCallback(async (tab: Tab) => {
    if (!childId || !academicYear?.id) return;
    setLoadingTab(true);
    try {
      if (tab === "today") {
        const res = await fetch(`/api/parent/today/${childId}?academicYearId=${academicYear.id}`, { credentials: "include" });
        const data = await res.json();
        setTodayData(data);
      } else if (tab === "payments") {
        // ⚠️ Le PaymentsTab gère son propre chargement via financeService.getStudentAccountDetails
        // (même endpoint que admin — pas d'appel à /api/parent/payments ici)
        return; // no-op
      } else if (tab === "results") {
        const res = await fetch(`/api/parent/results/${childId}?academicYearId=${academicYear.id}`, { credentials: "include" });
        const data = await res.json();
        setResultsData(Array.isArray(data) ? data : []);
      } else if (tab === "attendance") {
        const res = await fetch(`/api/parent/attendance/${childId}`, { credentials: "include" });
        const data = await res.json();
        setAttendanceData(Array.isArray(data) ? data : []);
      }
    } catch {
      // silent
    } finally {
      setLoadingTab(false);
    }
  }, [childId, academicYear?.id]);

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, loadTabData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!child) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-700">Enfant non trouvé.</p>
        <Link href="/app/parent/children" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
          ← Retour à la liste
        </Link>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: any; color: string }[] = [
    { id: "today", label: "Suivi journalier", icon: CalendarCheck, color: "blue" },
    { id: "attendance", label: "Assiduité", icon: CalendarCheck, color: "amber" },
    { id: "payments", label: "Scolarité", icon: Wallet, color: "emerald" },
    { id: "results", label: "Notes & Bulletins", icon: FileText, color: "purple" },
  ];

  return (
    <div className="space-y-4">
      {/* Retour + En-tête enfant */}
      <Link href="/app/parent/children" className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" />
        Mes enfants
      </Link>

      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-5 text-white shadow-md">
        <div className="flex items-center gap-4">
          <StudentAvatar
            firstName={child.firstName}
            lastName={child.lastName}
            photoUrl={child.photoUrl}
            size="lg"
            variant="blue"
          />
          <div className="flex-1">
            <h1 className="text-xl font-bold">{child.firstName} {child.lastName}</h1>
            <p className="text-sm text-blue-100">
              {child.className || "—"} · {child.levelName || child.levelCode || "—"}
            </p>
            <p className="text-xs text-blue-200 mt-0.5">
              Matricule : {child.matricule || "—"} · {child.gender === "MALE" ? "Garçon" : "Fille"}
            </p>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all whitespace-nowrap",
                isActive
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Contenu onglet */}
      {loadingTab ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : (
        <>
          {activeTab === "today" && <TodayTab child={child} todayData={todayData} />}
          {activeTab === "payments" && (
            <ParentFinancePanel
              studentId={child.id}
              studentFirstName={child.firstName}
              studentLastName={child.lastName}
              studentMatricule={child.matricule}
            />
          )}
          {activeTab === "results" && (
            <ResultsTab
              child={child}
              resultsData={resultsData}
              schoolHeader={{
                schoolName: school?.schoolName || "École",
                schoolLogoUrl: school?.logoUrl,
                schoolAddress: school?.address,
                schoolPhone: school?.phone,
                schoolEmail: school?.email,
                schoolSlogan: school?.slogan,
              }}
            />
          )}
          {activeTab === "attendance" && <AttendanceTab child={child} attendanceData={attendanceData} />}
        </>
      )}
    </div>
  );
}

// ============================================================================
// ONGLET 1 : Suivi journalier
// ============================================================================

function TodayTab({ child, todayData }: { child: any; todayData: any }) {
  if (!todayData) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <CalendarCheck className="h-10 w-10 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Données du jour non disponibles.</p>
      </div>
    );
  }

  // Détail des cours du jour (cahier journal entries)
  const todayEntries = todayData.cahierJournal?.todayEntries || {};
  const subjects = Object.entries(todayEntries);
  // entries[todayKey] peut être un objet { subjectId: { ... }, ... } ou un array
  const subjectList: any[] = [];
  for (const [key, val] of subjects) {
    if (Array.isArray(val)) {
      val.forEach((v) => subjectList.push({ ...v, _key: key }));
    } else if (typeof val === "object" && val !== null) {
      // Plusieurs matières : val est un dict { subjectId: { ... } }
      for (const [subKey, subVal] of Object.entries(val as object)) {
        subjectList.push({ ...(subVal as object), _key: `${key}.${subKey}` });
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Présence */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-bold text-slate-700 uppercase mb-3 flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-blue-600" />
          Présence du {format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}
        </h3>
        {todayData.attendance ? (
          (() => {
            const display = getAttendanceDisplay(todayData.attendance);
            const Icon = display.icon;
            return (
              <div className="space-y-2">
                <div className={cn("inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold", display.color)}>
                  <Icon className="h-5 w-5" />
                  {display.label}
                </div>
                {display.detail && (
                  <p className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
                    {display.detail}
                  </p>
                )}
              </div>
            );
          })()
        ) : (
          <p className="text-sm text-slate-400">Présence non relevée pour aujourd'hui.</p>
        )}
      </div>

      {/* Cours du jour (cahier journal détaillé) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-700 uppercase flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-600" />
            Cours du jour
          </h3>
          {todayData.cahierJournal?.status === "VALIDATED" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> Validé
            </span>
          )}
        </div>
        {subjectList.length > 0 ? (
          <div className="space-y-2">
            {subjectList.map((s, i) => (
              <div key={s._key || i} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold text-sm text-slate-900">
                    {s.subjectName || s.label || s.matiere || "Matière"}
                  </div>
                  {s.durationHours && (
                    <span className="text-xs text-slate-500">
                      Durée : {s.durationHours}h
                    </span>
                  )}
                </div>
                {s.topic && (
                  <div className="text-xs text-slate-700 mt-1">
                    <span className="font-medium">Thème :</span> {s.topic}
                  </div>
                )}
                {s.content && (
                  <div className="text-xs text-slate-600 mt-0.5">
                    <span className="font-medium">Contenu :</span> {s.content}
                  </div>
                )}
                {s.homework && (
                  <div className="text-xs text-amber-700 mt-0.5 bg-amber-50 p-2 rounded mt-1">
                    <span className="font-medium">Devoir :</span> {s.homework}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            Aucun cours programmé pour aujourd'hui, ou cahier journal non encore rempli par l'enseignant.
          </p>
        )}
      </div>

      {/* Devoirs */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-sm font-bold text-slate-700 uppercase mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-amber-600" />
          Devoirs en cours
        </h3>
        {todayData.homeworks && todayData.homeworks.length > 0 ? (
          <div className="space-y-2">
            {todayData.homeworks.map((hw: any) => (
              <div key={hw.id} className="p-3 rounded-lg border border-slate-200 flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="font-semibold text-sm text-slate-900">{hw.title}</div>
                  {hw.subjectName && (
                    <div className="text-xs text-blue-600 font-semibold">{hw.subjectName}</div>
                  )}
                  {hw.description && (
                    <div className="text-xs text-slate-500 mt-1" dangerouslySetInnerHTML={{ __html: hw.description.substring(0, 200) }} />
                  )}
                  {hw.dueDate && (
                    <div className="text-xs text-amber-600 mt-1">
                      À rendre : {format(new Date(hw.dueDate), "d MMM yyyy", { locale: fr })}
                    </div>
                  )}
                </div>
                {hw.taskStatus && (
                  <div className={cn(
                    "px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap",
                    hw.taskStatus.status === "DONE" && "bg-emerald-100 text-emerald-700",
                    hw.taskStatus.status === "PENDING" && "bg-amber-100 text-amber-700",
                    hw.taskStatus.status === "NOT_DONE" && "bg-red-100 text-red-700",
                    hw.taskStatus.status === "LATE" && "bg-red-100 text-red-700",
                  )}>
                    {hw.taskStatus.status === "DONE" ? "✓ Fait" :
                     hw.taskStatus.status === "PENDING" ? "⏳ En attente" :
                     hw.taskStatus.status === "NOT_DONE" ? "✗ Non fait" :
                     hw.taskStatus.status === "LATE" ? "⚠ En retard" :
                     hw.taskStatus.status}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-400">Aucun devoir en cours.</p>
        )}
      </div>

      {/* Enseignant titulaire */}
      {child.teacher && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="text-sm font-bold text-slate-700 uppercase mb-3 flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-purple-600" />
            Enseignant titulaire
          </h3>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <div className="font-semibold text-slate-900">{child.teacher.name}</div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                {child.teacher.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {child.teacher.email}
                  </span>
                )}
                {child.teacher.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {child.teacher.phone}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ONGLET 2 : Scolarité & Paiements
// ============================================================================
// ⚠️ Aligné sur le module Finance admin (onglet Encaissements) :
//   - Solde + historique : financeService.getStudentAccountDetails(studentAccountId)
//   - Reçu PDF : GET /api/finance/transactions/:id/receipt.pdf (Puppeteer backend)
//   - Paiement FedaPay : openFedaPayCheckout() → POST /api/finance/transactions
//   - Bandeau succès : <PaymentSuccessBanner /> (composant partagé)
//   - Historique : <ParentPaymentHistory /> (composant partagé, 7 colonnes + 5 actions)
// ============================================================================

function PaymentsTab({ child }: { child: any }) {
  const { academicYear } = useModuleContext();
  const [account, setAccount] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<{
    transactionId: string;
    receiptNumber?: string;
    createdAt?: string;
  } | null>(null);

  const studentAccountId = child?.account?.id;

  // Charger le compte élève + transactions (même endpoint que admin)
  const loadAccount = useCallback(async () => {
    if (!studentAccountId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // ⭐ Même appel que StudentAccountsContent.tsx (admin)
      const acc = await financeService.getStudentAccountDetails(studentAccountId);
      setAccount(acc);
    } catch (err: any) {
      console.error("loadAccount error:", err);
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, [studentAccountId]);

  useEffect(() => {
    if (studentAccountId) loadAccount();
  }, [loadAccount, studentAccountId]);

  const formatXOF = (amount: number | string) => {
    const num = typeof amount === "string" ? parseFloat(amount) : amount;
    if (isNaN(num)) return "0 FCFA";
    return new Intl.NumberFormat("fr-FR").format(num) + " FCFA";
  };

  // ── Lancer le paiement FedaPay (même flux que admin) ──
  const handlePayNow = async () => {
    if (!studentAccountId) {
      toast.error("Compte élève introuvable", {
        description: "Impossible de déterminer le compte à débiter. Contactez l'administration.",
      });
      return;
    }
    if (!academicYear?.id) {
      toast.error("Année scolaire introuvable");
      return;
    }
    const balance = Number(account?.balance ?? 0);
    if (balance <= 0) {
      toast.info("Scolarité déjà à jour");
      return;
    }

    setPaying(true);
    try {
      const result = await openFedaPayCheckout({
        amount: balance,
        studentAccountId,
        academicYearId: academicYear.id,
        studentFirstName: child.firstName,
        studentLastName: child.lastName,
        studentMatricule: child.matricule,
      });

      if (result.success) {
        // ⭐ Bandeau de succès (même que admin)
        setLastReceipt({
          transactionId: result.transactionId || "",
          receiptNumber: result.receiptNumber,
          createdAt: new Date().toISOString(),
        });
        toast.success("Paiement confirmé", {
          description: `Reçu ${result.receiptNumber} généré. Référence : ${result.reference}.`,
        });
        // Recharger le compte pour afficher le nouveau solde + la transaction
        loadAccount();
      } else if (result.error) {
        if (result.error.includes("annulé")) {
          toast.info("Paiement annulé");
        } else {
          toast.error("Échec du paiement", { description: result.error });
        }
      }
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <Wallet className="h-10 w-10 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Aucune donnée financière disponible.</p>
      </div>
    );
  }

  const totalDue = Number(account.totalDue ?? 0);
  const totalPaid = Number(account.totalPaid ?? 0);
  const balance = Number(account.balance ?? 0);
  const transactions = account.transactions || [];

  return (
    <div className="space-y-4">
      {/* Bandeau succès post-paiement (même que admin) */}
      {lastReceipt && (
        <PaymentSuccessBanner
          transactionId={lastReceipt.transactionId}
          receiptNumber={lastReceipt.receiptNumber}
          createdAt={lastReceipt.createdAt}
          onClose={() => setLastReceipt(null)}
        />
      )}

      {/* Cards solde */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="h-5 w-5 text-blue-600" />
            <span className="text-xs font-semibold text-slate-500 uppercase">Total dû</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{formatXOF(totalDue)}</p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700 uppercase">Payé</span>
          </div>
          <p className="text-2xl font-bold text-emerald-700">{formatXOF(totalPaid)}</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-red-600" />
            <span className="text-xs font-semibold text-red-700 uppercase">Restant</span>
          </div>
          <p className="text-2xl font-bold text-red-700">{formatXOF(balance)}</p>
        </div>
      </div>

      {/* Bouton payer (même flux FedaPay que admin) */}
      {balance > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-blue-900">Payer les frais de scolarité</p>
            <p className="text-sm text-blue-700">Restant : {formatXOF(balance)}</p>
            <p className="text-xs text-blue-500 mt-0.5">
              Paiement sécurisé via FedaPay (Mobile Money / Carte bancaire)
            </p>
          </div>
          <button
            onClick={handlePayNow}
            disabled={paying}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {paying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Paiement en cours...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4" />
                Payer maintenant
              </>
            )}
          </button>
        </div>
      )}

      {/* Historique — COMPOSANT PARTAGÉ (même table que admin) */}
      <div>
        <h3 className="text-sm font-bold text-slate-700 uppercase mb-3">
          Historique des paiements
        </h3>
        <ParentPaymentHistory transactions={transactions} />
      </div>
    </div>
  );
}

// ============================================================================
// ONGLET 3 : Notes & Bulletins (avec sous-onglets Notes / Bulletins)
// ============================================================================

function ResultsTab({
  child,
  resultsData,
  schoolHeader,
}: {
  child: any;
  resultsData: any[];
  schoolHeader: SchoolHeader;
}) {
  const [subTab, setSubTab] = useState<"notes" | "bulletins">("notes");
  const [grades, setGrades] = useState<any[]>([]);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const { academicYear } = useModuleContext();

  // Load grades for "notes" sub-tab
  useEffect(() => {
    if (subTab !== "notes" || !child?.id || !academicYear?.id) return;
    setLoadingGrades(true);
    fetch(`/api/parent/grades/${child.id}?academicYearId=${academicYear.id}`, { credentials: "include" })
      .then(r => r.json())
      .then(data => setGrades(Array.isArray(data) ? data : []))
      .catch(() => setGrades([]))
      .finally(() => setLoadingGrades(false));
  }, [subTab, child?.id, academicYear?.id]);

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setSubTab("notes")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            subTab === "notes"
              ? "border-purple-600 text-purple-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Notes et Résultats
        </button>
        <button
          onClick={() => setSubTab("bulletins")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
            subTab === "bulletins"
              ? "border-purple-600 text-purple-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          <FileText className="w-4 h-4" />
          Bulletins
        </button>
      </div>

      {/* Notes sub-tab */}
      {subTab === "notes" && (
        <NotesSubTab grades={grades} loading={loadingGrades} child={child} />
      )}

      {/* Bulletins sub-tab */}
      {subTab === "bulletins" && (
        <BulletinsSubTab
          resultsData={resultsData}
          child={child}
          schoolHeader={schoolHeader}
          downloadingId={downloadingId}
          setDownloadingId={setDownloadingId}
        />
      )}
    </div>
  );
}

// ─── Notes Sub-Tab ──────────────────────────────────────────────────────────

function NotesSubTab({ grades, loading, child }: { grades: any[]; loading: boolean; child: any }) {
  const [expandedQuarters, setExpandedQuarters] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (grades.length > 0) {
      setExpandedQuarters(new Set([grades[0].quarterId]));
    }
  }, [grades]);

  const toggleQuarter = (qid: string) => {
    setExpandedQuarters(prev => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        <span className="ml-3 text-sm text-slate-500">Chargement des notes…</span>
      </div>
    );
  }

  if (grades.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Aucune note disponible pour cette période.</p>
        <p className="text-xs text-slate-400 mt-1">
          Les notes apparaîtront ici dès que l'enseignant aura saisi et validé les évaluations.
        </p>
      </div>
    );
  }

  const isMaternelle = child?.schoolLevelCode === "MATERNELLE" || child?.levelName?.toUpperCase().includes("MATERNELLE");

  return (
    <div className="space-y-3">
      {grades.map((quarter) => {
        const isExpanded = expandedQuarters.has(quarter.quarterId);
        return (
          <div key={quarter.quarterId} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button
              onClick={() => toggleQuarter(quarter.quarterId)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-500" /> : <ChevronRight className="w-5 h-5 text-slate-500" />}
                <div className="text-left">
                  <h3 className="text-sm font-bold text-slate-900">{quarter.quarterName}</h3>
                  <p className="text-xs text-slate-500">{quarter.evaluations.length} évaluation(s)</p>
                </div>
              </div>
            </button>
            {isExpanded && (
              <div className="border-t border-slate-100 divide-y divide-slate-100">
                {quarter.evaluations.map((ev: any) => (
                  <div key={ev.evaluationTypeId} className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      {/* ⭐ 2026-11-24 — Libellé COMPLET (fin du badge code
                          brut [EM1]) — le nom du type est désormais enrichi
                          du mois de la date programmée. */}
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100 text-purple-700">
                        <BookOpen className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="text-sm font-semibold text-slate-900">
                          {enrichedEvalLabel(ev.evaluationTypeCode, ev.evaluationTypeName, [{ evaluationDate: ev.evaluationDate }])}
                        </div>
                        {ev.evaluationDate && (
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(ev.evaluationDate), "d MMM yyyy", { locale: fr })}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="bg-white border border-slate-200 rounded-xl overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-xs uppercase text-slate-500">
                            <th className="text-left px-3 py-2 font-semibold">Matière</th>
                            <th className="text-center px-3 py-2 font-semibold">{isMaternelle ? "Appréciation" : "Note"}</th>
                            {!isMaternelle && <th className="text-center px-3 py-2 font-semibold">Sur</th>}
                            <th className="text-center px-3 py-2 font-semibold">Coef.</th>
                            <th className="text-left px-3 py-2 font-semibold">Observation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ev.subjects.map((s: any, i: number) => (
                            <tr key={s.subjectId || i} className="border-t border-slate-100">
                              <td className="px-3 py-2 font-medium text-slate-900">
                                <div className="flex items-center gap-2">
                                  <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                                  {s.subjectName}
                                </div>
                              </td>
                              <td className="text-center px-3 py-2">
                                {s.isAbsent ? (
                                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700">ABS</span>
                                ) : isMaternelle ? (
                                  <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold ${
                                    s.qualitativeCode === "TS" ? "bg-emerald-100 text-emerald-700" :
                                    s.qualitativeCode === "S" ? "bg-blue-100 text-blue-700" :
                                    s.qualitativeCode === "PS" ? "bg-amber-100 text-amber-700" : ""
                                  }`}>
                                    {s.qualitativeCode || "—"}
                                  </span>
                                ) : (
                                  <span className={`font-bold ${(s.score || 0) >= 10 ? "text-emerald-700" : "text-red-600"}`}>
                                    {s.score !== null ? Number(s.score).toFixed(2) : "—"}
                                  </span>
                                )}
                              </td>
                              {!isMaternelle && <td className="text-center px-3 py-2 text-slate-500">/{s.maxScore}</td>}
                              <td className="text-center px-3 py-2 text-slate-500 text-xs">{s.coefficient}</td>
                              <td className="px-3 py-2 text-slate-600 text-xs">
                                <span className="inline-flex items-center gap-1">
                                  <Award className="w-3 h-3" />
                                  {s.appreciation}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Bulletins Sub-Tab ─────────────────────────────────────────────────────

function BulletinsSubTab({
  resultsData,
  child,
  schoolHeader,
  downloadingId,
  setDownloadingId,
}: {
  resultsData: any[];
  child: any;
  schoolHeader: SchoolHeader;
  downloadingId: string | null;
  setDownloadingId: (id: string | null) => void;
}) {
  if (!resultsData || resultsData.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <FileText className="h-10 w-10 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">Aucun bulletin disponible pour cette période.</p>
        <p className="text-xs text-slate-400 mt-1">
          Les bulletins seront publiés par l'école après les compositions.
        </p>
      </div>
    );
  }

  const downloadBulletin = async (rc: any) => {
    setDownloadingId(rc.id);
    try {
      await exportBulletinToPdf(
        {
          reportCardId: rc.id,
          type: rc.type,
          overallAverage: rc.overallAverage,
          rank: rc.rank,
          status: rc.status,
          quarterName: rc.quarterName,
          publishedAt: rc.publishedAt,
          items: rc.items || [],
          student: {
            firstName: child.firstName,
            lastName: child.lastName,
            matricule: child.matricule,
            className: child.className,
            levelName: child.levelName,
          },
        },
        schoolHeader,
      );
      toast.success("Bulletin téléchargé");
    } catch (e: any) {
      toast.error("Erreur", { description: e.message });
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {resultsData.map((rc) => (
        <div key={rc.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="bg-purple-50 border-b border-purple-200 p-4 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-900">
                {rc.quarterName || rc.type || "Bulletin"}
              </div>
              {rc.overallAverage != null && (
                <div className="text-sm text-slate-600 mt-0.5">
                  Moyenne générale : <span className="font-bold text-purple-700">
                    {Number(rc.overallAverage).toFixed(2)} / 20
                  </span>
                  {rc.rank != null && <span className="ml-3">Rang : {rc.rank}</span>}
                </div>
              )}
              {rc.publishedAt && (
                <div className="text-xs text-slate-400 mt-0.5">
                  Publié le {format(new Date(rc.publishedAt), "d MMM yyyy", { locale: fr })}
                </div>
              )}
            </div>
            <button
              onClick={() => downloadBulletin(rc)}
              disabled={downloadingId === rc.id}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50"
            >
              {downloadingId === rc.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Download className="h-3 w-3" />
              )}
              Bulletin PDF
            </button>
          </div>
          {rc.items && rc.items.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-2 font-semibold text-slate-700">Matière</th>
                  <th className="text-center px-4 py-2 font-semibold text-slate-700">Moyenne</th>
                  <th className="text-center px-4 py-2 font-semibold text-slate-700">Coef.</th>
                  <th className="text-center px-4 py-2 font-semibold text-slate-700">Rang</th>
                  <th className="text-left px-4 py-2 font-semibold text-slate-700">Appréciation</th>
                </tr>
              </thead>
              <tbody>
                {rc.items.map((item: any, i: number) => (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-4 py-2 font-medium text-slate-900">{item.subjectName || "—"}</td>
                    <td className="px-4 py-2 text-center font-bold text-slate-900">
                      {item.average != null ? Number(item.average).toFixed(2) : "—"}
                    </td>
                    <td className="px-4 py-2 text-center text-slate-500">
                      {item.coefficient || "—"}
                    </td>
                    <td className="px-4 py-2 text-center text-slate-500">
                      {item.rank || "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-600 text-xs">{item.comments || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-4 text-sm text-slate-500">Détail par matière non disponible.</div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// ONGLET 4 : Assiduité
// ============================================================================

function AttendanceTab({ child, attendanceData }: { child: any; attendanceData: any[] }) {
  // ⭐ Compute stats using parsed display info (not raw status)
  const stats = attendanceData.reduce((acc, r) => {
    acc.total++;
    const display = getAttendanceDisplay(r);
    if (display.label === "Présent") acc.present++;
    else if (display.label === "Absent") acc.absent++;
    else if (display.label === "Demi-journée" || display.label === "En retard") acc.late++;
    return acc;
  }, { total: 0, present: 0, absent: 0, late: 0 });

  // Find earliest + latest date for the period label
  const dates = attendanceData.map(r => new Date(r.date)).sort((a, b) => b.getTime() - a.getTime());
  const latestDate = dates[0];

  return (
    <div className="space-y-4">
      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
          <p className="text-xs text-slate-500 uppercase">Jours enregistrés</p>
          {latestDate && (
            <p className="text-[10px] text-slate-400 mt-1">
              Dernier: {format(latestDate, "d MMM yyyy", { locale: fr })}
            </p>
          )}
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4 text-center">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-emerald-700">{stats.present}</p>
          <p className="text-xs text-emerald-700 uppercase">Présents</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
          <XCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-red-700">{stats.absent}</p>
          <p className="text-xs text-red-700 uppercase">Absents</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-center">
          <Clock className="h-5 w-5 text-amber-600 mx-auto mb-1" />
          <p className="text-2xl font-bold text-amber-700">{stats.late}</p>
          <p className="text-xs text-amber-700 uppercase">Demi-journées / Retards</p>
        </div>
      </div>

      {/* History table */}
      {attendanceData.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Date</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-700">Statut</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-700">Détail</th>
              </tr>
            </thead>
            <tbody>
              {attendanceData.map((r, i) => {
                const display = getAttendanceDisplay(r);
                return (
                  <tr key={i} className="border-b border-slate-100">
                    <td className="px-4 py-3 text-slate-600 font-medium">
                      {format(new Date(r.date), "EEEE d MMMM yyyy", { locale: fr })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        "inline-flex items-center px-2 py-1 rounded text-xs font-bold",
                        display.color,
                      )}>
                        {display.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">
                      {display.detail || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <CalendarCheck className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-500">Aucune donnée d'assiduité ce mois-ci.</p>
        </div>
      )}
    </div>
  );
}
