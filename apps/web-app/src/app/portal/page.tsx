/**
 * ============================================================================
 * PORTAL ACCESS PAGE - ACCÉDER À UN PORTAIL
 * ============================================================================
 * 
 * Page centrale pour accéder aux différents portails Academia Helm
 * 3 cartes : École, Enseignant, Parents & Élèves
 * 
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, GraduationCap, Users, ArrowRight, Shield, Code2, X } from 'lucide-react';
import PremiumHeader from '@/components/layout/PremiumHeader';
import SchoolSearch from '@/components/portal/SchoolSearch';
import { useTenantRedirect } from '@/lib/hooks/useTenantRedirect';
import { BRAND } from '@/lib/brand';
import { getSavedEmailForTenant, saveEmailForTenant } from '@/lib/auth/saved-email';

type PortalType = 'SCHOOL' | 'TEACHER' | 'PARENT' | null;

interface School {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  city?: string;
  schoolType?: string;
}

interface DevTenant {
  id: string;
  tenantId: string;
  name: string;
  schoolName: string;
  tenantName: string;
  slug: string;
}

export default function PortalPage() {
  const [selectedPortal, setSelectedPortal] = useState<PortalType>(null);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const [devTenants, setDevTenants] = useState<DevTenant[]>([]);
  const [devTenantsLoading, setDevTenantsLoading] = useState(false);
  const [selectedDevTenant, setSelectedDevTenant] = useState<DevTenant | null>(null);
  const [devEmail, setDevEmail] = useState('');
  const [devPassword, setDevPassword] = useState('');
  const [isDevLoggingIn, setIsDevLoggingIn] = useState(false);
  const { redirectToTenant } = useTenantRedirect();
  const router = useRouter();

  useEffect(() => {
    if (devPanelOpen && devTenants.length === 0) {
      setDevTenantsLoading(true);
      fetch('/api/auth/dev-available-tenants')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setDevTenants(data);
        })
        .catch(() => {})
        .finally(() => setDevTenantsLoading(false));
    }
  }, [devPanelOpen]);

  // Pré-remplir l'email avec le dernier utilisé pour cet établissement (un par tenant, isolation stricte)
  useEffect(() => {
    if (!selectedDevTenant) {
      setDevEmail('');
      return;
    }
    const tenantKey = selectedDevTenant.tenantId || selectedDevTenant.id;
    const lastEmail = getSavedEmailForTenant(tenantKey);
    if (lastEmail) setDevEmail(lastEmail);
    else setDevEmail('');
  }, [selectedDevTenant?.id]);

  const handlePortalSelect = (portal: PortalType) => {
    setSelectedPortal(portal);
    setSelectedSchool(null);
    setSearchQuery('');
  };

  const handleSchoolSelect = (school: School) => {
    setSelectedSchool(school);
  };

  const handleContinue = async () => {
    if (!selectedSchool || !selectedPortal) return;

    // Rediriger vers le tenant avec logging automatique
    await redirectToTenant({
      tenantSlug: selectedSchool.slug,
      tenantId: selectedSchool.id,
      path: '/login',
      portalType: selectedPortal,
      queryParams: { portal: selectedPortal.toLowerCase() },
    });
  };

  const handleBack = () => {
    setSelectedPortal(null);
    setSelectedSchool(null);
    setSearchQuery('');
  };

  const handleDevPanelOpen = () => {
    setDevPanelOpen(true);
    setSelectedDevTenant(null);
    setDevEmail('');
    setDevPassword('');
  };

  const handleDevPanelClose = () => {
    setDevPanelOpen(false);
    setSelectedDevTenant(null);
    setDevEmail('');
    setDevPassword('');
  };

  const handleDevLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevTenant) {
      alert('Veuillez d’abord sélectionner une école.');
      return;
    }
    if (!devEmail.trim() || !devPassword) {
      alert('Veuillez saisir l’email et le mot de passe.');
      return;
    }
    setIsDevLoggingIn(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: devEmail.trim(),
          password: devPassword,
          tenant_id: selectedDevTenant.tenantId || selectedDevTenant.id,
          portal_type: 'PLATFORM',
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Connexion impossible');
      }
      const tenantKey = selectedDevTenant.tenantId || selectedDevTenant.id;
      saveEmailForTenant(devEmail.trim(), tenantKey);
      window.location.href = '/app';
    } catch (error: any) {
      console.error('[Dev Login] Error:', error);
      alert(`Erreur: ${error.message || 'Impossible de se connecter'}`);
      setIsDevLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50">
      <PremiumHeader />
      
      <main className="pt-20 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Accéder à votre portail
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Sélectionnez votre espace sécurisé {BRAND.name}. {BRAND.subtitle}.
            </p>
            <p className="text-base text-gray-500 mt-2 font-medium">
              {BRAND.slogan}
            </p>
          </div>

          {/* Bouton Mode Développement : ouvre le modal (école + identifiants), ne soumet pas */}
          <div className="mb-8 flex justify-center">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDevPanelOpen();
              }}
              className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-amber-600 hover:to-orange-600 transition-all duration-300 inline-flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-105 border-2 border-amber-400 relative group"
              title="Ouvrir la fenêtre : choisir une école puis saisir vos identifiants"
            >
              <Code2 className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />
              <span>Mode Développement</span>
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md animate-pulse">
                DEV
              </span>
            </button>
          </div>

          {/* Modal : 1) Choisir une école  2) Email / Mot de passe → Connexion */}
          {devPanelOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={handleDevPanelClose}>
              <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <Code2 className="w-5 h-5 text-amber-500" />
                    Connexion en mode développement
                  </h3>
                  <button type="button" onClick={handleDevPanelClose} className="text-gray-400 hover:text-gray-600 p-1">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Choisissez d’abord l’école (tenant), puis saisissez vos identifiants pour vous connecter à l’app avec ce contexte.
                </p>
                <form onSubmit={handleDevLogin} className="space-y-4">
                  {/* 1. Sélection de l'école */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">École</label>
                    <select
                      value={selectedDevTenant?.id ?? ''}
                      onChange={(e) => {
                        const t = devTenants.find((x) => x.id === e.target.value);
                        setSelectedDevTenant(t ?? null);
                      }}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      required
                    >
                      <option value="">— Choisir une école —</option>
                      {devTenantsLoading && <option disabled>Chargement…</option>}
                      {!devTenantsLoading && devTenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.schoolName || t.tenantName || t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* 2. Email (mémorisé par établissement : un seul par tenant, jamais les emails d'un autre tenant) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      name={selectedDevTenant ? `email_${selectedDevTenant.id}` : 'email'}
                      autoComplete="email"
                      value={devEmail}
                      onChange={(e) => setDevEmail(e.target.value)}
                      placeholder="votre@email.com"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      required
                    />
                    {selectedDevTenant && getSavedEmailForTenant(selectedDevTenant.tenantId || selectedDevTenant.id) && (
                      <p className="text-xs text-gray-500 mt-1">Dernière connexion pour cet établissement (ce poste uniquement).</p>
                    )}
                  </div>
                  {/* 3. Mot de passe */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
                    <input
                      type="password"
                      value={devPassword}
                      onChange={(e) => setDevPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                      required
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleDevPanelClose}
                      className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isDevLoggingIn}
                      className="flex-1 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDevLoggingIn ? 'Connexion…' : 'Se connecter'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Portal Cards */}
          {!selectedPortal ? (
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              {/* Portail École */}
              <div
                onClick={() => handlePortalSelect('SCHOOL')}
                className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 cursor-pointer border-2 border-transparent hover:border-blue-500 group"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-200 transition-colors">
                    <Building2 className="w-8 h-8 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Portail École
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Direction • Administration • Promoteur
                  </p>
                  <div className="flex items-center text-blue-600 font-medium text-sm group-hover:text-blue-700">
                    <span>Accéder</span>
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>

              {/* Portail Enseignant */}
              <div
                onClick={() => handlePortalSelect('TEACHER')}
                className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 cursor-pointer border-2 border-transparent hover:border-green-500 group"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-green-200 transition-colors">
                    <GraduationCap className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Portail Enseignant
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Enseignants & Encadreurs
                  </p>
                  <div className="flex items-center text-green-600 font-medium text-sm group-hover:text-green-700">
                    <span>Accéder</span>
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>

              {/* Portail Parents & Élèves */}
              <div
                onClick={() => handlePortalSelect('PARENT')}
                className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-8 cursor-pointer border-2 border-transparent hover:border-purple-500 group"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mb-4 group-hover:bg-purple-200 transition-colors">
                    <Users className="w-8 h-8 text-purple-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    Portail Parents & Élèves
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Suivi scolaire & paiements
                  </p>
                  <div className="flex items-center text-purple-600 font-medium text-sm group-hover:text-purple-700">
                    <span>Accéder</span>
                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* School Selection */
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-xl shadow-lg p-8">
                {/* Back Button */}
                <button
                  onClick={handleBack}
                  className="text-gray-600 hover:text-gray-900 mb-6 flex items-center space-x-2"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                  <span>Retour</span>
                </button>

                {/* Portal Header */}
                <div className="mb-6">
                  <div className="flex items-center space-x-3 mb-2">
                    {selectedPortal === 'SCHOOL' && (
                      <>
                        <Building2 className="w-6 h-6 text-blue-600" />
                        <h2 className="text-2xl font-bold text-gray-900">Portail École</h2>
                      </>
                    )}
                    {selectedPortal === 'TEACHER' && (
                      <>
                        <GraduationCap className="w-6 h-6 text-green-600" />
                        <h2 className="text-2xl font-bold text-gray-900">Portail Enseignant</h2>
                      </>
                    )}
                    {selectedPortal === 'PARENT' && (
                      <>
                        <Users className="w-6 h-6 text-purple-600" />
                        <h2 className="text-2xl font-bold text-gray-900">Portail Parents & Élèves</h2>
                      </>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    Recherchez votre établissement pour continuer
                  </p>
                </div>

                {/* School Search */}
                <SchoolSearch
                  onSchoolSelect={handleSchoolSelect}
                  selectedSchool={selectedSchool}
                  portalType={selectedPortal}
                />

                {/* Continue Button */}
                {selectedSchool && (
                  <div className="mt-6">
                    <button
                      onClick={handleContinue}
                      className="w-full bg-blue-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                    >
                      <span>Continuer vers la connexion</span>
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Security Notice */}
          <div className="mt-12 text-center">
            <div className="inline-flex items-center space-x-2 text-sm text-gray-600 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full border border-gray-200">
              <Shield className="w-4 h-4 text-green-600" />
              <span>Vous êtes sur un portail officiel sécurisé {BRAND.name}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

