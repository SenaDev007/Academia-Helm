/**
 * Admin Dashboard API Route
 * 
 * Récupère les données du dashboard Super Admin
 * Accès strictement réservé au rôle SUPER_ADMIN
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrlForRoutes } from '@/lib/utils/api-urls';
import type { AdminDashboardData } from '@/types';

const API_URL = getApiBaseUrlForRoutes();

/**
 * GET /api/admin/dashboard
 * 
 * Récupère les données consolidées du dashboard Super Admin
 */
export async function GET(_request: NextRequest) {
  try {
    // Vérification du rôle SUPER_ADMIN doit être faite côté backend
    // Le backend vérifie le token JWT et le rôle
    
    const response = await fetch(`${API_URL}/admin/dashboard`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        // Le token JWT sera ajouté par le middleware/intercepteur
      },
    });

    if (!response.ok) {
      if (response.status === 403) {
        return NextResponse.json(
          { error: 'Accès refusé. Rôle SUPER_ADMIN requis.' },
          { status: 403 }
        );
      }
      const error = await response.json().catch(() => ({ message: 'Erreur lors de la récupération' }));
      return NextResponse.json(
        { error: error.message || 'Erreur lors de la récupération du dashboard' },
        { status: response.status }
      );
    }

    const data: AdminDashboardData = await response.json();

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    return NextResponse.json(
      { error: 'Erreur interne' },
      { status: 500 }
    );
  }
}

