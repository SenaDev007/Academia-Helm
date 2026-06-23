'use client';

/**
 * ============================================================================
 * PAGE PUBLIQUE — CARTE PROFESSIONNELLE — /staff-card/[token]
 * ============================================================================
 *
 * Le visiteur accède à cette page en scannant le QR code de la carte.
 *
 * Flow :
 *   GET /api/staff-card/:token → infos carte (staff + school + photo)
 *
 * Identité visuelle Helm : header bleu (NAVY→BLUE), body blanc, accents GOLD.
 * ============================================================================
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import {
  Loader2, AlertCircle, ShieldCheck, Mail, Phone, Hash, Building2, MapPin,
} from 'lucide-react';
import { PublicShell, HELM_NAVY, HELM_BLUE, HELM_GOLD } from '@/components/public/PublicShell';

type PageState = 'loading' | 'valid' | 'not-found' | 'error';

interface CardInfo {
  token: string;
  cardType: string;
  staffName: string;
  staffPosition: string;
  staffMatricule: string;
  staffEmail: string;
  staffPhone: string;
  staffPhotoUrl: string;
  schoolName: string;
  schoolLogoUrl: string;
  tenantSubdomain: string;
}

export default function StaffCardPage() {
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<PageState>('loading');
  const [card, setCard] = useState<CardInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchCard = useCallback(async () => {
    try {
      setState('loading');
      const res = await fetch(`/api/staff-card/${token}`);
      const data = await res.json();
      if (!res.ok) {
        const msg = (data.message || data.error || '').toLowerCase();
        if (msg.includes('introuvable') || msg.includes('invalide') || msg.includes('not found')) {
          setState('not-found');
        } else {
          setErrorMsg(data.message || data.error || 'Erreur');
          setState('error');
        }
        return;
      }
      setCard(data);
      setState('valid');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur réseau');
      setState('error');
    }
  }, [token]);

  useEffect(() => { fetchCard(); }, [fetchCard]);

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (state === 'loading') {
    return (
      <PublicShell schoolName="Academia Helm" subtitle="Carte professionnelle">
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-12 h-12 animate-spin" style={{ color: HELM_BLUE }} />
          <p className="text-sm text-slate-500">Vérification de la carte...</p>
        </div>
      </PublicShell>
    );
  }

  // ─── Error ───────────────────────────────────────────────────────────────
  if (state === 'error' || state === 'not-found') {
    return (
      <PublicShell schoolName="Academia Helm" subtitle="Carte professionnelle">
        <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg p-8 text-center">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-slate-900 mb-2">
            {state === 'not-found' ? 'Carte invalide' : 'Une erreur est survenue'}
          </h1>
          <p className="text-sm text-slate-500">
            {state === 'not-found'
              ? 'Cette carte professionnelle est invalide, révoquée ou introuvable. Vérifiez le QR code scanné.'
              : errorMsg}
          </p>
        </div>
      </PublicShell>
    );
  }

  if (!card) return null;

  // ─── Valid ───────────────────────────────────────────────────────────────
  const initials = card.staffName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  return (
    <PublicShell
      schoolName={card.schoolName || 'Academia Helm'}
      schoolLogoUrl={card.schoolLogoUrl}
      subtitle="Carte professionnelle"
      maxWidthClass="max-w-md"
    >
      <div className="space-y-5">
        {/* Carte — recto (style Helm identique au PDF) */}
        <div
          className="relative rounded-2xl overflow-hidden shadow-2xl"
          style={{ background: `linear-gradient(160deg, ${HELM_NAVY} 0%, ${HELM_BLUE} 100%)` }}
        >
          {/* Halo décoratif */}
          <div className="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-20 blur-3xl" style={{ background: HELM_GOLD }} aria-hidden />

          {/* Header carte */}
          <div className="p-5 text-center border-b-2" style={{ borderColor: HELM_GOLD }}>
            {card.schoolLogoUrl ? (
              <img
                src={card.schoolLogoUrl}
                alt={card.schoolName}
                className="h-10 max-w-[120px] object-contain mx-auto mb-2 bg-white/95 p-1 rounded"
              />
            ) : null}
            <h2 className="text-[10px] uppercase tracking-wider font-bold" style={{ color: HELM_GOLD }}>
              {card.schoolName}
            </h2>
          </div>

          {/* Body carte */}
          <div className="p-6 text-center text-white">
            {card.staffPhotoUrl ? (
              <div className="w-24 h-24 rounded-full border-4 mx-auto mb-3 overflow-hidden bg-white" style={{ borderColor: HELM_GOLD }}>
                <img src={card.staffPhotoUrl} alt={card.staffName} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-full border-4 mx-auto mb-3 flex items-center justify-center text-3xl font-bold text-white/70" style={{ borderColor: HELM_GOLD, background: 'rgba(255,255,255,0.1)' }}>
                {initials}
              </div>
            )}
            <h1 className="text-xl font-bold">{card.staffName}</h1>
            <p className="text-sm text-blue-100 mt-1">{card.staffPosition}</p>
            <div className="inline-block mt-3 px-3 py-1 rounded-full text-[11px] font-bold" style={{ background: `${HELM_GOLD}20`, color: HELM_GOLD }}>
              Matricule : {card.staffMatricule}
            </div>
          </div>

          {/* Footer carte */}
          <div className="px-5 py-3 flex items-center justify-between" style={{ background: 'rgba(0,0,0,0.2)' }}>
            <div className="flex items-center gap-1.5 text-[10px] text-white/70">
              <ShieldCheck className="h-3 w-3" /> Carte professionnelle
            </div>
            <div className="text-[9px] text-white/60 text-right">
              <p>Academia Helm</p>
            </div>
          </div>
        </div>

        {/* Coordonnées */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <h3 className="text-sm font-bold mb-2" style={{ color: HELM_NAVY }}>Coordonnées</h3>
          {card.staffPhone && (
            <a href={`tel:${card.staffPhone}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${HELM_BLUE}15` }}>
                <Phone className="h-4 w-4" style={{ color: HELM_BLUE }} />
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase">Téléphone</p>
                <p className="text-sm font-semibold text-slate-700">{card.staffPhone}</p>
              </div>
            </a>
          )}
          {card.staffEmail && (
            <a href={`mailto:${card.staffEmail}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${HELM_BLUE}15` }}>
                <Mail className="h-4 w-4" style={{ color: HELM_BLUE }} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-slate-400 uppercase">Email</p>
                <p className="text-sm font-semibold text-slate-700 truncate">{card.staffEmail}</p>
              </div>
            </a>
          )}
          <div className="flex items-center gap-3 p-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${HELM_BLUE}15` }}>
              <Hash className="h-4 w-4" style={{ color: HELM_BLUE }} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase">Matricule</p>
              <p className="text-sm font-semibold text-slate-700">{card.staffMatricule}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${HELM_BLUE}15` }}>
              <Building2 className="h-4 w-4" style={{ color: HELM_BLUE }} />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 uppercase">Établissement</p>
              <p className="text-sm font-semibold text-slate-700">{card.schoolName}</p>
            </div>
          </div>
        </div>

        {/* Vérification */}
        <div className="rounded-xl p-4 text-center" style={{ background: `${HELM_GOLD}10`, border: `1px solid ${HELM_GOLD}40` }}>
          <div className="flex items-center justify-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4" style={{ color: HELM_NAVY }} />
            <p className="text-xs font-bold" style={{ color: HELM_NAVY }}>Carte vérifiée</p>
          </div>
          <p className="text-[10px] text-slate-500">
            Cette carte professionnelle a été générée par Academia Helm et est authentique.
          </p>
        </div>
      </div>
    </PublicShell>
  );
}
