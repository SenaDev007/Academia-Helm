-- ============================================================================
-- Migration 022 : Carte scolaire — palette de marque automatique (logo/CMS)
-- ============================================================================
-- ⭐ 2026-11-27 (retour promoteur) : « la palette de couleurs de la carte
--    scolaire doit être dynamique en fonction de la palette de couleurs du
--    logo de l'école, exactement comme pour le site institutionnel ».
--
-- Nouvelle colonne cardUseBrandPalette (défaut TRUE) :
--   - TRUE  → la carte suit la palette de marque (customColors CMS >
--             logoPalette AUTO du logo — même chaîne que le site public),
--             avec contraste garanti (bandes assombries, texte blanc) ;
--   - FALSE → les couleurs manuelles cardPrimaryColor/cardSecondaryColor
--             choisies dans Paramètres → Design sont utilisées.
-- ============================================================================

ALTER TABLE "tenant_identity_profiles"
  ADD COLUMN IF NOT EXISTS "cardUseBrandPalette" BOOLEAN DEFAULT true;
