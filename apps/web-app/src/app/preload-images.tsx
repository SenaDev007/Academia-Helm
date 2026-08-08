import Script from 'next/script';

/**
 * Preload critical images for faster LCP (Largest Contentful Paint).
 * These images are above the fold on the landing page.
 */
export function PreloadCriticalImages() {
  return (
    <>
      <link rel="preload" as="image" href="/images/Background-SaisieMaster-hero.webp" type="image/webp" fetchPriority="high" />
      <link rel="preload" as="image" href="/images/logo-Academia Hub.webp" type="image/webp" fetchPriority="high" />
    </>
  );
}
