/**
 * ============================================================================
 * PORTAL TYPE DECORATOR
 * ============================================================================
 */

import { SetMetadata } from '@nestjs/common';

export const PORTAL_TYPE_KEY = 'portalType';

export const PortalType = (portalType: 'SCHOOL' | 'TEACHER' | 'PARENT') =>
  SetMetadata(PORTAL_TYPE_KEY, portalType);

