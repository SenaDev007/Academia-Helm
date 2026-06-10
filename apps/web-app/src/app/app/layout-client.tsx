/**
 * App Layout Client Component
 * 
 * Composant client pour gérer le flow post-login
 * Wrapper autour du layout serveur
 * 
 * v2: Ajout d'un Error Boundary pour éviter la page blanche en cas d'erreur
 * de rendu ou d'hydration (problème fréquent sur mobile).
 */

'use client';

import { Suspense, Component, ReactNode, useState } from 'react';
import { PostLoginFlowWrapper } from '@/components/loading/PostLoginFlowWrapper';
import { QueryProvider } from '@/providers/QueryProvider';
import { SettingsBootstrapPrefetch } from '@/components/settings/SettingsBootstrapPrefetch';
import { AppSessionProvider } from '@/contexts/AppSessionContext';
import { AcademicYearProvider } from '@/contexts/AcademicYearContext';
import { SchoolLevelProvider } from '@/contexts/SchoolLevelContext';
// motion.div wrapper removed — was causing animation delay on every navigation
import type { User, Tenant } from '@/types';
import { ReviewPromptHost } from '@/components/reviews/ReviewPromptHost';
import { AlertCircle, RefreshCw } from 'lucide-react';

export interface AppLayoutClientProps {
  children: React.ReactNode;
  user: User;
  tenant: Tenant;
}

// ─── Error Boundary ────────────────────────────────────────────────────────
// Empêche la page blanche en capturant les erreurs de rendu/hydratation.
// Sur mobile, ces erreurs sont plus fréquentes (réseau lent, hydration async).

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AppErrorBoundary] Render error caught:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    // Hard reload to recover from the error
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
          <div className="w-full max-w-md rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100">
              <AlertCircle className="h-7 w-7 text-rose-600" />
            </div>
            <h2 className="mb-2 text-lg font-bold text-slate-900">
              Erreur inattendue
            </h2>
            <p className="mb-6 text-sm text-slate-600">
              Une erreur s&apos;est produite lors du chargement de l&apos;application.
              Veuillez recharger la page.
            </p>
            <button
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 rounded-xl bg-[#1A2BA6] px-6 py-3 text-sm font-bold text-white shadow-md hover:opacity-90 transition"
            >
              <RefreshCw className="h-4 w-4" />
              Recharger l&apos;application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Layout client pour l'application
 * 
 * Gère le flow post-login avant d'afficher le contenu.
 * AppSessionProvider expose user/tenant aux pages (ex. paramètres en mode PO).
 */
export default function AppLayoutClient({
  children,
  user,
  tenant,
}: AppLayoutClientProps) {
  return (
    <AppErrorBoundary>
      <QueryProvider>
        <AppSessionProvider user={user} tenant={tenant}>
          <Suspense fallback={null}>
            <SettingsBootstrapPrefetch />
          </Suspense>
          <Suspense fallback={null}>
            <AcademicYearProvider>
              <SchoolLevelProvider>
                <ReviewPromptHost user={user} tenant={tenant}>
                  <PostLoginFlowWrapper user={user} tenant={tenant}>
                    {children}
                  </PostLoginFlowWrapper>
                </ReviewPromptHost>
              </SchoolLevelProvider>
            </AcademicYearProvider>
          </Suspense>
        </AppSessionProvider>
      </QueryProvider>
    </AppErrorBoundary>
  );
}
