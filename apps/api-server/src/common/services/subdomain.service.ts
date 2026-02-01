/**
 * ============================================================================
 * SUBDOMAIN SERVICE - GÉNÉRATION AUTOMATIQUE SOUS-DOMAINES
 * ============================================================================
 * 
 * Service pour générer des sous-domaines uniques et normalisés
 * à partir du nom d'une école.
 * 
 * Règles :
 * - Normalisation : lowercase, remove accents, remove symbols
 * - Unicité : vérification DB + suffixe automatique si collision
 * - Stabilité : sous-domaine non modifiable par l'utilisateur
 * 
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class SubdomainService {
  private readonly logger = new Logger(SubdomainService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Normalise un nom d'école en slug sécurisé
   * 
   * Pipeline :
   * 1. lowercase
   * 2. remove accents
   * 3. remove symbols
   * 4. replace spaces → dash
   * 5. collapse dashes
   * 6. trim
   */
  normalizeSchoolName(name: string): string {
    if (!name || typeof name !== 'string') {
      throw new Error('School name must be a non-empty string');
    }

    return name
      .toLowerCase()
      .normalize('NFD') // Décompose les caractères accentués
      .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
      .replace(/[^a-z0-9\s-]/g, '') // Supprime les symboles (garde lettres, chiffres, espaces, tirets)
      .replace(/\s+/g, '-') // Remplace les espaces par des tirets
      .replace(/-+/g, '-') // Collapse les tirets multiples
      .replace(/^-+|-+$/g, '') // Supprime les tirets en début/fin
      .substring(0, 50); // Limite à 50 caractères
  }

  /**
   * Vérifie si un sous-domaine existe déjà
   */
  async subdomainExists(subdomain: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { subdomain },
      select: { id: true },
    });

    return !!tenant;
  }

  /**
   * Génère un sous-domaine unique à partir du nom d'une école
   * 
   * Si collision :
   * - college-x → college-x-2
   * - college-x-2 → college-x-3
   * - etc.
   */
  async generateUniqueSubdomain(schoolName: string): Promise<string> {
    const baseSubdomain = this.normalizeSchoolName(schoolName);

    if (!baseSubdomain) {
      throw new Error('Cannot generate subdomain from empty school name');
    }

    // Vérifier si le sous-domaine de base est disponible
    if (!(await this.subdomainExists(baseSubdomain))) {
      this.logger.log(`✅ Subdomain available: ${baseSubdomain}`);
      return baseSubdomain;
    }

    // Chercher un suffixe disponible
    let suffix = 2;
    let candidate = `${baseSubdomain}-${suffix}`;

    while (await this.subdomainExists(candidate)) {
      suffix++;
      candidate = `${baseSubdomain}-${suffix}`;

      // Sécurité : éviter les boucles infinies
      if (suffix > 1000) {
        throw new Error(`Cannot generate unique subdomain after 1000 attempts for: ${baseSubdomain}`);
      }
    }

    this.logger.log(`✅ Generated unique subdomain with suffix: ${candidate}`);
    return candidate;
  }

  /**
   * Valide un sous-domaine (format)
   */
  validateSubdomain(subdomain: string): { valid: boolean; error?: string } {
    if (!subdomain || typeof subdomain !== 'string') {
      return { valid: false, error: 'Subdomain must be a non-empty string' };
    }

    // Longueur
    if (subdomain.length < 3) {
      return { valid: false, error: 'Subdomain must be at least 3 characters' };
    }

    if (subdomain.length > 50) {
      return { valid: false, error: 'Subdomain must be at most 50 characters' };
    }

    // Format : seulement lettres minuscules, chiffres, tirets
    if (!/^[a-z0-9-]+$/.test(subdomain)) {
      return { valid: false, error: 'Subdomain can only contain lowercase letters, numbers, and dashes' };
    }

    // Ne doit pas commencer ou finir par un tiret
    if (subdomain.startsWith('-') || subdomain.endsWith('-')) {
      return { valid: false, error: 'Subdomain cannot start or end with a dash' };
    }

    // Ne doit pas contenir de tirets consécutifs
    if (subdomain.includes('--')) {
      return { valid: false, error: 'Subdomain cannot contain consecutive dashes' };
    }

    return { valid: true };
  }

  /**
   * Génère un sous-domaine et vérifie son unicité en une seule opération
   */
  async generateAndValidate(schoolName: string): Promise<string> {
    const subdomain = await this.generateUniqueSubdomain(schoolName);
    const validation = this.validateSubdomain(subdomain);

    if (!validation.valid) {
      throw new Error(`Generated subdomain is invalid: ${validation.error}`);
    }

    return subdomain;
  }
}
