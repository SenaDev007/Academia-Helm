/**
 * Login Page Component - Multi-Portal Support
 * 
 * Gère les 3 types de portails :
 * - SCHOOL: Email + Password
 * - TEACHER: Matricule + Password
 * - PARENT: Téléphone + OTP (2 étapes)
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Loader, AlertCircle, Mail, Lock, User, Phone, KeyRound, Building2, GraduationCap, Users } from 'lucide-react';

type PortalType = 'school' | 'teacher' | 'parent' | null;

interface SchoolCredentials {
  email: string;
  password: string;
}

interface TeacherCredentials {
  teacherIdentifier: string;
  password: string;
}

interface ParentCredentials {
  phone: string;
  otp?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Récupérer les paramètres de l'URL (tenant_id = UUID pour l'API, tenant = slug pour affichage/compat)
  const portalParam = searchParams?.get('portal')?.toLowerCase() as PortalType;
  const tenantSlug = searchParams?.get('tenant');
  const tenantIdFromUrl = searchParams?.get('tenant_id');
  const tenantIdForApi = tenantIdFromUrl || tenantSlug;
  const redirectPath = searchParams?.get('redirect') || '/app';

  // État pour le type de portail
  const [portalType, setPortalType] = useState<PortalType>(portalParam || null);
  
  // États pour les formulaires
  const [schoolCredentials, setSchoolCredentials] = useState<SchoolCredentials>({
    email: '',
    password: '',
  });
  
  const [teacherCredentials, setTeacherCredentials] = useState<TeacherCredentials>({
    teacherIdentifier: '',
    password: '',
  });
  
  const [parentCredentials, setParentCredentials] = useState<ParentCredentials>({
    phone: '',
    otp: '',
  });
  
  const [parentOtpSent, setParentOtpSent] = useState(false);
  const [parentOtpCode, setParentOtpCode] = useState<string>(''); // Pour afficher l'OTP en dev
  
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Si pas de type de portail, utiliser le login standard
  const isStandardLogin = !portalType;

  // Gestion de la soumission selon le type de portail
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (isStandardLogin) {
        // Login standard (email + password)
        await handleStandardLogin();
      } else if (portalType === 'school') {
        await handleSchoolLogin();
      } else if (portalType === 'teacher') {
        await handleTeacherLogin();
      } else if (portalType === 'parent') {
        await handleParentLogin();
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la connexion');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStandardLogin = async () => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: schoolCredentials.email,
        password: schoolCredentials.password,
        tenantSubdomain: tenantSlug,
        tenant_id: tenantIdFromUrl || undefined,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Erreur lors de la connexion');
    }

    // Plateforme Owner sans tenant : rediriger vers la sélection d'établissement
    const isPlatformOwner = data.user?.role === 'PLATFORM_OWNER' || (data.user as any)?.isPlatformOwner;
    const hasNoTenant = !data.tenant?.id;
    if (isPlatformOwner && hasNoTenant) {
      const params = new URLSearchParams();
      if (redirectPath !== '/app') params.set('redirect', redirectPath);
      window.location.href = params.toString() ? `/auth/select-tenant?${params.toString()}` : '/auth/select-tenant';
      return;
    }

    // Construire l'URL de redirection avec tenant et tenant_id si présents
    let redirectUrl = redirectPath;
    if (tenantSlug || tenantIdFromUrl) {
      const params = new URLSearchParams();
      if (tenantSlug) {
        params.set('tenant', tenantSlug);
      }
      if (tenantIdFromUrl) {
        params.set('tenant_id', tenantIdFromUrl);
      }
      redirectUrl = `${redirectPath}?${params.toString()}`;
    }
    window.location.href = redirectUrl;
  };

  const handleSchoolLogin = async () => {
    if (!tenantIdForApi) {
      throw new Error('Identifiant de l\'établissement manquant');
    }

    const response = await fetch('/api/portal/auth/school', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenantId: tenantIdForApi,
        email: schoolCredentials.email,
        password: schoolCredentials.password,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Erreur lors de la connexion');
    }

    // Ajouter tenant dans l'URL pour que le middleware autorise l'accès à /app
    const redirectUrl = tenantSlug || tenantIdFromUrl
      ? `${redirectPath}?tenant=${encodeURIComponent(tenantSlug || '')}${tenantIdFromUrl ? `&tenant_id=${encodeURIComponent(tenantIdFromUrl)}` : ''}`
      : redirectPath;
    window.location.href = redirectUrl;
  };

  const handleTeacherLogin = async () => {
    if (!tenantIdForApi) {
      throw new Error('Identifiant de l\'établissement manquant');
    }

    const response = await fetch('/api/portal/auth/teacher', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenantId: tenantIdForApi,
        teacherIdentifier: teacherCredentials.teacherIdentifier,
        password: teacherCredentials.password,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Erreur lors de la connexion');
    }

    // Ajouter tenant dans l'URL pour que le middleware autorise l'accès à /app
    const redirectUrl = tenantSlug || tenantIdFromUrl
      ? `${redirectPath}?tenant=${encodeURIComponent(tenantSlug || '')}${tenantIdFromUrl ? `&tenant_id=${encodeURIComponent(tenantIdFromUrl)}` : ''}`
      : redirectPath;
    window.location.href = redirectUrl;
  };

  const handleParentLogin = async () => {
    if (!tenantIdForApi) {
      throw new Error('Identifiant de l\'établissement manquant');
    }

    if (!parentOtpSent) {
      const response = await fetch('/api/portal/auth/parent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantId: tenantIdForApi,
          phone: parentCredentials.phone,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'Erreur lors de l\'envoi du code OTP');
      }

      // Afficher l'OTP en développement
      if (data.otp) {
        setParentOtpCode(data.otp);
      }

      setParentOtpSent(true);
      return;
    }

    const response = await fetch('/api/portal/auth/parent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenantId: tenantIdForApi,
        phone: parentCredentials.phone,
        otp: parentCredentials.otp,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || data.error || 'Code OTP invalide');
    }

    // Ajouter tenant dans l'URL pour que le middleware autorise l'accès à /app
    const redirectUrl = tenantSlug || tenantIdFromUrl
      ? `${redirectPath}?tenant=${encodeURIComponent(tenantSlug || '')}${tenantIdFromUrl ? `&tenant_id=${encodeURIComponent(tenantIdFromUrl)}` : ''}`
      : redirectPath;
    window.location.href = redirectUrl;
  };

  // Déterminer le titre et l'icône selon le type de portail
  const getPortalInfo = () => {
    switch (portalType) {
      case 'school':
        return {
          title: 'Portail École',
          subtitle: 'Direction • Administration • Promoteur',
          icon: Building2,
          iconColor: 'text-blue-600',
        };
      case 'teacher':
        return {
          title: 'Portail Enseignant',
          subtitle: 'Enseignants & Encadreurs',
          icon: GraduationCap,
          iconColor: 'text-green-600',
        };
      case 'parent':
        return {
          title: 'Portail Parents & Élèves',
          subtitle: 'Suivi scolaire & paiements',
          icon: Users,
          iconColor: 'text-purple-600',
        };
      default:
        return {
          title: 'Academia Hub',
          subtitle: 'Connexion à votre espace sécurisé',
          icon: null,
          iconColor: '',
        };
    }
  };

  const portalInfo = getPortalInfo();
  const PortalIcon = portalInfo.icon;

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-blue-50 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-500 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-gold-500 rounded-full blur-3xl animate-pulse [animation-delay:1s]"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-8 md:p-10 border border-blue-100">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-6">
              <Image
                src="/images/logo-Academia Hub.png"
                alt="Academia Hub"
                width={120}
                height={120}
                className="w-24 h-24 md:w-28 md:h-28 object-contain drop-shadow-lg"
                priority
              />
            </div>
            <div className="flex items-center justify-center gap-3 mb-2">
              {PortalIcon && <PortalIcon className={`w-6 h-6 ${portalInfo.iconColor}`} />}
              <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-900 via-blue-700 to-blue-900 bg-clip-text text-transparent">
                {portalInfo.title}
              </h1>
            </div>
            <p className="text-sm text-gray-600 mt-2">{portalInfo.subtitle}</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-50 border-l-4 border-red-500 rounded-lg p-4 flex items-start space-x-3 shadow-sm animate-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* OTP Code Display (Development Only) */}
          {parentOtpSent && parentOtpCode && process.env.NODE_ENV === 'development' && (
            <div className="mb-6 bg-amber-50 border-l-4 border-amber-500 rounded-lg p-4">
              <p className="text-sm font-semibold text-amber-800 mb-1">🔐 Code OTP (DEV ONLY)</p>
              <p className="text-2xl font-bold text-amber-900 text-center">{parentOtpCode}</p>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Portail École - Email + Password */}
            {(isStandardLogin || portalType === 'school') && (
              <>
                <div>
                  <label htmlFor="email" className="block text-sm font-semibold text-gray-900 mb-2">
                    Adresse email
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="email"
                      id="email"
                      required
                      value={schoolCredentials.email}
                      onChange={(e) => setSchoolCredentials({ ...schoolCredentials, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all duration-200 placeholder-gray-400"
                      placeholder="votre.email@etablissement.com"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-gray-900 mb-2">
                    Mot de passe
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="password"
                      id="password"
                      required
                      value={schoolCredentials.password}
                      onChange={(e) => setSchoolCredentials({ ...schoolCredentials, password: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all duration-200 placeholder-gray-400"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Portail Enseignant - Matricule + Password */}
            {portalType === 'teacher' && (
              <>
                <div>
                  <label htmlFor="teacherIdentifier" className="block text-sm font-semibold text-gray-900 mb-2">
                    Matricule / Identifiant
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      id="teacherIdentifier"
                      required
                      value={teacherCredentials.teacherIdentifier}
                      onChange={(e) => setTeacherCredentials({ ...teacherCredentials, teacherIdentifier: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-green-600 transition-all duration-200 placeholder-gray-400"
                      placeholder="EMP001"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="teacherPassword" className="block text-sm font-semibold text-gray-900 mb-2">
                    Mot de passe
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="password"
                      id="teacherPassword"
                      required
                      value={teacherCredentials.password}
                      onChange={(e) => setTeacherCredentials({ ...teacherCredentials, password: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-600 focus:border-green-600 transition-all duration-200 placeholder-gray-400"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Portail Parent - Téléphone + OTP */}
            {portalType === 'parent' && (
              <>
                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-gray-900 mb-2">
                    Numéro de téléphone
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="tel"
                      id="phone"
                      required
                      disabled={parentOtpSent}
                      value={parentCredentials.phone}
                      onChange={(e) => setParentCredentials({ ...parentCredentials, phone: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition-all duration-200 placeholder-gray-400 disabled:bg-gray-100"
                      placeholder="+22912345678"
                    />
                  </div>
                </div>

                {parentOtpSent && (
                  <div>
                    <label htmlFor="otp" className="block text-sm font-semibold text-gray-900 mb-2">
                      Code OTP
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <KeyRound className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        id="otp"
                        required
                        value={parentCredentials.otp || ''}
                        onChange={(e) => setParentCredentials({ ...parentCredentials, otp: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-purple-600 transition-all duration-200 placeholder-gray-400"
                        placeholder="123456"
                        maxLength={6}
                      />
                    </div>
                    <p className="mt-2 text-sm text-gray-600">
                      Un code OTP a été envoyé à votre numéro de téléphone.
                    </p>
                  </div>
                )}
              </>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full bg-gradient-to-r text-white px-6 py-3.5 rounded-lg font-semibold transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 ${
                portalType === 'teacher'
                  ? 'from-green-600 to-green-700 hover:from-green-700 hover:to-green-800'
                  : portalType === 'parent'
                  ? 'from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800'
                  : 'from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader className="w-5 h-5 mr-2 animate-spin" />
                  {parentOtpSent && portalType === 'parent' ? 'Vérification...' : 'Connexion en cours...'}
                </>
              ) : (
                parentOtpSent && portalType === 'parent' ? 'Vérifier le code' : 'Se connecter'
              )}
            </button>
          </form>

          {/* Links */}
          <div className="mt-6 text-center space-y-3">
            {!isStandardLogin && (
              <Link
                href="/portal"
                className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors inline-block"
              >
                ← Retour à la sélection du portail
              </Link>
            )}
            {isStandardLogin && (
              <>
                <Link
                  href="/forgot-password"
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors inline-block"
                >
                  Mot de passe oublié ?
                </Link>
                <p className="text-sm text-gray-600">
                  Pas encore de compte ?{' '}
                  <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-semibold transition-colors">
                    Activer Academia Hub
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
