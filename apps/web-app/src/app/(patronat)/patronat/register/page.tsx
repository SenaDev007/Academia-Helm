/**
 * Page d'inscription Patronat
 * 
 * Création de compte pour patronats et organismes d'examen
 * Processus en 3 étapes
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import PatronatHeader from '@/components/patronat/PatronatHeader';
import AppIcon from '@/components/ui/AppIcon';
import { cn } from '@/lib/utils';

type OrganismType = 'PATRONAT' | 'ASSOCIATION' | 'ORGANISME_EXAMEN' | 'STRUCTURE_DEPARTEMENTALE';

export default function PatronatRegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    // Étape 1
    name: '',
    region: '',
    organismType: '' as OrganismType | '',
    // Étape 2
    responsibleName: '',
    email: '',
    phone: '',
    // Étape 3
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validateStep = (stepNumber: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (stepNumber === 1) {
      if (!formData.name.trim()) newErrors.name = 'Le nom du patronat est requis';
      if (!formData.region.trim()) newErrors.region = 'Le département/région est requis';
      if (!formData.organismType) newErrors.organismType = 'Le type d\'organisme est requis';
    } else if (stepNumber === 2) {
      if (!formData.responsibleName.trim()) newErrors.responsibleName = 'Le nom du responsable est requis';
      if (!formData.email.trim()) newErrors.email = 'L\'email est requis';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Email invalide';
      }
      if (!formData.phone.trim()) newErrors.phone = 'Le téléphone est requis';
    } else if (stepNumber === 3) {
      if (!formData.password) newErrors.password = 'Le mot de passe est requis';
      if (formData.password.length < 8) {
        newErrors.password = 'Le mot de passe doit contenir au moins 8 caractères';
      }
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Les mots de passe ne correspondent pas';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep(3)) return;

    setLoading(true);
    try {
      // TODO: Appel API création compte patronat
      // const response = await fetch('/api/patronat/register', { ... });
      
      // Redirection vers checkout
      router.push('/patronat/checkout');
    } catch (error) {
      console.error('Registration error:', error);
      setErrors({ submit: 'Une erreur est survenue. Veuillez réessayer.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <PatronatHeader />
      <div className="pt-20 pb-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Logo & Titre */}
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
              Créer un compte Patronat / Organisme d'examen
            </h1>
            <p className="text-gray-600">
              Inscrivez votre organisation pour gérer les examens nationaux
            </p>
          </div>

          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              {[1, 2, 3].map((stepNumber) => (
                <div key={stepNumber} className="flex items-center flex-1">
                  <div className="flex items-center">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold',
                        step >= stepNumber
                          ? 'bg-blue-700 text-white'
                          : 'bg-gray-200 text-gray-600'
                      )}
                    >
                      {stepNumber}
                    </div>
                  </div>
                  {stepNumber < 3 && (
                    <div
                      className={cn(
                        'flex-1 h-0.5 mx-2',
                        step > stepNumber ? 'bg-blue-700' : 'bg-gray-200'
                      )}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            {/* Étape 1 */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom du Patronat *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={cn(
                      'w-full px-4 py-2 border rounded-md',
                      errors.name ? 'border-red-300' : 'border-gray-300',
                      'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    )}
                    placeholder="Ex: Patronat des Écoles Privées du Bénin"
                  />
                  {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Département / Région *
                  </label>
                  <input
                    type="text"
                    value={formData.region}
                    onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                    className={cn(
                      'w-full px-4 py-2 border rounded-md',
                      errors.region ? 'border-red-300' : 'border-gray-300',
                      'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    )}
                    placeholder="Ex: Atlantique"
                  />
                  {errors.region && <p className="mt-1 text-sm text-red-600">{errors.region}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type d'organisme *
                  </label>
                  <select
                    value={formData.organismType}
                    onChange={(e) => setFormData({ ...formData, organismType: e.target.value as OrganismType })}
                    className={cn(
                      'w-full px-4 py-2 border rounded-md',
                      errors.organismType ? 'border-red-300' : 'border-gray-300',
                      'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    )}
                  >
                    <option value="">Sélectionner...</option>
                    <option value="PATRONAT">Patronat d'écoles privées</option>
                    <option value="ASSOCIATION">Association d'écoles</option>
                    <option value="ORGANISME_EXAMEN">Organisme organisateur d'examens</option>
                    <option value="STRUCTURE_DEPARTEMENTALE">Structure départementale/régionale</option>
                  </select>
                  {errors.organismType && (
                    <p className="mt-1 text-sm text-red-600">{errors.organismType}</p>
                  )}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-6 py-2.5 bg-blue-700 text-white rounded-md font-semibold hover:bg-blue-800 transition-colors"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}

            {/* Étape 2 */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom du responsable *
                  </label>
                  <input
                    type="text"
                    value={formData.responsibleName}
                    onChange={(e) => setFormData({ ...formData, responsibleName: e.target.value })}
                    className={cn(
                      'w-full px-4 py-2 border rounded-md',
                      errors.responsibleName ? 'border-red-300' : 'border-gray-300',
                      'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    )}
                    placeholder="Ex: Jean Dupont"
                  />
                  {errors.responsibleName && (
                    <p className="mt-1 text-sm text-red-600">{errors.responsibleName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email institutionnel *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={cn(
                      'w-full px-4 py-2 border rounded-md',
                      errors.email ? 'border-red-300' : 'border-gray-300',
                      'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    )}
                    placeholder="contact@patronat.bj"
                  />
                  {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Téléphone *
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={cn(
                      'w-full px-4 py-2 border rounded-md',
                      errors.phone ? 'border-red-300' : 'border-gray-300',
                      'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    )}
                    placeholder="+229 XX XX XX XX"
                  />
                  {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone}</p>}
                </div>

                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-md font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Précédent
                  </button>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="px-6 py-2.5 bg-blue-700 text-white rounded-md font-semibold hover:bg-blue-800 transition-colors"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}

            {/* Étape 3 */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mot de passe *
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className={cn(
                      'w-full px-4 py-2 border rounded-md',
                      errors.password ? 'border-red-300' : 'border-gray-300',
                      'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    )}
                    placeholder="Minimum 8 caractères"
                  />
                  {errors.password && (
                    <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirmation mot de passe *
                  </label>
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className={cn(
                      'w-full px-4 py-2 border rounded-md',
                      errors.confirmPassword ? 'border-red-300' : 'border-gray-300',
                      'focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    )}
                    placeholder="Répétez le mot de passe"
                  />
                  {errors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                  )}
                </div>

                {errors.submit && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{errors.submit}</p>
                  </div>
                )}

                <div className="flex justify-between">
                  <button
                    type="button"
                    onClick={handleBack}
                    className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-md font-semibold hover:bg-gray-50 transition-colors"
                  >
                    Précédent
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2.5 bg-blue-700 text-white rounded-md font-semibold hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Création...' : 'Créer le compte'}
                  </button>
                </div>
              </div>
            )}
          </form>

          {/* Lien connexion */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Vous avez déjà un compte ?{' '}
              <Link href="/patronat/login" className="text-blue-700 font-semibold hover:text-blue-800">
                Se connecter
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

