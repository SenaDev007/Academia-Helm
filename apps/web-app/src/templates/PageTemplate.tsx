/**
 * Template de Page avec SEO Automatique
 * 
 * Utilisez ce template pour créer de nouvelles pages publiques
 * Les métadonnées SEO sont automatiquement générées
 */

import { Metadata } from 'next';
import { generateSEOMetadata } from '@/lib/seo';
import { Header } from '@/components/ui/header-1';
import { Footer2 } from '@/components/ui/footer-2';

interface PageTemplateProps {
  title: string;
  description: string;
  keywords?: string[];
  path: string;
  image?: string;
  noIndex?: boolean;
  children: React.ReactNode;
  showHeader?: boolean;
  showFooter?: boolean;
}

export function generatePageMetadata(props: Omit<PageTemplateProps, 'children' | 'showHeader' | 'showFooter'>): Metadata {
  return generateSEOMetadata({
    title: props.title,
    description: props.description,
    keywords: props.keywords,
    path: props.path,
    image: props.image,
    noIndex: props.noIndex,
  });
}

export default function PageTemplate({
  title,
  description,
  keywords = [],
  path,
  image,
  noIndex = false,
  children,
  showHeader = true,
  showFooter = true,
}: PageTemplateProps) {
  return (
    <>
      {showHeader && <Header />}
      <main className="min-h-screen bg-white">
        {children}
      </main>
      {showFooter && <Footer2 />}
    </>
  );
}

