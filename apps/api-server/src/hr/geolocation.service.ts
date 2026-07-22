/**
 * ============================================================================
 * GEOLOCATION SERVICE — Vérification géographique du pointage
 * ============================================================================
 *
 * Calcule la distance entre la position GPS de l'utilisateur (téléphone/PC)
 * et les coordonnées de l'école configurées par le directeur.
 *
 * Utilise la formule de Haversine (distance grand cercle sur sphère terrestre).
 *
 * 100% côté serveur — le frontend ne peut PAS forcer `geoVerified = true`.
 * C'est le backend qui recompute la distance à partir des coords envoyées
 * et des coords école stockées en BDD.
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface GeoPosition {
  latitude: number;
  longitude: number;
  accuracy?: number; // en mètres (précision GPS retournée par le navigateur)
}

export interface GeoVerificationResult {
  verified: boolean;
  distance: number;        // en mètres
  allowedRadius: number;   // en mètres
  schoolCoords: GeoPosition | null;
  userCoords: GeoPosition;
  reason?: string;
}

@Injectable()
export class GeolocationService {
  private readonly logger = new Logger(GeolocationService.name);
  private readonly EARTH_RADIUS_METERS = 6_371_000;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère les coords de l'école (active profile) pour un tenant donné.
   * Retourne null si l'école n'a pas encore configuré ses coords GPS.
   */
  async getSchoolCoordinates(tenantId: string): Promise<{
    latitude: number;
    longitude: number;
    geoRadius: number;
  } | null> {
    const profile: any = await this.prisma.$queryRawUnsafe(
      `SELECT latitude, longitude, "geoRadius"
       FROM "tenant_identity_profiles"
       WHERE "tenantId" = $1 AND "isActive" = true
       LIMIT 1`,
      tenantId,
    );
    if (!profile || profile.length === 0) return null;
    const p = profile[0];
    if (p.latitude == null || p.longitude == null) return null;
    return {
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      geoRadius: Number(p.geoRadius) || 100,
    };
  }

  /**
   * Met à jour les coords de l'école (réservé au directeur/admin).
   */
  async updateSchoolCoordinates(
    tenantId: string,
    latitude: number,
    longitude: number,
    geoRadius?: number,
  ): Promise<{ latitude: number; longitude: number; geoRadius: number }> {
    // Valider les bornes lat/lng
    if (latitude < -90 || latitude > 90) {
      throw new Error('Latitude invalide (doit être entre -90 et 90)');
    }
    if (longitude < -180 || longitude > 180) {
      throw new Error('Longitude invalide (doit être entre -180 et 180)');
    }
    if (geoRadius != null && (geoRadius < 10 || geoRadius > 1000)) {
      throw new Error('Rayon de tolérance invalide (entre 10 et 1000 mètres)');
    }

    // Mettre à jour le profil actif
    await this.prisma.$executeRawUnsafe(
      `UPDATE "tenant_identity_profiles"
       SET latitude = $1,
           longitude = $2,
           "geoRadius" = COALESCE($3, "geoRadius"),
           "updatedAt" = NOW()
       WHERE "tenantId" = $4 AND "isActive" = true`,
      latitude, longitude, geoRadius, tenantId,
    );

    this.logger.log(`🏫 Coords école mises à jour — tenant=${tenantId} lat=${latitude} lng=${longitude} rayon=${geoRadius || 'inchangé'}m`);
    return {
      latitude,
      longitude,
      geoRadius: geoRadius || 100,
    };
  }

  /**
   * Vérifie si une position GPS est dans le rayon de tolérance de l'école.
   *
   * @param tenantId     ID du tenant (pour récupérer coords école)
   * @param userPosition Position GPS de l'utilisateur (lat/lng/accuracy)
   * @returns            Résultat de la vérification
   */
  async verifyPosition(
    tenantId: string,
    userPosition: GeoPosition,
  ): Promise<GeoVerificationResult> {
    const school = await this.getSchoolCoordinates(tenantId);

    if (!school) {
      this.logger.warn(`⚠️ Coords école non configurées pour tenant ${tenantId}`);
      return {
        verified: false,
        distance: -1,
        allowedRadius: 0,
        schoolCoords: null,
        userCoords: userPosition,
        reason: 'COORDS_ECOLE_NON_CONFIGUREES',
      };
    }

    const distance = this.haversineDistance(
      userPosition.latitude,
      userPosition.longitude,
      school.latitude,
      school.longitude,
    );

    const verified = distance <= school.geoRadius;

    this.logger.log(
      `📍 Vérif géo — user(${userPosition.latitude.toFixed(5)}, ${userPosition.longitude.toFixed(5)}) ` +
      `école(${school.latitude.toFixed(5)}, ${school.longitude.toFixed(5)}) ` +
      `distance=${distance.toFixed(1)}m rayon=${school.geoRadius}m → ${verified ? '✅' : '❌'}`,
    );

    return {
      verified,
      distance: Number(distance.toFixed(2)),
      allowedRadius: school.geoRadius,
      schoolCoords: { latitude: school.latitude, longitude: school.longitude },
      userCoords: userPosition,
      reason: verified ? 'OK' : 'HORS_RAYON',
    };
  }

  /**
   * Formule de Haversine — distance grand cercle entre 2 points GPS.
   * @returns distance en mètres
   */
  private haversineDistance(
    lat1: number, lng1: number,
    lat2: number, lng2: number,
  ): number {
    const toRad = (deg: number) => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return this.EARTH_RADIUS_METERS * c;
  }
}
