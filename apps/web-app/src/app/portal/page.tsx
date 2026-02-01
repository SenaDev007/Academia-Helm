/**
 * ============================================================================
 * PORTAL ACCESS PAGE - ACCÉDER À UN PORTAIL
 * ============================================================================
 * 
 * Page centrale pour accéder aux différents portails Academia Hub
 * 3 cartes : École, Enseignant, Parents & Élèves
 * 
 * ============================================================================
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, GraduationCap, Users, Search, ArrowRight, Shield, CheckCircle, Code2 } from 'lucide-react';
import PremiumHeader from '@/components/layout/PremiumHeader';
import SchoolSearch from '@/components/portal/SchoolSearch';
import { useTenantRedirect } from '@/lib/hooks/useTenantRedirect';

type PortalType = 'SCHOOL' | 'TEACHER' | 'PARENT' | null;

interface School {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  city?: string;
  schoolType?: string;
}

export default function PortalPage() {
  const [selectedPortal, setSelectedPortal] = useState<PortalType>(null);
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isDevLoggingIn, setIsDevLoggingIn] = useState(false);
  const { redirectToTenant } = useTenantRedirect();
  const router = useRouter();

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

  const handleDevLogin = async () => {
    setIsDevLoggingIn(true);
    try {
      // Récupérer les informations du tenant de test
      const tenantResponse = await fetch('/api/dev/test-tenant', {
        method: 'GET',
      });

      const tenantData = await tenantResponse.json();

      if (!tenantResponse.ok || !tenantData.success) {
        throw new Error(tenantData.message || 'Impossible de récupérer les informations du tenant de test');
      }

      const testTenant = tenantData.tenant;

      // Rediriger vers la page de login avec le tenant de test
      // L'utilisateur pourra utiliser les identifiants PLATFORM_OWNER
      const loginUrl = `/login?tenant=${encodeURIComponent(testTenant.id || testTenant.slug)}&redirect=/app`;
      router.push(loginUrl);
    } catch (error: any) {
      console.error('[Dev Login] Error:', error);
      alert(`Erreur: ${error.message || 'Impossible de se connecter en mode développement'}`);
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
              Sélectionnez votre espace sécurisé Academia Hub
            </p>
          </div>

          {/* Bouton spécial pour développement et tests */}
          <div className="mb-8 flex justify-center">
            <button
              onClick={handleDevLogin}
              disabled={isDevLoggingIn}
              className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-amber-600 hover:to-orange-600 transition-all duration-300 inline-flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:scale-105 border-2 border-amber-400 relative group disabled:opacity-50 disabled:cursor-not-allowed"
              title="Connexion automatique avec les identifiants PLATFORM_OWNER (développement uniquement)"
            >
              <Code2 className={`w-5 h-5 group-hover:rotate-12 transition-transform duration-300 ${isDevLoggingIn ? 'animate-spin' : ''}`} />
              <span>{isDevLoggingIn ? 'Connexion...' : 'Mode Développement'}</span>
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md animate-pulse">
                DEV
              </span>
            </button>
          </div>

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
              <span>Vous êtes sur un portail officiel sécurisé Academia Hub</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

