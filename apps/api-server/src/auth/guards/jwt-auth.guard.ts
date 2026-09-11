import { Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    // ⭐ FIX PERFORMANCE CONCURRENCE — idempotence :
    //    Ce guard est GLOBAL (APP_GUARD) ET référencé dans ~200 contrôleurs
    //    via @UseGuards(JwtAuthGuard, …) → chaque requête exécutait DEUX fois
    //    JwtStrategy.validate() (3 lectures de cache + résolution de scope
    //    chacune). Si le guard global a déjà authentifié la requête,
    //    request.user est défini → on skip la re-validation.
    const request = context.switchToHttp().getRequest();
    if (request?.user) {
      return true;
    }
    return super.canActivate(context);
  }
}
