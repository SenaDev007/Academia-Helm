/**
 * Dev Test Tenant API Route
 * 
 * Retourne les informations du tenant de test pour le mode développement
 * Recherche le tenant dans la base de données via le backend
 */

import { NextRequest, NextResponse } from 'next/server';
import { getApiBaseUrl } from '@/lib/utils/urls';

const API_BASE_URL = getApiBaseUrl();

export async function GET(request: NextRequest) {
  // Vérifier que c'est en développement
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { 
        success: false, 
        message: 'Test tenant is only available in development mode' 
      },
      { status: 403 }
    );
  }

  try {
    // Récupérer le slug du tenant de test depuis les variables d'environnement
    const testSchoolSlug = process.env.TEST_SCHOOL_SLUG || process.env.NEXT_PUBLIC_TEST_SCHOOL_SLUG || 'cspeb-eveil-afrique';
    const testSchoolSubdomain = process.env.TEST_SCHOOL_SUBDOMAIN || process.env.NEXT_PUBLIC_TEST_SCHOOL_SUBDOMAIN || 'cspeb';

    // Rechercher le tenant dans la base de données via le backend
    // On utilise l'endpoint de recherche publique
    const searchResponse = await fetch(`${API_BASE_URL}/public/schools/search?q=${encodeURIComponent(testSchoolSlug)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (searchResponse.ok) {
      const schools = await searchResponse.json();
      
      // Trouver le tenant correspondant au slug ou subdomain
      const testTenant = schools.find((school: any) => 
        school.slug === testSchoolSlug || 
        school.subdomain === testSchoolSubdomain ||
        school.slug?.includes(testSchoolSlug) ||
        school.subdomain?.includes(testSchoolSubdomain)
      );

      if (testTenant) {
        return NextResponse.json({
          success: true,
          tenant: {
            id: testTenant.id || testTenant.tenantId,
            slug: testTenant.slug || testSchoolSlug,
            subdomain: testTenant.subdomain || testSchoolSubdomain,
            name: testTenant.name || process.env.TEST_SCHOOL_NAME || 'CSPEB-Eveil d\'Afrique Education',
          },
        });
      }
    }

    // Si la recherche échoue, retourner les valeurs par défaut depuis les variables d'environnement
    const testTenant = {
      id: process.env.TEST_TENANT_ID || process.env.NEXT_PUBLIC_TEST_TENANT_ID || '',
      slug: testSchoolSlug,
      subdomain: testSchoolSubdomain,
      name: process.env.TEST_SCHOOL_NAME || process.env.NEXT_PUBLIC_TEST_SCHOOL_NAME || 'CSPEB-Eveil d\'Afrique Education',
    };

    return NextResponse.json({
      success: true,
      tenant: testTenant,
    });
  } catch (error: any) {
    console.error('[Test Tenant API] Error:', error);
    
    // En cas d'erreur, retourner les valeurs par défaut
    const testTenant = {
      id: process.env.TEST_TENANT_ID || process.env.NEXT_PUBLIC_TEST_TENANT_ID || '',
      slug: process.env.TEST_SCHOOL_SLUG || process.env.NEXT_PUBLIC_TEST_SCHOOL_SLUG || 'cspeb-eveil-afrique',
      subdomain: process.env.TEST_SCHOOL_SUBDOMAIN || process.env.NEXT_PUBLIC_TEST_SCHOOL_SUBDOMAIN || 'cspeb',
      name: process.env.TEST_SCHOOL_NAME || process.env.NEXT_PUBLIC_TEST_SCHOOL_NAME || 'CSPEB-Eveil d\'Afrique Education',
    };

    return NextResponse.json({
      success: true,
      tenant: testTenant,
    });
  }
}
