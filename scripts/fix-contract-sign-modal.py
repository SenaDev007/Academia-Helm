#!/usr/bin/env python3
"""
Patch ContractSignModal.tsx (both copies in app/app and app/(app)) to:
1. Add a signer role selector (Employeur / Employé) — auto-detected from contract state
2. Surface the actual backend error message in the toast instead of a generic one
"""
import re
import sys
from pathlib import Path

TARGETS = [
    Path('/home/z/my-project/apps/web-app/src/app/app/hr/_components/modals/ContractSignModal.tsx'),
    Path('/home/z/my-project/apps/web-app/src/app/(app)/hr/_components/modals/ContractSignModal.tsx'),
]

NEW_MODAL_CONTENT = '''\'use client\';

import { useRef, useState, useEffect } from \'react\';
import { X, PenTool, Trash2, CheckCircle, Loader2, Shield, UserCheck, Building2 } from \'lucide-react\';
import { hrFetch, hrUrl } from \'@/lib/hr/hr-client\';
import { useModuleContext } from \'@/hooks/useModuleContext\';
import { toast } from \'@/components/ui/toast\';
import { motion, AnimatePresence } from \'framer-motion\';

const PRIMARY = \'#1A2BA6\';

interface ContractSignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  contract: any;
}

type SignerRole = \'EMPLOYEUR\' | \'EMPLOYE\';

export function ContractSignModal({ isOpen, onClose, onSuccess, contract }: ContractSignModalProps) {
  const { tenant } = useModuleContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signerName, setSignerName] = useState(\'\');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [signerRole, setSignerRole] = useState<SignerRole>(\'EMPLOYE\');

  // Detect the appropriate signer role from contract state
  const terms: any = (contract?.terms as any) || {};
  const employerHasSigned = !!terms.employerSignedAt;
  const employeeHasSigned = !!contract?.signedAt;

  useEffect(() => {
    if (contract) {
      // Pre-fill the signer name from the contract staff
      if (contract.staff) {
        setSignerName(`${contract.staff.firstName} ${contract.staff.lastName}`);
      }
      // Auto-select the role:
      // - If employer hasn\'t signed yet → default to EMPLOYEUR
      // - If employer has signed but employee hasn\'t → default to EMPLOYE
      const t: any = (contract.terms as any) || {};
      if (!t.employerSignedAt) {
        setSignerRole(\'EMPLOYEUR\');
      } else {
        setSignerRole(\'EMPLOYE\');
      }
    }
  }, [contract]);

  useEffect(() => {
    if (!isOpen) {
      setHasSignature(false);
      setAgreed(false);
      setLoading(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // ── Canvas Drawing ─────────────────────────────────────────────────────────
  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (\'touches\' in e) {
      const t = e.touches[0];
      return {
        x: (t.clientX - rect.left) * scaleX,
        y: (t.clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext(\'2d\');
    if (!ctx) return;
    e.preventDefault();
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext(\'2d\');
    if (!ctx) return;
    e.preventDefault();
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = \'#1a1a1a\';
    ctx.lineWidth = 2.5;
    ctx.lineCap = \'round\';
    ctx.lineJoin = \'round\';
    ctx.stroke();
    setHasSignature(true);
  };

  const endDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext(\'2d\');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  // ── Submit ──────────────────────────────────────────────────────────────────
  const handleSign = async () => {
    if (!hasSignature) {
      toast({ variant: \'error\', title: \'Veuillez apposer votre signature.\' });
      return;
    }
    if (!agreed) {
      toast({ variant: \'error\', title: \'Veuillez cocher la case d\\\'acceptation.\' });
      return;
    }
    if (!signerName.trim()) {
      toast({ variant: \'error\', title: \'Veuillez saisir le nom du signataire.\' });
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const signatureData = canvas.toDataURL(\'image/png\');

    try {
      setLoading(true);
      await hrFetch<any>(hrUrl(`contracts/${contract.id}/sign`, { tenantId: tenant.id }), {
        method: \'POST\',
        body: { signatureData, signerName: signerName.trim(), signerRole },
      });
      const successMsg = signerRole === \'EMPLOYEUR\'
        ? \'Signature employeur enregistrée. Le contrat est en attente de la signature de l\\\'employé.\'
        : \'Contrat signé avec succès !\';
      toast({ variant: \'success\', title: successMsg });
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(\'[ContractSignModal] sign error:\', err);
      // Surface the actual backend error message
      const backendMsg = err?.message || err?.error || err?.data?.message;
      const displayMsg = backendMsg
        ? `Erreur : ${backendMsg}`
        : \'Erreur lors de la signature. Veuillez réessayer.\';
      toast({ variant: \'error\', title: displayMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 text-white" style={{ background: PRIMARY }}>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-white/15 p-2">
              <PenTool className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Signature Électronique du Contrat</h3>
              <p className="text-[10px] text-white/70">
                {contract?.staff?.firstName} {contract?.staff?.lastName} — {contract?.contractType}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-white/15 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Signer role selector */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Je signe en tant que
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSignerRole(\'EMPLOYEUR\')}
                disabled={employerHasSigned}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  signerRole === \'EMPLOYEUR\'
                    ? \'border-[#1A2BA6] bg-[#1A2BA6]/5 text-[#1A2BA6]\'
                    : \'border-slate-200 text-slate-600 hover:border-slate-300\'
                }`}
              >
                <Building2 className="h-4 w-4" />
                <div className="text-left">
                  <div>Employeur</div>
                  {employerHasSigned && <div className="text-[9px] text-green-600 font-medium">Déjà signé</div>}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setSignerRole(\'EMPLOYE\')}
                disabled={!employerHasSigned || employeeHasSigned}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed ${
                  signerRole === \'EMPLOYE\'
                    ? \'border-[#1A2BA6] bg-[#1A2BA6]/5 text-[#1A2BA6]\'
                    : \'border-slate-200 text-slate-600 hover:border-slate-300\'
                }`}
              >
                <UserCheck className="h-4 w-4" />
                <div className="text-left">
                  <div>Employé</div>
                  {!employerHasSigned && <div className="text-[9px] text-amber-600 font-medium">En attente employeur</div>}
                  {employeeHasSigned && <div className="text-[9px] text-green-600 font-medium">Déjà signé</div>}
                </div>
              </button>
            </div>
            {!employerHasSigned && signerRole === \'EMPLOYE\' && (
              <p className="mt-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1">
                L\'employeur doit signer le contrat en premier.
              </p>
            )}
          </div>

          {/* Signer name */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Nom complet du signataire
            </label>
            <input
              type="text"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:border-[#1A2BA6] focus:ring-2 focus:ring-[#1A2BA6]/10"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              placeholder="Nom et prénom"
            />
          </div>

          {/* Canvas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Apposez votre signature ci-dessous
              </label>
              {hasSignature && (
                <button
                  onClick={clearCanvas}
                  className="flex items-center gap-1 text-xs text-slate-400 hover:text-rose-500 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Effacer
                </button>
              )}
            </div>
            <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 overflow-hidden" style={{ touchAction: \'none\' }}>
              <canvas
                ref={canvasRef}
                width={600}
                height={180}
                className="w-full h-[140px] cursor-crosshair"
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
              />
              {!hasSignature && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-sm text-slate-400 font-medium">Signez ici avec votre souris ou votre doigt</p>
                </div>
              )}
            </div>
          </div>

          {/* Legal notice */}
          <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-100 text-xs text-blue-800 flex gap-2">
            <Shield className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
            <p>
              Cette signature électronique a valeur légale conformément aux dispositions applicables.
              La date, l\'heure et l\'adresse IP seront enregistrées à des fins probatoires.
            </p>
          </div>

          {/* Consent */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-[#1A2BA6]"
            />
            <span className="text-xs text-slate-600 leading-relaxed">
              Je certifie avoir lu et compris l\'intégralité du contrat de travail ci-dessus et j\'accepte ses termes et conditions en y apposant ma signature électronique.
            </span>
          </label>

          {/* Actions */}
          <div className="flex justify-between items-center pt-2 border-t border-slate-100">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
            >
              Annuler
            </button>
            <button
              onClick={handleSign}
              disabled={loading || !hasSignature || !agreed || !signerName.trim()}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl shadow-sm hover:opacity-90 disabled:opacity-50 transition"
              style={{ backgroundColor: PRIMARY }}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Enregistrement...</>
              ) : (
                <><CheckCircle className="h-4 w-4" /> Signer en tant que {signerRole === \'EMPLOYEUR\' ? \'Employeur\' : \'Employé\'}</>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
'''

for target in TARGETS:
    if not target.exists():
        print(f'WARN: file not found, skipping: {target}')
        continue
    target.write_text(NEW_MODAL_CONTENT, encoding='utf-8')
    print(f'OK wrote {len(NEW_MODAL_CONTENT)} bytes -> {target}')

print('\nDone. Both ContractSignModal.tsx files have been patched.')
