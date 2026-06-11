/**
 * ValidationLocking Component
 * 
 * ONGLET 5 — Validation & Verrouillage
 * Circuit institutionnel de validation des notes et gestion des verrous.
 */

'use client';

import { useState } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, Lock, Unlock, AlertTriangle, MessageSquare, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ValidationLocking() {
  const [batches] = useState([
    { id: 'VB-001', subject: 'Mathématiques', class: 'Terminale C', teacher: 'M. Kouassi', submittedAt: '15 Mai 09:30', grades: 34, status: 'PENDING' },
    { id: 'VB-002', subject: 'Physique-Chimie', class: 'Terminale C', teacher: 'Mme. Traoré', submittedAt: '14 Mai 16:45', grades: 34, status: 'APPROVED' },
    { id: 'VB-003', subject: 'Français', class: '3ème A', teacher: 'M. Diallo', submittedAt: '13 Mai 11:20', grades: 42, status: 'CORRECTION_REQUESTED' },
  ]);

  const [locks] = useState([
    { scope: 'Classe Complète', name: 'Terminale C — Trimestre 1', lockedBy: 'Dir. Konaté', lockedAt: 'Dec 2025', active: true },
  ]);

  return (
    <div className="space-y-8">
      {/* Pending Batches */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-500" /> Lots en Attente de Validation
          </h3>
          <span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black">
            1 en attente
          </span>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
          {batches.map((batch) => (
            <div key={batch.id} className="p-6 flex items-center justify-between hover:bg-slate-50 transition-all group">
              <div className="flex items-center gap-5">
                <div className={cn(
                  "w-12 h-12 rounded-2xl flex items-center justify-center",
                  batch.status === 'PENDING' ? "bg-amber-50 text-amber-600" :
                  batch.status === 'APPROVED' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                )}>
                  {batch.status === 'PENDING' ? <ShieldCheck className="w-6 h-6" /> :
                   batch.status === 'APPROVED' ? <CheckCircle2 className="w-6 h-6" /> :
                   <MessageSquare className="w-6 h-6" />}
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">{batch.subject} — <span className="font-medium">{batch.class}</span></p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{batch.teacher} · Soumis le {batch.submittedAt} · {batch.grades} notes</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black",
                  batch.status === 'PENDING' ? "bg-amber-50 text-amber-700" :
                  batch.status === 'APPROVED' ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                )}>
                  {batch.status === 'PENDING' ? 'En attente' : batch.status === 'APPROVED' ? 'Approuvé' : 'Correction demandée'}
                </span>
                {batch.status === 'PENDING' && (
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                    <button className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black hover:bg-emerald-700 transition-all flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Valider
                    </button>
                    <button className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black hover:bg-rose-100 transition-all flex items-center gap-1">
                      <XCircle className="w-3 h-3" /> Rejeter
                    </button>
                    <button className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black hover:bg-slate-200 transition-all flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> Correction
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lock Management */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Lock className="w-4 h-4 text-rose-500" /> Verrous Actifs
          </h3>
          <button className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl font-bold text-xs hover:bg-rose-700 transition-all">
            <Lock className="w-3 h-3" /> Appliquer un Verrou
          </button>
        </div>

        {locks.length > 0 ? (
          <div className="space-y-3">
            {locks.map((lock, i) => (
              <div key={i} className="bg-rose-50 border border-rose-100 rounded-2xl p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Lock className="w-5 h-5 text-rose-500" />
                  <div>
                    <p className="text-sm font-bold text-rose-900">{lock.name}</p>
                    <p className="text-[10px] text-rose-600">Verrouillé par {lock.lockedBy} — {lock.lockedAt}</p>
                  </div>
                </div>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-rose-200 text-rose-600 rounded-xl text-[10px] font-black hover:bg-rose-50 transition-all">
                  <Unlock className="w-3 h-3" /> Déverrouiller
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-50 rounded-2xl p-8 text-center border border-slate-200 border-dashed">
            <Unlock className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400 font-medium">Aucun verrou actif sur cette période.</p>
          </div>
        )}
      </div>

      {/* Critical Info */}
      <div className="bg-slate-900 rounded-3xl p-8 text-white">
        <h4 className="font-bold text-sm mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" /> Règles de Validation
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            'Seuls Directeur et Censeur peuvent valider les notes soumises.',
            'Une note verrouillée ne peut être corrigée que via demande officielle.',
            'Le verrouillage d\'une période bloque toutes les modifications pour cette période.',
            'Tout déverrouillage exceptionnel est audité automatiquement.',
          ].map((rule, i) => (
            <div key={i} className="flex items-start gap-3 p-4 bg-white/5 rounded-2xl">
              <div className="w-5 h-5 rounded-full bg-amber-400 text-slate-900 text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</div>
              <p className="text-xs text-slate-300 leading-relaxed">{rule}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
