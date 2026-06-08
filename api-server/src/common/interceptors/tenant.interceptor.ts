import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';

/**
 * Interceptor to automatically inject tenant_id into query/body
 * 
 * This ensures all requests are tenant-scoped
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const tenantId = request['tenantId'];

    if (tenantId) {
      // Automatically add tenant_id to query and body
      if (request.query) {
        request.query.tenantId = tenantId;
      }
      if (request.body) {
        request.body.tenantId = tenantId;
      }
    }

    return next.handle();
  }
}

