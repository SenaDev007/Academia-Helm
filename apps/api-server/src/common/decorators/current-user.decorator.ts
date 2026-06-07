import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Decorator to extract current authenticated user from request
 * 
 * Usage:
 * @Get()
 * async findAll(@CurrentUser() user: User) {
 *   return this.service.findAll(user);
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
