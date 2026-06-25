'use client';

/**
 * ============================================================================
 * TENANT STRUCTURED DATA — Données structurées Schema.org
 * ============================================================================
 *
 * Injecte les données structurées JSON-LD pour le référencement Google :
 *   - EducationalOrganization : permet à Google de comprendre que c'est une école
 *   - WebSite : déclare le site web
 *   - BreadcrumbList : navigation hiérarchique
 *
 * Ces données sont lues par Google pour afficher des "rich snippets"
 * dans les résultats de recherche (note, logo, adresse, etc.)
 * ============================================================================
 */

interface TenantStructuredDataProps {
  schoolName: string;
  schoolLogo?: string | null;
  schoolAddress?: string | null;
  schoolPhone?: string | null;
  schoolEmail?: string | null;
  schoolWebsite?: string;
  schoolSlogan?: string | null;
  schoolCity?: string | null;
  socialLinks?: Record<string, string> | null;
}

export default function TenantStructuredData({
  schoolName,
  schoolLogo,
  schoolAddress,
  schoolPhone,
  schoolEmail,
  schoolWebsite,
  schoolSlogan,
  schoolCity,
  socialLinks,
}: TenantStructuredDataProps) {
  // ─── EducationalOrganization ──
  const educationalOrg: any = {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    name: schoolName,
    url: schoolWebsite,
  };

  if (schoolLogo) educationalOrg.logo = schoolLogo;
  if (schoolSlogan) educationalOrg.slogan = schoolSlogan;
  if (schoolAddress || schoolCity) {
    educationalOrg.address = {
      '@type': 'PostalAddress',
      ...(schoolAddress ? { streetAddress: schoolAddress } : {}),
      ...(schoolCity ? { addressLocality: schoolCity } : {}),
      addressCountry: 'BJ',
    };
  }
  if (schoolPhone) educationalOrg.telephone = schoolPhone;
  if (schoolEmail) educationalOrg.email = schoolEmail;

  // Réseaux sociaux
  const socialUrls: string[] = [];
  if (socialLinks) {
    for (const [, url] of Object.entries(socialLinks)) {
      if (url && typeof url === 'string' && url.trim()) {
        socialUrls.push(url.trim());
      }
    }
  }
  if (socialUrls.length > 0) {
    educationalOrg.sameAs = socialUrls;
  }

  // ─── WebSite ──
  const website: any = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: schoolName,
    url: schoolWebsite,
  };

  if (schoolLogo) {
    website.publisher = {
      '@type': 'EducationalOrganization',
      name: schoolName,
      logo: schoolLogo,
    };
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(educationalOrg) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }}
      />
    </>
  );
}
