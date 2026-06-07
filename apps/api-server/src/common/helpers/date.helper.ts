/**
 * Date Helper
 * 
 * Helpers pour convertir les dates string en Date objects
 * pour Prisma
 */

/**
 * Convertit une date string en Date object
 * @param date - Date en string ou Date object
 * @returns Date object
 */
export function toDate(date: string | Date | null | undefined): Date | undefined {
  if (!date) return undefined;
  if (date instanceof Date) return date;
  return new Date(date);
}

/**
 * Convertit un objet avec des dates string en Date objects
 * @param obj - Objet avec des propriétés date
 * @param dateFields - Liste des champs à convertir
 * @returns Objet avec dates converties
 */
export function convertDateFields<T extends Record<string, any>>(
  obj: T,
  dateFields: (keyof T)[]
): T {
  const result = { ...obj };
  for (const field of dateFields) {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = new Date(result[field]) as any;
    }
  }
  return result;
}
