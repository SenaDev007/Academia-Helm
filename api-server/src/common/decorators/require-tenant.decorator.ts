import { SetMetadata } from '@nestjs/common';

/**
 * Clé de métadonnée pour indiquer qu'une route nécessite un tenant
 */
export const REQUIRE_TENANT_KEY = 'requireTenant';

/**
 * Décorateur pour marquer une route comme nécessitant un tenant
 * 
 * Utilisation :
 * @RequireTenant()
 * @Get('/students')
 * findAllStudents() {}
 * 
 * ⚠️ IMPORTANT : Ce décorateur doit être utilisé avec @UseGuards(TenantGuard)
 * pour que le guard soit appliqué.
 */
export const RequireTenant = () => SetMetadata(REQUIRE_TENANT_KEY, true);
