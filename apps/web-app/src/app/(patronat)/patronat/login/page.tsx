/**
 * Page de connexion Patronat
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import PatronatHeader from '@/components/patronat/PatronatHeader';
import AppIcon from '@/components/ui/AppIcon';

export default function PatronatLoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'L\'email est requis';
    }
    if (!formData.password) {
      newErrors.password = 'Le mot de passe est requis';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      // ============================================
      // IDENTIFIANTS PROVISOIRES (TEST)
      // ============================================
      const testCredentials = [
        { email: 'patronat@test.com', password: 'patronat123', role: 'PATRONAT_ADMIN' },
        { email: 'operateur@test.com', password: 'operateur123', role: 'PATRONAT_OPERATOR' },
      ];

      const testUser = testCredentials.find(
        (tc) => tc.email === formData.email && tc.password === formData.password
      );

      if (testUser) {
        // Connexion provisoire réussie - créer une session de test
        const sessionData = {
          user: {
            id: `test-patronat-user-${Date.now()}`,
            email: testUser.email,
            firstName: 'Test',
            lastName: 'Patronat',
            role: testUser.role,
            tenantId: 'test-patronat-tenant-id',
          },
          token: 'test-patronat-token-' + Date.now(),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        };

        // Stocker dans sessionStorage
        sessionStorage.setItem('patronat_session', JSON.stringify(sessionData));
        
        // Rediriger vers le dashboard
        router.push('/patronat/dashboard');
        return;
      }

      // TODO: Appel API connexion patronat
      // const response = await fetch('/api/patronat/login', { ... });
      
      // Si pas d'identifiants de test, afficher erreur
      setErrors({ submit: 'Email ou mot de passe incorrect' });
    } catch (error) {
      console.error('Login error:', error);
      setErrors({ submit: 'Email ou mot de passe incorrect' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PatronatHeader />
      <div className="pt-20 pb-12">
        <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              <Image
                src="/images/logo-Academia Hub.png"
                alt="Academia Helm"
                width={64}
                height={64}
                className="h-16 w-auto"
                priority
              />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Connexion Patronat
            </h1>
            <p className="text-gray-600">
              Accédez à votre espace de gestion des examens
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email institutionnel
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-md ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                  placeholder="contact@patronat.bj"
                />
                {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mot de passe
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={`w-full px-4 py-2 border rounded-md ${
                    errors.password ? 'border-red-300' : 'border-gray-300'
                  } focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                  placeholder="••••••••"
                />
                {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
              </div>

              {errors.submit && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{errors.submit}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-blue-700 text-white rounded-md font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>
            </div>
          </form>

          {/* Identifiants provisoires (TEST) */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs font-semibold text-blue-900 mb-2">🔑 Identifiants provisoires (Test) :</p>
            <div className="text-xs text-blue-800 space-y-1">
              <p>• <strong>patronat@test.com</strong> / patronat123 (Admin)</p>
              <p>• <strong>operateur@test.com</strong> / operateur123 (Opérateur)</p>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Pas encore de compte ?{' '}
              <Link href="/patronat/register" className="text-blue-700 font-semibold hover:text-blue-800">
                Créer un compte Patronat
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

