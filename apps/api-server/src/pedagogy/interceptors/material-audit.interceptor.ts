/**
 * ============================================================================
 * MATERIAL AUDIT INTERCEPTOR - MODULE 2
 * ============================================================================
 * 
 * Intercepte toutes les opérations sur le matériel pédagogique
 * et crée automatiquement des logs d'audit
 * 
 * R3: Traçabilité absolue
 * 
 * ============================================================================
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MaterialAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(MaterialAuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, params, query } = request;
    const user = request.user;
    const materialContext = request.materialContext;

    // Ignorer les requêtes GET (lecture seule)
    if (method === 'GET') {
      return next.handle();
    }

    const now = Date.now();

    return next.handle().pipe(
      tap(async (response) => {
        try {
          const operation = this.getOperationType(method, url);
          const resourceId = params?.id || body?.id || response?.id;

          // R3: Créer un log d'audit pour toute opération d'écriture
          if (materialContext && resourceId) {
            await this.prisma.auditLog.create({
              data: {
                tenantId: materialContext.tenantId,
                userId: materialContext.userId,
                action: operation,
                resource: this.getResourceType(url),
                resourceId: resourceId,
                recordId: resourceId,
                tableName: this.getTableName(url),
                changes: {
                  url,
                  method,
                  academicYearId: materialContext.academicYearId,
                  userRole: materialContext.userRole,
                  timestamp: new Date().toISOString(),
                } as any,
              },
            });

            this.logger.log(
              `[AUDIT] ${operation} on ${this.getResourceType(url)} ${resourceId} by user ${materialContext.userId}`,
            );
          }
        } catch (error) {
          // Ne pas faire échouer la requête si l'audit échoue
          this.logger.error(`Failed to create audit log: ${error.message}`);
        }
      }),
    );
  }

  private getOperationType(method: string, url: string): string {
    if (method === 'POST') return 'CREATE';
    if (method === 'PUT' || method === 'PATCH') return 'UPDATE';
    if (method === 'DELETE') return 'DELETE';
    return 'UNKNOWN';
  }

  private getResourceType(url: string): string {
    if (url.includes('pedagogical-materials')) return 'PEDAGOGICAL_MATERIAL';
    if (url.includes('material-movements')) return 'MATERIAL_MOVEMENT';
    if (url.includes('teacher-material-assignments')) return 'TEACHER_MATERIAL_ASSIGNMENT';
    if (url.includes('material-stocks')) return 'MATERIAL_STOCK';
    if (url.includes('annual-teacher-supplies')) return 'ANNUAL_TEACHER_SUPPLY';
    return 'MATERIAL_UNKNOWN';
  }

  private getTableName(url: string): string {
    if (url.includes('pedagogical-materials')) return 'pedagogical_materials';
    if (url.includes('material-movements')) return 'material_movements';
    if (url.includes('teacher-material-assignments')) return 'teacher_material_assignments';
    if (url.includes('material-stocks')) return 'material_stocks';
    if (url.includes('annual-teacher-supplies')) return 'annual_teacher_supplies';
    return 'unknown';
  }
}
