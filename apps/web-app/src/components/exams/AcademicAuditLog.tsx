/**
 * AcademicAuditLog Component
 * 
 * ONGLET 10 — Audit Académique
 * Journal d'intégrité académique, historique des modifications et demandes de correction.
 */

'use client';

import { useState } from 'react';
import { ShieldCheck, History, AlertTriangle, FileSearch, Edit3, Lock, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AcademicAuditLog() {
  const [logs] = useState([
    { id: 'AUD-001', entity: 'Grade', action: 'UPDATE', user: 'M. Kouassi', detail: 'Note de Amadou Koné modifiée : 14.5 → 15.0 (Physique T2)', timestamp: '16 Mai 2026 10:22', risk: 'LOW' },
    { id: 'AUD-002', entity: 'GradeLock', action: 'CREATE', user: 'Dir. Konaté', detail: 'Verrouillage période Trimestre 1 — Terminale C appliqué', timestamp: '15 Mai 2026 17:45', risk: 'MEDIUM' },
    { id: 'AUD-003', entity: 'Grade', action: 'UNLOCK_ATTEMPT', user: 'Inconnu', detail: 'Tentative de modification de note verrouillée bloquée automatiquement', timestamp: '14 Mai 2026 09:15', risk: 'HIGH' },
    { id: 'AUD-004', entity: 'Bulletin', action: 'PUBLISH', user: 'Dir. Konaté', detail: '42 bulletins publiés pour 3ème A — Trimestre 1', timestamp: '13 Mai 2026 08:00', risk: 'LOW' },
  ]);

  const [corrections] = useState([
    { id: 'COR-001', student: 'Ibrahim Sylla', subject: 'Mathématiques', old: 8.5, new: 9.0, reason: 'Erreur de retranscription de la copie', status: 'PENDING', by: 'M. Kouassi', date: '15 Mai' },
    { id: 'COR-002', student: 'Fatou Diallo', subject: 'Français', old: 13.0, new: 14.5, reason: 'Correction suite réclamation légitimée', status: 'APPROVED', by: 'Mme. Traoré', date: '12 Mai' },
  ]);

  const riskColors: Record<string, string> = {
    HIGH:   'bg-rose-50 text-rose-700 border-rose-200',
    MEDIUM: 'bg-amber-50 text-amber-700 border-amber-200',
    LOW:    'bg-emerald-50 text-emerald-700 border-emerald-200',
  };

  const actionIcons: Record<string, any> = {
    UPDATE:          Edit3,
    CREATE:          CheckCircle2,
    UNLOCK_ATTEMPT:  AlertTriangle,
    PUBLISH:         ShieldCheck,
  };

  return (
    <div className="space-y-8">
      {/* Security Banner */}
      <div className="bg-slate-950 rounded-[2.5rem] p-10 text-white relative overflow-hidden border border-slate-800">
        <div className="relative z-10 flex items-start gap-6">
          <div className="p-4 bg-white/5 rounded-2xl border border-white/10 flex-shrink-0">
            <ShieldCheck className="w-10 h-10 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-2">ORION Academic Integrity Monitor</p>
            <h2 className="text-3xl font-black tracking-tighter leading-none">Audit d'Intégrité Académique</h2>
            <p className="text-slate-400 text-sm mt-2 max-w-lg">Toutes les actions sur les notes, bulletins et verrous sont tracées de manière immuable. Aucune modification ne peut être effacée de cet historique.</p>
          </div>
        </div>
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 30px, #ffffff 30px, #ffffff 31px)' }} />
      </div>

      {/* Audit Log */}
      <div>
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <History className="w-4 h-4" /> Journal des Événements Académiques
        </h3>
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
          {logs.map((log, i) => {
            const Icon = actionIcons[log.action] || Edit3;
            return (
              <div key={i} className="p-5 flex items-start gap-5 hover:bg-slate-50 transition-all group">
                <div className={cn("p-3 rounded-2xl border", riskColors[log.risk])}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-black border", riskColors[log.risk])}>
                        {log.risk === 'HIGH' ? '🔴 Critique' : log.risk === 'MEDIUM' ? '🟡 Avertissement' : '🟢 Info'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{log.entity} — {log.action}</span>
                    </div>
                    <span className="text-[10px] font-medium text-slate-400">{log.timestamp}</span>
                  </div>
                  <p className="text-sm text-slate-700 font-medium leading-relaxed">{log.detail}</p>
                  <p className="text-[10px] text-slate-400 mt-1">Par : <span className="font-bold">{log.user}</span></p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Correction Requests */}
      <div>
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
          <FileSearch className="w-4 h-4" /> Demandes de Correction de Notes
        </h3>
        <div className="space-y-4">
          {corrections.map((cor) => (
            <div key={cor.id} className={cn(
              "bg-white rounded-3xl border shadow-sm p-6 flex items-center justify-between",
              cor.status === 'PENDING' ? "border-amber-200 bg-amber-50/30" : "border-emerald-200 bg-emerald-50/20"
            )}>
              <div className="flex items-center gap-5">
                <div className={cn("p-3 rounded-2xl", cor.status === 'PENDING' ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600")}>
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-900">{cor.student} — <span className="font-medium">{cor.subject}</span></p>
                  <p className="text-xs text-slate-500 mt-0.5">{cor.old} → <strong>{cor.new}</strong> · Motif : "{cor.reason}"</p>
                  <p className="text-[10px] text-slate-400 mt-1">Demandée par {cor.by} le {cor.date}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black",
                  cor.status === 'PENDING' ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                )}>
                  {cor.status === 'PENDING' ? 'En attente' : 'Approuvée'}
                </span>
                {cor.status === 'PENDING' && (
                  <div className="flex gap-2">
                    <button className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-[10px] font-black hover:bg-emerald-700 transition-all">Approuver</button>
                    <button className="px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black hover:bg-rose-100 transition-all">Rejeter</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
