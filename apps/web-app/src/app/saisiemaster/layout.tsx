/**
 * SaisieMaster — Layout autonome
 *
 * Ce layout est volontairement minimal : il n'inclut NI la navbar
 * NI la sidebar d'Academia Helm, car SaisieMaster embarque sa propre
 * barre de navigation (composants/saisiemaster/landing/navbar).
 *
 * Il :
 *  - Charge le globals.css propre à SaisieMaster (couleurs Bénin + EducMaster)
 *  - Monte le Toaster Sonner (les composants SaisieMaster utilisent `sonner`
 *    directement via `import { toast } from "sonner"`)
 *  - Délègue le rendu à la page SaisieMaster
 */

import './globals.css';
import type { Metadata } from 'next';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { BRAND } from '@/lib/saisiemaster/constants';

export const metadata: Metadata = {
  title: `${BRAND.name} — ${BRAND.tagline}`,
  description: BRAND.description,
  keywords: [
    'EducMaster',
    'Bénin',
    'notes',
    'école',
    'saisie',
    'Excel',
    'importation',
    'CI',
    'CP',
    'CE',
    'CM',
  ],
  authors: [{ name: 'SaisieMaster' }],
  openGraph: {
    title: `${BRAND.name} — Saisie fluide des notes conforme EducMaster`,
    description: 'Importez votre template Excel EducMaster, saisissez les notes de vos élèves en toute fluidité, puis exportez au format officiel. Gratuit, rapide, et conforme au gouvernement béninois.',
    type: 'website',
    images: [
      {
        url: '/images/Background-SaisieMaster-hero.png',
        width: 1200,
        height: 630,
        alt: 'SaisieMaster — Saisie fluide des notes conforme EducMaster',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND.name} — Saisie fluide des notes conforme EducMaster`,
    description: 'Importez votre template Excel EducMaster, saisissez les notes de vos élèves, exportez au format officiel. Gratuit.',
    images: ['/images/Background-SaisieMaster-hero.png'],
  },
};

export default function SaisieMasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground antialiased">
      {children}
      <SonnerToaster position="top-right" richColors />
    </div>
  );
}
