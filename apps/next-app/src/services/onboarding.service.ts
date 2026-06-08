/**
 * Onboarding Service
 * 
 * Service pour gérer le processus d'onboarding complet
 */

interface OnboardingData {
  // Informations établissement
  schoolName: string;
  schoolType: string;
  address?: string;
  city?: string;
  country: string;
  phone: string;
  email: string;
  
  // Responsable principal
  responsibleName: string;
  responsibleEmail: string;
  responsiblePhone: string;
  password: string;
  
  // Paiement
  paymentId?: string;
  paymentStatus: 'pending' | 'completed' | 'failed';
}

interface OnboardingResponse {
  success: boolean;
  tenant: {
    id: string;
    name: string;
    subdomain: string;
    status: string;
  };
  user: {
    id: string;
    email: string;
  };
  redirectUrl: string;
}

/**
 * Crée un établissement complet (tenant + utilisateur)
 */
export async function createEstablishment(data: OnboardingData): Promise<OnboardingResponse> {
  const response = await fetch('/api/onboarding', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur lors de la création' }));
    throw new Error(error.error || 'Erreur lors de la création de l\'établissement');
  }

  return response.json();
}

/**
 * Vérifie la disponibilité d'un sous-domaine
 */
export async function checkSubdomainAvailability(subdomain: string): Promise<{ available: boolean; error?: string }> {
  const response = await fetch(`/api/onboarding/check-subdomain?subdomain=${encodeURIComponent(subdomain)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur lors de la vérification' }));
    return { available: false, error: error.error };
  }

  return response.json();
}

