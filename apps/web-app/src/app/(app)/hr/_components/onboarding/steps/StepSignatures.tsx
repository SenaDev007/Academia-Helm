'use client';

import { useState } from 'react';
import { PenTool, CheckCircle, Loader2, AlertTriangle, Shield } from 'lucide-react';
import { SignatureCanvas } from '../components/SignatureCanvas';
import { hrFetch, hrUrl } from '@/lib/hr/hr-client';
import { toast } from '@/components/ui/toast';

interface StepSignaturesProps {
  contractId: string | null;
  tenantId: string;
  staffFullName: string;
  employerSigned: boolean;
  employeeSigned: boolean;
  onEmployerSigned: (signatureData: string) => void;
  onEmployeeSigned: (signatureData: string) => void;
}

export function StepSignatures({
  contractId,
  tenantId,
  staffFullName,
  employerSigned,
  employeeSigned,
  onEmployerSigned,
  onEmployeeSigned,
}: StepSignaturesProps) {
  const [employerName, setEmployerName] = useState('');
  const [employerRole, setEmployerRole] = useState('Directeur');
  const [employerConsent, setEmployerConsent] = useState(false);
  const [employerSignatureData, setEmployerSignatureData] = useState<string | null>(null);
  const [signingEmployer, setSigningEmployer] = useState(false);

  const [employeeConsent, setEmployeeConsent] = useState(false);
  const [employeeSignatureData, setEmployeeSignatureData] = useState<string | null>(null);
  const [signingEmployee, setSigningEmployee] = useState(false);

  const handleEmployerSign = async () => {
    if (!contractId || !employerSignatureData || !employerName || !employerConsent) return;
    try {
      setSigningEmployer(true);
      await hrFetch(hrUrl(`contracts/${contractId}/sign`, { tenantId }), {
        method: 'POST',
        body: {
          signatureData: employerSignatureData,
          signerName: employerName,
          signerRole: 'EMPLOYEUR',
        },
      });
      onEmployerSigned(employerSignatureData);
      toast({ variant: 'success', title: 'Signature de l\'employeur enregistrée' });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur de signature', description: err?.message });
    } finally {
      setSigningEmployer(false);
    }
  };

  const handleEmployeeSign = async () => {
    if (!contractId || !employeeSignatureData || !employeeConsent) return;
    try {
      setSigningEmployee(true);
      await hrFetch(hrUrl(`contracts/${contractId}/sign`, { tenantId }), {
        method: 'POST',
        body: {
          signatureData: employeeSignatureData,
          signerName: staffFullName,
          signerRole: 'EMPLOYE',
        },
      });
      onEmployeeSigned(employeeSignatureData);
      toast({ variant: 'success', title: 'Signature de l\'employé enregistrée' });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur de signature', description: err?.message });
    } finally {
      setSigningEmployee(false);
    }
  };

  if (!contractId) {
    return (
      <div className="p-8 text-center text-slate-400">
        <PenTool className="h-12 w-12 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Le contrat doit d&apos;abord être créé et prévisualisé</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
          <PenTool className="h-4 w-4" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-800">Signatures Électroniques</h4>
          <p className="text-[11px] text-slate-400">L&apos;employeur signe en premier, puis l&apos;employé</p>
        </div>
      </div>

      {/* Legal notice */}
      <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl text-[11px] text-blue-700 flex gap-2">
        <Shield className="h-4 w-4 shrink-0 text-blue-500 mt-0.5" />
        <span>Ces signatures électroniques ont valeur légale conformément aux dispositions applicables. La date, l&apos;heure et l&apos;adresse IP seront enregistrées à des fins probatoires.</span>
      </div>

      {/* ─── EMPLOYER SIGNATURE ─────────────────────────────── */}
      <div className={`border rounded-xl p-4 transition-all ${
        employerSigned ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <h5 className="text-sm font-bold text-slate-800">Signature de l&apos;Employeur</h5>
          {employerSigned ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <CheckCircle className="h-4 w-4" /> Signé
            </span>
          ) : (
            <span className="text-xs font-semibold text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> En attente
            </span>
          )}
        </div>

        {!employerSigned ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Nom du signataire *</label>
                <input
                  type="text"
                  placeholder="Ex : Marie KOFFI"
                  value={employerName}
                  onChange={(e) => setEmployerName(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#1d4fa5] focus:ring-1 focus:ring-[#1d4fa5]/10"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">Rôle / Fonction</label>
                <select
                  value={employerRole}
                  onChange={(e) => setEmployerRole(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#1d4fa5]"
                >
                  <option value="Directeur">Directeur(rice)</option>
                  <option value="Responsable RH">Responsable RH</option>
                  <option value="Gérant">Gérant</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>
            </div>
            <SignatureCanvas
              onSignatureChange={(data) => setEmployerSignatureData(data)}
              placeholder="Signez ici au nom de l'établissement"
            />
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={employerConsent}
                onChange={(e) => setEmployerConsent(e.target.checked)}
                className="mt-1 rounded border-slate-300 text-[#1d4fa5] focus:ring-[#1d4fa5]"
              />
              <span className="text-[11px] text-slate-600">Je certifie signer ce contrat au nom de l&apos;établissement, en tant que {employerRole.toLowerCase()}, et avoir l&apos;autorité nécessaire pour ce faire.</span>
            </label>
            <button
              type="button"
              onClick={handleEmployerSign}
              disabled={signingEmployer || !employerSignatureData || !employerName || !employerConsent}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1d4fa5] text-white rounded-xl text-sm font-bold disabled:opacity-50 transition hover:opacity-90"
            >
              {signingEmployer ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenTool className="h-4 w-4" />}
              Signer en tant qu&apos;Employeur
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="text-sm font-bold text-emerald-800">Signé par {employerName}</p>
              <p className="text-xs text-emerald-600">En tant que {employerRole}</p>
            </div>
          </div>
        )}
      </div>

      {/* ─── EMPLOYEE SIGNATURE ─────────────────────────────── */}
      <div className={`border rounded-xl p-4 transition-all ${
        !employerSigned
          ? 'border-slate-200 bg-slate-50/50 opacity-60'
          : employeeSigned
          ? 'border-emerald-200 bg-emerald-50/30'
          : 'border-slate-200 bg-white'
      }`}>
        <div className="flex items-center justify-between mb-3">
          <h5 className="text-sm font-bold text-slate-800">Signature de l&apos;Employé(e)</h5>
          {employeeSigned ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <CheckCircle className="h-4 w-4" /> Signé
            </span>
          ) : employerSigned ? (
            <span className="text-xs font-semibold text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> En attente
            </span>
          ) : (
            <span className="text-xs font-semibold text-slate-400">L&apos;employeur doit signer en premier</span>
          )}
        </div>

        {employerSigned && !employeeSigned ? (
          <div className="space-y-3">
            <div className="p-2 bg-slate-50 rounded-lg text-sm">
              <span className="text-xs font-semibold text-slate-500">Signataire :</span>{' '}
              <span className="font-bold text-slate-800">{staffFullName}</span>
            </div>
            <SignatureCanvas
              onSignatureChange={(data) => setEmployeeSignatureData(data)}
              placeholder="L'employé(e) signe ici"
            />
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={employeeConsent}
                onChange={(e) => setEmployeeConsent(e.target.checked)}
                className="mt-1 rounded border-slate-300 text-[#1d4fa5] focus:ring-[#1d4fa5]"
              />
              <span className="text-[11px] text-slate-600">Je certifie avoir lu et compris le contrat de travail, et j&apos;accepte ses termes et conditions.</span>
            </label>
            <button
              type="button"
              onClick={handleEmployeeSign}
              disabled={signingEmployee || !employeeSignatureData || !employeeConsent}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0b2f73] text-white rounded-xl text-sm font-bold disabled:opacity-50 transition hover:opacity-90"
            >
              {signingEmployee ? <Loader2 className="h-4 w-4 animate-spin" /> : <PenTool className="h-4 w-4" />}
              Signer en tant qu&apos;Employé(e)
            </button>
          </div>
        ) : employeeSigned ? (
          <div className="flex items-center gap-3 p-3 bg-emerald-50 rounded-lg">
            <CheckCircle className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="text-sm font-bold text-emerald-800">Signé par {staffFullName}</p>
              <p className="text-xs text-emerald-600">Employé(e)</p>
            </div>
          </div>
        ) : (
          <div className="p-4 text-center text-sm text-slate-400">
            <AlertTriangle className="h-6 w-6 mx-auto mb-2 opacity-40" />
            L&apos;employeur doit signer le contrat en premier.
          </div>
        )}
      </div>
    </div>
  );
}
