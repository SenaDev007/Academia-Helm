'use client';

/**
 * CmsShared — Shared UI primitives for the 5 CMS module pages
 * (blog, cms-pages, legal-pages, seo, media).
 *
 * Centralizes the modal shell, delete confirmation modal, form field
 * wrappers, toggle, and error/success banners so each PAGE file stays
 * compact (< 400 lines) and visually consistent.
 *
 * All modals use the spec'd wrapper: `fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4`.
 */

import { ReactNode } from 'react';
import { Loader2, X, AlertCircle, Check, Trash2 } from 'lucide-react';

// === Shared class names ===

export const inputClass =
  'w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500';
export const monoInputClass =
  'w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500';
export const btnPrimary =
  'flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white shadow-md transition-all';
export const btnDanger =
  'flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white shadow-md transition-all';
export const btnGhost =
  'px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50';
export const iconBtnEdit =
  'p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-900 transition-colors';
export const iconBtnDelete =
  'p-1.5 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors';

// === Form field wrapper ===

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
        {label}{required && ' *'}
      </label>
      {children}
      {hint && <p className="text-[11px] text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

// === Toggle switch (accessible) ===

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${checked ? 'bg-amber-500' : 'bg-slate-300'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
      <span className="text-sm font-semibold text-slate-700">{label}</span>
    </label>
  );
}

// === Banners ===

export function ErrorBanner({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{msg}</span>
    </div>
  );
}

export function SuccessBanner({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
      <Check className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{msg}</span>
    </div>
  );
}

// === Modal shell ===

export function ModalShell({
  title,
  subtitle,
  onClose,
  disabled,
  children,
  footer,
  maxWidth = 'max-w-2xl',
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  disabled?: boolean;
  children: ReactNode;
  footer: ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between p-6 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-bold text-blue-900">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            disabled={disabled}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {children}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100 sticky bottom-0 bg-white">
            {footer}
          </div>
        </div>
      </div>
    </div>
  );
}

// === Delete confirmation modal ===

export function DeleteConfirmModal({
  title = 'Supprimer',
  description,
  onConfirm,
  onCancel,
  deleting,
  error,
}: {
  title?: string;
  description: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
  error: string | null;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-blue-900">{title}</h2>
          </div>
          <button
            onClick={onCancel}
            disabled={deleting}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">{description}</p>
          {error && <ErrorBanner msg={error} />}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <button type="button" onClick={onCancel} disabled={deleting} className={btnGhost}>
              Annuler
            </button>
            <button type="button" onClick={onConfirm} disabled={deleting} className={btnDanger}>
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Supprimer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
