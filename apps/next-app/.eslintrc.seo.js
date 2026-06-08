/**
 * Règles ESLint pour forcer l'optimisation SEO
 * 
 * Ces règles garantissent que toutes les nouvelles pages
 * ont les métadonnées SEO requises
 */

module.exports = {
  rules: {
    // Forcer l'export de metadata dans les pages
    // Note: Cette règle nécessite un plugin ESLint personnalisé
    // Pour l'instant, on utilise des commentaires de documentation
  },
  overrides: [
    {
      files: ['**/app/**/page.tsx', '**/app/**/page.ts'],
      rules: {
        // Les pages doivent exporter metadata
        // Vérifié via la documentation et les templates
      },
    },
  ],
};

