-- ============================================================================
-- Migration : drop_contract_document_configs
-- ============================================================================
-- Suppression définitive de la table `contract_document_configs`.
--
-- La configuration visuelle des contrats (en-tête, filigrane, pied de page,
-- style) a été retirée du produit. Le service `ContractDocumentConfigService`,
-- le contrôleur `ContractDocumentConfigController` et la page frontend
-- `Config. Contrats` ont déjà été supprimés du code. Le service de génération
-- PDF des contrats (`ContractPdfService.buildHtmlFromArticles`) utilise
-- désormais des valeurs par défaut hardcodées (couleurs, marges, polices).
--
-- Cette migration supprime la table devenue inutile.
-- ============================================================================

DROP TABLE IF EXISTS "contract_document_configs";
