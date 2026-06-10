/**
 * Offline Security Service
 * 
 * Service pour assurer la sécurité des données en mode offline.
 * 
 * RÈGLES : Section 20 du Cahier Technique
 */

export class OfflineSecurityService {
  /**
   * Chiffre une valeur sensible (Section 20.1)
   * Note : Utilise une méthode simple pour la démo, en production utiliser SubtleCrypto
   */
  static encrypt(value: string): string {
    if (!value) return value;
    // Simulation AES-256 (Base64 + simple XOR pour l'exemple technique)
    const key = 'academia-federis-secret-key';
    return btoa(value.split('').map((char, i) => 
      String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length))
    ).join(''));
  }

  /**
   * Déchiffre une valeur sensible
   */
  static decrypt(encrypted: string): string {
    if (!encrypted) return encrypted;
    try {
      const key = 'academia-federis-secret-key';
      const decoded = atob(encrypted);
      return decoded.split('').map((char, i) => 
        String.fromCharCode(char.charCodeAt(0) ^ key.charCodeAt(i % key.length))
      ).join('');
    } catch {
      return encrypted;
    }
  }

  /**
   * Génère une signature pour les permissions locales (Section 20.4)
   */
  static signPermissions(permissions: string[], userId: string): string {
    const data = permissions.sort().join(',') + userId;
    // Simulation HMAC-SHA256
    return btoa(data).substring(0, 32);
  }

  /**
   * Vérifie la signature des permissions
   */
  static verifyPermissions(permissions: string[], userId: string, signature: string): boolean {
    return this.signPermissions(permissions, userId) === signature;
  }
}
