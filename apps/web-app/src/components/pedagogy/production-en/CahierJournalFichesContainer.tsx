"use client";

/**
 * ============================================================================
 * WEEKLY RECORD OF WORK — Container (EN track)
 * ============================================================================
 *
 * Container with 2 sub-tabs:
 *   1. "Weekly Record of Work" — grid: subjects (rows) × 12 weeks (columns)
 *      Each cell is a RichTextEditor where the teacher records what was done
 *      that week for that subject. Same pattern as Scheme of Work but
 *      transposed (weeks are columns, subjects are rows).
 *   2. "Catalogue" — hierarchical archive of all Weekly Records of Work
 *      from previous academic years (same pattern as FR CatalogueTab).
 *
 * ⭐ The "Pedagogical Sheets" sub-tab has been REMOVED (per user request).
 * ============================================================================
 */

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  FileSpreadsheet,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  Eye,
  Download,
  FolderOpen,
} from "lucide-react";
import apiClient from "@/lib/api/client";
import { WeeklyRecordOfWorkTab } from "./WeeklyRecordOfWorkTab";
import { WeeklyRecordCatalogueTab } from "./WeeklyRecordCatalogueTab";
import { useModuleContext } from "@/hooks/useModuleContext";
import { useAppSession } from "@/contexts/AppSessionContext";

type SubTab = "cahier" | "catalogue";

interface CahierJournalFichesContainerProps {
  tenantId: string;
  academicYearId: string;
  teacherId: string;
}

export function CahierJournalFichesContainer({
  tenantId,
  academicYearId,
  teacherId,
}: CahierJournalFichesContainerProps) {
  const [subTab, setSubTab] = useState<SubTab>("cahier");
  const [currentJournalId, setCurrentJournalId] = useState<string | null>(null);
  const { schoolLevel } = useModuleContext();
  const { user } = useAppSession();
  const schoolLevelCode = (schoolLevel?.code || '').toUpperCase();
  const isSecondaryLevel =
    schoolLevelCode.includes('SECOND') ||
    schoolLevelCode.includes('COLLEGE') ||
    schoolLevelCode.includes('LYCEE');
  const GLOBAL_ACCESS_ROLES = new Set([
    'PROMOTER', 'PROMOTEUR', 'PLATFORM_OWNER', 'PLATFORM_SUPER_ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN',
  ]);
  const hasGlobalAccess = GLOBAL_ACCESS_ROLES.has((user?.role || '').toUpperCase());
  const showCatalogue = !isSecondaryLevel || hasGlobalAccess;

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-white rounded-xl border border-slate-200 p-1 flex-wrap">
        <button
          onClick={() => setSubTab("cahier")}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold",
            subTab === "cahier" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
          )}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Weekly Record of Work
        </button>
        {showCatalogue && (
          <button
            onClick={() => setSubTab("catalogue")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold",
              subTab === "catalogue" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"
            )}
          >
            <FolderOpen className="h-4 w-4" />
            Catalogue
          </button>
        )}
      </div>

      {/* Sub-tab content */}
      {subTab === "cahier" && (
        <WeeklyRecordOfWorkTab
          tenantId={tenantId}
          academicYearId={academicYearId}
          teacherId={teacherId}
        />
      )}

      {subTab === "catalogue" && showCatalogue && (
        <WeeklyRecordCatalogueTab
          tenantId={tenantId}
          academicYearId={academicYearId}
          teacherId={teacherId}
        />
      )}
    </div>
  );
}
