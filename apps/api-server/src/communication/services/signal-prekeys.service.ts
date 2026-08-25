/**
 * ============================================================================
 * SIGNAL PRE-KEYS SERVICE — Backend store for Signal Protocol V3
 * ============================================================================
 *
 * Stores pre-key bundles (identity key, signed pre-key, one-time pre-keys)
 * so clients can initiate X3DH sessions without the recipient being online.
 *
 * Atomic OPK consumption: when an initiator fetches a bundle, the server
 * marks ONE one-time pre-key as consumed (so no two initiators get the same
 * OPK). The recipient, on receiving the X3DH header, looks up the OPK
 * locally (already consumed on the server) — so we keep the public key in
 * the table for the recipient to verify, but mark it consumed.
 * ============================================================================
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { randomUUID } from 'crypto';

export interface PreKeyBundlePayload {
  identityKeyBase64: string;
  signedPreKey: {
    id: number;
    publicKeyBase64: string;
    signatureBase64: string;
  };
  oneTimePreKeys: Array<{ id: number; publicKeyBase64: string }>;
}

export interface PreKeyBundleResponse {
  identityKeyBase64: string;
  signedPreKey: {
    id: number;
    publicKeyBase64: string;
    signatureBase64: string;
  };
  oneTimePreKey: { id: number; publicKeyBase64: string } | null;
}

@Injectable()
export class SignalPreKeysService {
  private readonly logger = new Logger(SignalPreKeysService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Publish (or refresh) a user's pre-key bundle:
   *   - Update identity key (if changed — shouldn't change normally)
   *   - Update signed pre-key (overwrites any previous SPK with same ID)
   *   - Append one-time pre-keys (does NOT overwrite existing OPKs)
   *
   * ⭐ Idempotent: if called twice with the same payload, the second call
   *    is a no-op (we use ON CONFLICT to update the publicKey/signature
   *    but never re-create).
   */
  async publishBundle(userId: string, payload: PreKeyBundlePayload): Promise<{ success: true; publishedOneTimePreKeys: number }> {
    // 1. Upsert the user's identity key (one row per user).
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO signal_prekeys (id, "userId", "keyType", "publicKeyBase64", "prekeyId", "signatureBase64", "isConsumed", "createdAt", "updatedAt")
      VALUES ($1, $2, 'IDENTITY', $3, NULL, NULL, false, NOW(), NOW())
      ON CONFLICT ("userId", "keyType", "prekeyId") DO UPDATE
        SET "publicKeyBase64" = EXCLUDED."publicKeyBase64", "updatedAt" = NOW()
    `, randomUUID(), userId, payload.identityKeyBase64);

    // 2. Upsert the signed pre-key (one row per (userId, SIGNED_PREKEY, prekeyId)).
    await this.prisma.$executeRawUnsafe(`
      INSERT INTO signal_prekeys (id, "userId", "keyType", "publicKeyBase64", "prekeyId", "signatureBase64", "isConsumed", "createdAt", "updatedAt")
      VALUES ($1, $2, 'SIGNED_PREKEY', $3, $4, $5, false, NOW(), NOW())
      ON CONFLICT ("userId", "keyType", "prekeyId") DO UPDATE
        SET "publicKeyBase64" = EXCLUDED."publicKeyBase64",
            "signatureBase64" = EXCLUDED."signatureBase64",
            "isConsumed" = false,
            "updatedAt" = NOW()
    `,
      randomUUID(),
      userId,
      payload.signedPreKey.publicKeyBase64,
      payload.signedPreKey.id,
      payload.signedPreKey.signatureBase64,
    );

    // 3. Insert one-time pre-keys (skip duplicates via ON CONFLICT).
    for (const opk of payload.oneTimePreKeys) {
      await this.prisma.$executeRawUnsafe(`
        INSERT INTO signal_prekeys (id, "userId", "keyType", "publicKeyBase64", "prekeyId", "signatureBase64", "isConsumed", "createdAt", "updatedAt")
        VALUES ($1, $2, 'ONE_TIME_PREKEY', $3, $4, NULL, false, NOW(), NOW())
        ON CONFLICT ("userId", "keyType", "prekeyId") DO NOTHING
      `, randomUUID(), userId, opk.publicKeyBase64, opk.id);
    }

    this.logger.log(`Published bundle for user ${userId}: ${payload.oneTimePreKeys.length} OPKs`);
    return { success: true, publishedOneTimePreKeys: payload.oneTimePreKeys.length };
  }

  /**
   * Fetch a user's pre-key bundle. Atomically consumes ONE one-time pre-key
   * (so no two initiators get the same OPK). Returns null if the user has
   * no published bundle.
   *
   * ⭐ Atomic OPK consumption: we use SELECT ... FOR UPDATE SKIP LOCKED
   *    inside a transaction so concurrent requests get different OPKs.
   */
  async fetchBundle(userId: string): Promise<PreKeyBundleResponse | null> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch the identity key.
      const identityRows = await tx.$queryRawUnsafe<any[]>(`
        SELECT "publicKeyBase64" FROM signal_prekeys
        WHERE "userId" = $1 AND "keyType" = 'IDENTITY'
        LIMIT 1
      `, userId);
      if (identityRows.length === 0) return null;
      const identityKeyBase64 = identityRows[0].publicKeyBase64;

      // 2. Fetch the latest signed pre-key.
      const spkRows = await tx.$queryRawUnsafe<any[]>(`
        SELECT "prekeyId", "publicKeyBase64", "signatureBase64" FROM signal_prekeys
        WHERE "userId" = $1 AND "keyType" = 'SIGNED_PREKEY'
        ORDER BY "updatedAt" DESC
        LIMIT 1
      `, userId);
      if (spkRows.length === 0) {
        throw new NotFoundException(`User ${userId} has identity key but no signed pre-key`);
      }
      const spk = spkRows[0];

      // 3. Atomically consume ONE one-time pre-key (SELECT FOR UPDATE SKIP LOCKED).
      const opkRows = await tx.$queryRawUnsafe<any[]>(`
        SELECT id, "prekeyId", "publicKeyBase64" FROM signal_prekeys
        WHERE "userId" = $1 AND "keyType" = 'ONE_TIME_PREKEY' AND "isConsumed" = false
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      `, userId);

      let opk: { id: number; publicKeyBase64: string } | null = null;
      if (opkRows.length > 0) {
        const opkRow = opkRows[0];
        await tx.$executeRawUnsafe(`
          UPDATE signal_prekeys SET "isConsumed" = true, "consumedAt" = NOW(), "updatedAt" = NOW()
          WHERE id = $1
        `, opkRow.id);
        opk = { id: opkRow.prekeyId, publicKeyBase64: opkRow.publicKeyBase64 };
      }

      return {
        identityKeyBase64,
        signedPreKey: {
          id: spk.prekeyId,
          publicKeyBase64: spk.publicKeyBase64,
          signatureBase64: spk.signatureBase64,
        },
        oneTimePreKey: opk,
      };
    });
  }

  /**
   * Fetch only the identity key for a user (for signature verification,
   * trust-on-first-use display, etc. — does NOT consume any pre-key).
   */
  async fetchIdentityKey(userId: string): Promise<string | null> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT "publicKeyBase64" FROM signal_prekeys
      WHERE "userId" = $1 AND "keyType" = 'IDENTITY'
      LIMIT 1
    `, userId);
    return rows.length > 0 ? rows[0].publicKeyBase64 : null;
  }

  /**
   * Get the count of unconsumed one-time pre-keys (for the client to decide
   * whether to generate more).
   */
  async countAvailableOneTimePreKeys(userId: string): Promise<number> {
    const rows = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*)::int AS count FROM signal_prekeys
      WHERE "userId" = $1 AND "keyType" = 'ONE_TIME_PREKEY' AND "isConsumed" = false
    `, userId);
    return rows[0]?.count ?? 0;
  }
}
