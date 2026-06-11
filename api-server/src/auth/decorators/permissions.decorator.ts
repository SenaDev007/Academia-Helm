/**
 * ============================================================================
 * PERMISSIONS DECORATOR - RBAC STRICT
 * ============================================================================
 * 
 * Decorator pour spécifier les permissions requises pour accéder à une route
 * 
 * Usage:
 * @Permissions('students.read', 'students.write')
 * @Get()
 * async findAll() { ... }
 * 
 * ============================================================================
 */

import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);

