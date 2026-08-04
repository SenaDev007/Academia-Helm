"use client";

/**
 * ============================================================================
 * PORTAIL PARENT — Paiements [/app/parent/payments]
 * ============================================================================
 *
 * Page simplifiée qui utilise <ParentFinancePanel> pour afficher :
 *   - Détail des frais (inscription, scolarité, etc.)
 *   - Réductions/personnalisations appliquées
 *   - Arriérés par année
 *   - Paiement FedaPay avec MONTANT PERSONNALISÉ
 *   - Historique des transactions
 *
 * Le parent sélectionne l'enfant dans la liste déroulante, puis le
 * ParentFinancePanel affiche toutes les infos financières détaillées.
 * ============================================================================
 */

import { useState, useEffect } from "react";
import { useAppSession } from "@/contexts/AppSessionContext";
import { useModuleContext } from "@/hooks/useModuleContext";
import { useParentChildren } from "@/lib/query/parent-hooks";
import { Loader2, Users, ChevronDown } from "lucide-react";
import ParentFinancePanel from "@/components/parent/ParentFinancePanel";

export default function ParentPaymentsPage() {
  const { user } = useAppSession();
  const { academicYear } = useModuleContext();
  const { data: children = [], isLoading } = useParentChildren(academicYear?.id);
  const [selectedChildId, setSelectedChildId] = useState<string>("");

  // Auto-select first child
  useEffect(() => {
    if (children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  const selectedChild = children.find((c: any) => c.id === selectedChildId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <span className="ml-3 text-sm text-gray-600">Chargement…</span>
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">Aucun enfant lié à votre compte.</p>
        <p className="text-sm text-gray-400 mt-1">
          Contactez l'administration pour lier vos enfants.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sélecteur d'enfant */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <label className="block text-xs font-medium text-gray-600 mb-2">
          Sélectionnez l'enfant
        </label>
        <div className="relative">
          <select
            value={selectedChildId}
            onChange={(e) => setSelectedChildId(e.target.value)}
            className="w-full appearance-none px-3 py-2 pr-10 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {children.map((child: any) => (
              <option key={child.id} value={child.id}>
                {child.firstName} {child.lastName} — {child.className || 'Sans classe'}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Panneau finances détaillé */}
      {selectedChild && (
        <ParentFinancePanel
          studentId={selectedChild.id}
          studentFirstName={selectedChild.firstName}
          studentLastName={selectedChild.lastName}
          studentMatricule={selectedChild.matricule}
        />
      )}
    </div>
  );
}
