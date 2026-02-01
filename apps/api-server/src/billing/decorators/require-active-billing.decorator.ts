/**
 * ============================================================================
 * REQUIRE ACTIVE BILLING DECORATOR
 * ============================================================================
 * 
 * Decorator pour marquer les routes qui nécessitent une souscription active
 * (pas en SUSPENDED ou CANCELLED)
 * 
 * ============================================================================
 */

import { SetMetadata } from '@nestjs/common';

export const REQUIRE_ACTIVE_BILLING_KEY = 'requireActiveBilling';

export const RequireActiveBilling = () => SetMetadata(REQUIRE_ACTIVE_BILLING_KEY, true);
