/**
 * Forgot Password Page Component
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { GraduationCap, Mail, ArrowLeft, Loader, CheckCircle } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // TODO: Intégrer avec l'API backend
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setIsLoading(false);
    setIsSubmitted(true);
  };

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-lg shadow-lg p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-navy-900 rounded-lg mb-4">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-navy-900">Academia Helm</h1>
          <p className="text-sm text-slate-600 mt-2">Réinitialisation du mot de passe</p>
        </div>

        {!isSubmitted ? (
          <>
            <p className="text-sm text-slate-600 mb-6 text-center">
              Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
            </p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-navy-900 focus:border-navy-900"
                  placeholder="votre.email@etablissement.com"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader className="w-5 h-5 mr-2 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5 mr-2" />
                    Envoyer le lien
                  </>
                )}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-navy-900 mb-2">
              Email envoyé
            </h2>
            <p className="text-sm text-slate-600 mb-6">
              Si un compte existe avec cet email, vous recevrez un lien de réinitialisation.
            </p>
          </div>
        )}

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-sm text-crimson-600 hover:text-crimson-500 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à la connexion
          </Link>
        </div>
      </div>
    </div>
  );
}

