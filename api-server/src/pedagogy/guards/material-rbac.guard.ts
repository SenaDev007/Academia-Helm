/**
 * ============================================================================
 * MATERIAL RBAC GUARD - MODULE 2
 * ============================================================================
 * 
 * Valide les droits d'accès selon le rôle utilisateur
 * 
 * ============================================================================
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class MaterialRbacGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const method = request.method;

    if (!user?.role) {
      throw new ForbiddenException('User role is required');
    }

    const role = user.role.toUpperCase();

    // Super Admin : tout
    if (role === 'SUPER_ADMIN') {
      return true;
    }

    // Promoteur : tout
    if (role === 'PROMOTEUR' || role === 'PROMOTER') {
      return true;
    }

    // Directeur : tout sauf suppression
    if (role === 'DIRECTOR' || role === 'DIRECTEUR') {
      if (method === 'DELETE') {
        throw new ForbiddenException('Directors cannot delete materials. Only Super Admin can.');
      }
      return true;
    }

    // Comptable, Secrétaire : lecture seule
    if (role === 'ACCOUNTANT' || role === 'COMPTABLE' || role === 'SECRETARY' || role === 'SECRETAIRE') {
      if (method !== 'GET') {
        throw new ForbiddenException('Read-only access for this role');
      }
      return true;
    }

    // Enseignant : lecture personnelle uniquement
    if (role === 'TEACHER' || role === 'ENSEIGNANT') {
      if (method !== 'GET') {
        throw new ForbiddenException('Teachers can only view their own assignments');
      }
      // Vérifier que l'enseignant consulte ses propres données
      const teacherId = request.params?.teacherId || request.query?.teacherId;
      if (teacherId && teacherId !== user.id) {
        throw new ForbiddenException('Teachers can only view their own data');
      }
      return true;
    }

    // Par défaut : refus
    throw new ForbiddenException(`Role ${role} does not have access to material management`);
  }
}
