'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Save, Loader2, Image as ImageIcon, Droplet, FileText, Palette,
  Check,
} from 'lucide-react';
import { getClientAuthorizationHeader } from '@/lib/auth/client-access-token';
import { getApiBaseUrl } from '@/lib/utils/urls';
import { toast } from '@/components/ui/toast';
import { HRShell } from '../../../_components/HRShell';

const PRIMARY = '#1A2BA6';

// ─── Helpers ──────────────────────────────────────────────────────────────

function getTenantId(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)x-tenant-id=([^;]+)/);
  if (match) return decodeURIComponent(match[1]);
  try {
    const session = JSON.parse(localStorage.getItem('academia_session') || '{}');
    return session?.tenant?.id || session?.user?.tenantId || null;
  } catch { return null; }
}

async function apiFetch(path: string, options?: { method?: string; body?: any }) {
  const baseUrl = getApiBaseUrl();
  const url = `${baseUrl}${path.startsWith('/') ? path : '/' + path}`;
  const res = await fetch(url, {
    method: options?.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', ...getClientAuthorizationHeader() },
    credentials: 'include',
    cache: 'no-store',
    ...(options?.body && { body: JSON.stringify(options.body) }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(JSON.parse(text)?.message || `HTTP ${res.status}`);
  return text ? JSON.parse(text) : null;
}

// ─── Types ────────────────────────────────────────────────────────────────

interface DocConfig {
  header_logo_url: string | null;
  header_logo_position: string;
  header_logo_max_height: number;
  header_show_school_name: boolean;
  header_show_address: boolean;
  header_show_contact: boolean;
  header_show_authorization_number: boolean;
  header_show_decorative_line: boolean;
  header_decorative_line_color: string;
  header_background_color: string;
  watermark_text: string | null;
  watermark_opacity: number;
  watermark_font_size: number;
  watermark_rotation: number;
  watermark_color: string;
  footer_show_academia_signature: boolean;
  footer_show_page_number: boolean;
  footer_show_contract_ref: boolean;
  footer_show_qr_code: boolean;
  footer_background_color: string;
  footer_accent_color: string;
  style_primary_color: string;
  style_accent_color: string;
  style_font_family: string;
  style_title_font_size: number;
  style_body_font_size: number;
  style_line_height: number;
  style_margin_top: number;
  style_margin_bottom: number;
  style_margin_left: number;
  style_margin_right: number;
  [key: string]: any;
}

// ─── Composants UI ────────────────────────────────────────────────────────

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-2 cursor-pointer">
      <span className="text-sm text-slate-700">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-slate-300'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </label>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 rounded border border-slate-200 cursor-pointer"
        />
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-mono"
        />
      </div>
    </div>
  );
}

function NumberInput({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value ?? 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
        />
        {suffix && <span className="text-xs text-slate-400">{suffix}</span>}
      </div>
    </div>
  );
}

function SelectInput({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function TextInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
      />
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────

export default function DocumentConfigPage() {
  const [config, setConfig] = useState<DocConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'header' | 'watermark' | 'footer' | 'style'>('header');

  const fetchConfig = useCallback(async () => {
    const tenantId = getTenantId();
    if (!tenantId) { toast({ variant: 'error', title: 'Tenant ID non trouvé' }); return; }
    try {
      setLoading(true);
      const data = await apiFetch(`/hr/contract-document-config?tenantId=${tenantId}`);
      setConfig(data);
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err.message });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  function update(field: string, value: any) {
    setConfig(prev => prev ? { ...prev, [field]: value } : prev);
  }

  async function handleSave() {
    const tenantId = getTenantId();
    if (!tenantId || !config) return;
    setSaving(true);
    try {
      await apiFetch(`/hr/contract-document-config?tenantId=${tenantId}`, { method: 'PUT', body: config });
      toast({ variant: 'success', title: 'Configuration sauvegardée !' });
    } catch (err: any) {
      toast({ variant: 'error', title: 'Erreur', description: err.message });
    } finally { setSaving(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!config) {
    return <div className="p-8 text-center text-slate-500">Erreur de chargement de la configuration.</div>;
  }

  const tabs = [
    { id: 'header' as const, label: 'En-tête', icon: ImageIcon },
    { id: 'watermark' as const, label: 'Filigrane', icon: Droplet },
    { id: 'footer' as const, label: 'Pied de page', icon: FileText },
    { id: 'style' as const, label: 'Style', icon: Palette },
  ];

  return (
    <HRShell activeId="contract-config" title="Configuration des contrats" description="Personnalisez l'apparence de vos contrats (en-tête, filigrane, pied de page, style).">
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configuration des contrats</h1>
          <p className="text-sm text-slate-500 mt-1">Personnalisez l'apparence de vos contrats (en-tête, filigrane, pied de page, style).</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl shadow-sm hover:opacity-90 disabled:opacity-50 transition"
          style={{ backgroundColor: PRIMARY }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Sauvegarder
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition ${
                activeTab === tab.id ? 'border-[#1A2BA6] text-[#1A2BA6]' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">

        {/* ─── En-tête ─── */}
        {activeTab === 'header' && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-slate-900">En-tête du contrat</h2>
            <SelectInput label="Position du logo" value={config.header_logo_position} onChange={v => update('header_logo_position', v)}
              options={[{ value: 'left', label: 'Gauche' }, { value: 'center', label: 'Centre' }, { value: 'right', label: 'Droite' }]} />
            <NumberInput label="Hauteur max du logo" value={config.header_logo_max_height} onChange={v => update('header_logo_max_height', v)} suffix="px" />
            <ColorInput label="Couleur de fond" value={config.header_background_color} onChange={v => update('header_background_color', v)} />
            <ColorInput label="Couleur ligne décorative" value={config.header_decorative_line_color} onChange={v => update('header_decorative_line_color', v)} />
            <div className="border-t border-slate-100 pt-4 space-y-1">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Éléments affichés</p>
              <Toggle label="Nom de l'école" checked={config.header_show_school_name} onChange={v => update('header_show_school_name', v)} />
              <Toggle label="Adresse" checked={config.header_show_address} onChange={v => update('header_show_address', v)} />
              <Toggle label="Contact (téléphone + email)" checked={config.header_show_contact} onChange={v => update('header_show_contact', v)} />
              <Toggle label="Numéro d'autorisation" checked={config.header_show_authorization_number} onChange={v => update('header_show_authorization_number', v)} />
              <Toggle label="Ligne décorative" checked={config.header_show_decorative_line} onChange={v => update('header_show_decorative_line', v)} />
            </div>
          </div>
        )}

        {/* ─── Filigrane ─── */}
        {activeTab === 'watermark' && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-slate-900">Filigrane</h2>
            <TextInput label="Texte du filigrane" value={config.watermark_text || ''} onChange={v => update('watermark_text', v)} placeholder="Ex: Mon École ou CONFIDENTIEL" />
            <div className="grid grid-cols-2 gap-4">
              <NumberInput label="Opacité" value={config.watermark_opacity} onChange={v => update('watermark_opacity', v)} suffix="(0.01-1)" />
              <NumberInput label="Taille" value={config.watermark_font_size} onChange={v => update('watermark_font_size', v)} suffix="pt" />
              <NumberInput label="Rotation" value={config.watermark_rotation} onChange={v => update('watermark_rotation', v)} suffix="°" />
              <ColorInput label="Couleur" value={config.watermark_color} onChange={v => update('watermark_color', v)} />
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-xs text-slate-500 mb-2">Aperçu :</p>
              <div className="relative h-24 flex items-center justify-center overflow-hidden rounded-lg bg-white border border-slate-100">
                <span style={{
                  fontSize: `${config.watermark_font_size / 3}pt`,
                  opacity: config.watermark_opacity,
                  color: config.watermark_color,
                  transform: `rotate(${config.watermark_rotation}deg)`,
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                }}>
                  {config.watermark_text || 'ACADEMIA HELM'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ─── Pied de page ─── */}
        {activeTab === 'footer' && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-slate-900">Pied de page</h2>
            <div className="space-y-1">
              <Toggle label="Signature Academia Helm" checked={config.footer_show_academia_signature} onChange={v => update('footer_show_academia_signature', v)} />
              <Toggle label="Numéro de page" checked={config.footer_show_page_number} onChange={v => update('footer_show_page_number', v)} />
              <Toggle label="Référence du contrat" checked={config.footer_show_contract_ref} onChange={v => update('footer_show_contract_ref', v)} />
              <Toggle label="QR code de vérification" checked={config.footer_show_qr_code} onChange={v => update('footer_show_qr_code', v)} />
            </div>
            <div className="border-t border-slate-100 pt-4 grid grid-cols-2 gap-4">
              <ColorInput label="Couleur de fond" value={config.footer_background_color} onChange={v => update('footer_background_color', v)} />
              <ColorInput label="Couleur accent" value={config.footer_accent_color} onChange={v => update('footer_accent_color', v)} />
            </div>
          </div>
        )}

        {/* ─── Style ─── */}
        {activeTab === 'style' && (
          <div className="space-y-5">
            <h2 className="text-lg font-bold text-slate-900">Style visuel</h2>
            <div className="grid grid-cols-2 gap-4">
              <ColorInput label="Couleur principale" value={config.style_primary_color} onChange={v => update('style_primary_color', v)} />
              <ColorInput label="Couleur accent" value={config.style_accent_color} onChange={v => update('style_accent_color', v)} />
            </div>
            <SelectInput label="Police" value={config.style_font_family} onChange={v => update('style_font_family', v)}
              options={[
                { value: "'Times New Roman', serif", label: 'Times New Roman (serif)' },
                { value: "'Arial', sans-serif", label: 'Arial (sans-serif)' },
                { value: "'Calibri', sans-serif", label: 'Calibri (sans-serif)' },
                { value: "'Georgia', serif", label: 'Georgia (serif)' },
                { value: "'Garamond', serif", label: 'Garamond (serif)' },
                { value: "'Helvetica', sans-serif", label: 'Helvetica (sans-serif)' },
              ]} />
            <div className="grid grid-cols-2 gap-4">
              <NumberInput label="Taille titres" value={config.style_title_font_size} onChange={v => update('style_title_font_size', v)} suffix="pt" />
              <NumberInput label="Taille corps" value={config.style_body_font_size} onChange={v => update('style_body_font_size', v)} suffix="pt" />
              <NumberInput label="Interligne" value={config.style_line_height} onChange={v => update('style_line_height', v)} suffix="(1.0-2.5)" />
            </div>
            <div className="border-t border-slate-100 pt-4">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Marges de page</p>
              <div className="grid grid-cols-2 gap-4">
                <NumberInput label="Haut" value={config.style_margin_top} onChange={v => update('style_margin_top', v)} suffix="mm" />
                <NumberInput label="Bas" value={config.style_margin_bottom} onChange={v => update('style_margin_bottom', v)} suffix="mm" />
                <NumberInput label="Gauche" value={config.style_margin_left} onChange={v => update('style_margin_left', v)} suffix="mm" />
                <NumberInput label="Droite" value={config.style_margin_right} onChange={v => update('style_margin_right', v)} suffix="mm" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save button (bottom) */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white rounded-xl shadow-sm hover:opacity-90 disabled:opacity-50 transition"
          style={{ backgroundColor: PRIMARY }}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Sauvegarder la configuration
        </button>
      </div>
    </div>
    </HRShell>
  );
}
