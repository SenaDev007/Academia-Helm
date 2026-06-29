'use client';

/**
 * ============================================================================
 * ResponsivePreview — Wrapper pour preview responsive (Desktop/Tablette/Mobile)
 * ============================================================================
 *
 * Affiche des boutons pour basculer entre 3 tailles d'écran.
 * Le contenu est rendu dans un conteneur redimensionnable.
 * ============================================================================
 */

import { useState, ReactNode } from 'react';
import { Monitor, Tablet, Smartphone } from 'lucide-react';

type Device = 'desktop' | 'tablet' | 'mobile';

const DEVICE_WIDTHS: Record<Device, string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

interface Props {
  children: ReactNode;
  previewTitle?: string;
}

export function ResponsivePreview({ children, previewTitle = 'Aperçu en direct' }: Props) {
  const [device, setDevice] = useState<Device>('desktop');

  const devices: { id: Device; icon: any; label: string }[] = [
    { id: 'desktop', icon: Monitor, label: 'Desktop' },
    { id: 'tablet', icon: Tablet, label: 'Tablette' },
    { id: 'mobile', icon: Smartphone, label: 'Mobile' },
  ];

  return (
    <div className="lg:sticky lg:top-4 lg:self-start">
      <div className="bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {/* Header avec titre + sélecteur device */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-200/50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{previewTitle}</span>
          </div>
          {/* Sélecteur device */}
          <div className="flex items-center gap-0.5 p-0.5 bg-white rounded-lg">
            {devices.map((d) => {
              const Icon = d.icon;
              const isActive = device === d.id;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDevice(d.id)}
                  className={`p-1.5 rounded-md transition ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                  title={d.label}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              );
            })}
          </div>
        </div>
        {/* Zone de preview redimensionnable */}
        <div className="p-4 max-h-[70vh] overflow-y-auto flex justify-center">
          <div
            className="transition-all duration-300 ease-in-out w-full"
            style={{ maxWidth: DEVICE_WIDTHS[device] }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
