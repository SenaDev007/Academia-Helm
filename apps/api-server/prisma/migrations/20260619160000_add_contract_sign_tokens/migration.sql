-- ============================================================================
-- Migration: 20260619160000_add_contract_sign_tokens
-- ============================================================================
-- Crée la table `contract_sign_tokens` pour permettre la signature
-- électronique d'un contrat par un candidat via un lien magique (token)
-- envoyé par email, sans nécessiter de compte utilisateur préalable.
--
-- Workflow :
--   1. Admin embauche un candidat → Contract créé (status=PENDING)
--   2. ContractSignToken créé (token UUID 32 chars, expire dans 30 jours)
--   3. Email "Embauché" envoyé avec contractUrl = /sign/contract/{token}
--   4. Candidat clique → page publique affiche infos contrat + canvas signature
--   5. Candidat signe → POST /public-sign/{token} → signContract() cascade
--   6. Token marqué USED (ne peut plus être réutilisé)
-- ============================================================================

CREATE TABLE IF NOT EXISTS "contract_sign_tokens" (
    "id"          TEXT NOT NULL,
    "contractId"  TEXT NOT NULL,
    "tenantId"    TEXT NOT NULL,
    "token"       TEXT NOT NULL,
    "expiresAt"   TIMESTAMP(3) NOT NULL,
    "usedAt"      TIMESTAMP(3),
    "signedByIp"  TEXT,
    "signedByUserAgent" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_sign_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "contract_sign_tokens_contractId_fkey"
        FOREIGN KEY ("contractId") REFERENCES "employment_contracts" ("id") ON DELETE CASCADE,
    CONSTRAINT "contract_sign_tokens_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "tenants" ("id") ON DELETE CASCADE
);

-- Index pour lookup rapide par token (le plus utilisé)
CREATE UNIQUE INDEX IF NOT EXISTS "contract_sign_tokens_token_key" ON "contract_sign_tokens" ("token");
CREATE INDEX IF NOT EXISTS "contract_sign_tokens_contractId_idx" ON "contract_sign_tokens" ("contractId");
CREATE INDEX IF NOT EXISTS "contract_sign_tokens_tenantId_idx" ON "contract_sign_tokens" ("tenantId");
CREATE INDEX IF NOT EXISTS "contract_sign_tokens_expiresAt_idx" ON "contract_sign_tokens" ("expiresAt");
