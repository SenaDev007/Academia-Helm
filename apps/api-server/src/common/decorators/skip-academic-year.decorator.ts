import { SetMetadata } from '@nestjs/common';

/**
 * Clé de métadonnée pour indiquer qu'une route est EXEMPTÉE de l'exigence
 * d'année scolaire stricte.
 *
 * À utiliser sur les routes qui n'ont pas besoin d'être liées à une année
 * scolaire (auth, paramètres tenant-level, billing plateforme, etc.).
 *
 * ⚠️ À utiliser avec parcimonie — la règle par défaut est que TOUTE route
 * métier doit exiger un academicYearId.
 */
export const SKIP_ACADEMIC_YEAR_KEY = 'skipAcademicYear';

/**
 * Décorateur pour marquer une route comme exemptée d'année scolaire.
 *
 * Utilisation :
 * @SkipAcademicYear()
 * @Get('/settings/general')
 * getGeneralSettings() {}
 */
export const SkipAcademicYear = () => SetMetadata(SKIP_ACADEMIC_YEAR_KEY, true);
