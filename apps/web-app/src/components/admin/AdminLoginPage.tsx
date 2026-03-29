/**
 * Admin Login Page Component
 * 
 * Page d'authentification dédiée au Super Admin
 * Design distinct de la page de login des tenants
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Shield, Loader, AlertCircle, Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { adminAuthService, initializeDefaultAdminCredentials } from '@/lib/admin/admin-auth.service';

interface LoginCredentials {
  email: string;
  password: string;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  // Initialiser IndexedDB et les identifiants par défaut au chargement
  useEffect(() => {
    const init = async () => {
      try {
        await initializeDefaultAdminCredentials();
      } catch (err) {
        // Ne pas afficher d'erreur à l'utilisateur pour l'initialisation
        // L'erreur sera gérée lors de la tentative de connexion
        console.error('Erreur lors de l\'initialisation (silencieuse):', err);
      } finally {
        setIsInitializing(false);
      }
    };
    init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // ============================================
      // IDENTIFIANTS PROVISOIRES (TEST)
      // ============================================
      const testCredentials = [
        { email: 'admin@academiahub.com', password: 'admin123' },
        { email: 'superadmin@test.com', password: 'superadmin123' },
      ];

      const testUser = testCredentials.find(
        (tc) => tc.email === credentials.email && tc.password === credentials.password
      );

      if (testUser) {
        // Connexion provisoire réussie - créer une session de test
        const sessionData = {
          user: {
            id: 'super-admin-1',
            email: testUser.email,
            firstName: 'Super',
            lastName: 'Admin',
            role: 'SUPER_ADMIN',
          },
          token: 'super-admin-token',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        };

        sessionStorage.setItem('admin_session', JSON.stringify(sessionData));
        const sessionCookieValue = JSON.stringify(sessionData);
        document.cookie = `academia_session=${sessionCookieValue}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
        document.cookie = `academia_token=${sessionData.token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;

        window.location.href = '/admin';
        return;
      }

      // Si pas d'identifiants de test, vérifier dans IndexedDB
      const isValid = await adminAuthService.verifyCredentials(
        credentials.email,
        credentials.password
      );

      if (!isValid) {
        throw new Error('Email ou mot de passe incorrect');
      }

      // Créer une session pour le super admin
      const sessionData = {
        user: {
          id: 'super-admin-1',
          email: credentials.email,
          firstName: 'Super',
          lastName: 'Admin',
          role: 'SUPER_ADMIN',
        },
        token: 'super-admin-token',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 jours
      };

      // Stocker la session dans sessionStorage
      sessionStorage.setItem('admin_session', JSON.stringify(sessionData));

      // Créer aussi un cookie pour la compatibilité avec le système existant
      // Le système de session s'attend à un JSON stringifié directement dans le cookie
      const sessionCookieValue = JSON.stringify(sessionData);
      document.cookie = `academia_session=${sessionCookieValue}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
      
      // Créer aussi le token cookie
      document.cookie = `academia_token=${sessionData.token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;

      // Utiliser window.location.href pour forcer un rechargement complet
      // Cela garantit que les cookies sont bien pris en compte par le serveur
      window.location.href = '/admin';
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la connexion');
    } finally {
      setIsLoading(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-blue-900 px-4">
        <motion.div
          className="text-center text-white"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <Loader className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Initialisation...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex items-center justify-center bg-blue-900 px-4">
      <div className="w-full max-w-md">
        <motion.div
          className="bg-white rounded-2xl shadow-2xl p-8 border-2 border-gold-500/20"
          initial={{ opacity: 0, y: 18, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
        >
          {/* Logo et Header */}
          <div className="text-center mb-8">
            <motion.div
              className="inline-flex items-center justify-center mb-4"
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Image
                src="/images/logo-Academia Hub.png"
                alt="Academia Helm"
                width={80}
                height={80}
                className="w-20 h-20 object-contain"
                priority
              />
            </motion.div>
            <h1 className="text-3xl font-bold text-blue-900 mb-2">Super Admin</h1>
            <p className="text-sm text-graphite-700">Accès sécurisé au panneau d'administration</p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4 flex items-start space-x-3"
            >
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 font-medium">{error}</p>
            </motion.div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-900 mb-2">
                Email Super Admin
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="email"
                  id="email"
                  required
                  value={credentials.email}
                  onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900 transition-all"
                  placeholder="academiahub.pro@gmail.com"
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
                  value={credentials.password}
                  onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-900 focus:border-blue-900 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <motion.button
              type="submit"
              disabled={isLoading}
              whileHover={{ y: -1.5 }}
              whileTap={{ scale: 0.99 }}
              className="w-full bg-blue-900 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-800 transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {isLoading ? (
                <>
                  <Loader className="w-5 h-5 mr-2 animate-spin" />
                  Connexion...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5 mr-2" />
                  Accéder au panneau admin
                </>
              )}
            </motion.button>
          </form>

          {/* Identifiants provisoires (TEST) */}
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-xs font-semibold text-yellow-900 mb-2">🔑 Identifiants provisoires (Test) :</p>
            <div className="text-xs text-yellow-800 space-y-1">
              <p>• <strong>admin@academiahub.com</strong> / admin123</p>
              <p>• <strong>superadmin@test.com</strong> / superadmin123</p>
            </div>
          </div>

          {/* Security Notice */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800 text-center">
              <Shield className="w-4 h-4 inline mr-1" />
              Accès réservé aux Super Administrateurs uniquement
            </p>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="mt-6 text-center space-y-2">
          <p className="text-sm text-white/80">
            Vous êtes un établissement ?{' '}
            <a href="/login" className="text-gold-400 hover:text-gold-300 font-semibold underline">
              Connexion établissement
            </a>
          </p>
          <p className="text-sm text-white/80">
            <a href="/" className="text-white/90 hover:text-white font-medium underline">
              ← Retour à la page principale
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

