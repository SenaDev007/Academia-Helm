"use client";

/**
 * Parent Portal — Documents
 * Attestations et certificats téléchargeables.
 */

import { Folder, FileText, Download, Clock } from "lucide-react";

export default function ParentDocumentsPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Folder className="h-5 w-5 text-slate-600" />
        <h2 className="text-lg font-bold text-slate-900">Documents</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Certificat de scolarité */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <FileText className="h-8 w-8 text-blue-600" />
            <div>
              <h3 className="font-bold text-slate-900">Certificat de scolarité</h3>
              <p className="text-xs text-slate-500">Atteste que l'élève est inscrit</p>
            </div>
          </div>
          <button
            onClick={() => alert("Téléchargement du certificat — disponible prochainement")}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 w-full justify-center"
          >
            <Download className="h-4 w-4" />
            Télécharger
          </button>
        </div>

        {/* Attestation de paiement */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <FileText className="h-8 w-8 text-emerald-600" />
            <div>
              <h3 className="font-bold text-slate-900">Attestation de paiement</h3>
              <p className="text-xs text-slate-500">Récapitulatif des paiements</p>
            </div>
          </div>
          <button
            onClick={() => alert("Téléchargement de l'attestation — disponible prochainement")}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 w-full justify-center"
          >
            <Download className="h-4 w-4" />
            Télécharger
          </button>
        </div>

        {/* Bulletin */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <FileText className="h-8 w-8 text-purple-600" />
            <div>
              <h3 className="font-bold text-slate-900">Bulletin de notes</h3>
              <p className="text-xs text-slate-500">Dernier bulletin disponible</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Clock className="h-3 w-3" />
            <span>Disponible après les compositions</span>
          </div>
        </div>

        {/* Carnet de liaison */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-3">
            <FileText className="h-8 w-8 text-amber-600" />
            <div>
              <h3 className="font-bold text-slate-900">Carnet de liaison</h3>
              <p className="text-xs text-slate-500">Messages de l'école</p>
            </div>
          </div>
          <button
            onClick={() => alert("Carnet de liaison — disponible prochainement")}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 w-full justify-center"
          >
            <Download className="h-4 w-4" />
            Télécharger
          </button>
        </div>
      </div>
    </div>
  );
}
