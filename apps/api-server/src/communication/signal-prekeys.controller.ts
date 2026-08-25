/**
 * ============================================================================
 * SIGNAL PRE-KEYS CONTROLLER — REST endpoints for Signal Protocol V3
 * ============================================================================
 *
 *   POST   /api/chat/signal/prekeys            — publish/refresh bundle
 *   GET    /api/chat/signal/prekeys/:userId    — fetch + atomically consume one OPK
 *   GET    /api/chat/signal/identity/:userId   — fetch identity key only
 *   GET    /api/chat/signal/prekeys-count      — count available OPKs for the caller
 *
 * ⭐ Auth: requires JWT (JwtAuthGuard) + tenant (TenantGuard).
 *    The userId in the URL must belong to the same tenant OR be a known
 *    cross-tenant contact (TODO: cross-tenant trust verification).
 * ============================================================================
 */

import {
  Controller, Get, Post, Body, Param, Query, UseGuards, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../../common/guards/tenant.guard';
import { TenantId } from '../../common/decorators/tenant-id.decorator';
import { SignalPreKeysService, PreKeyBundlePayload } from './services/signal-prekeys.service';

@Controller('chat/signal')
@UseGuards(JwtAuthGuard, TenantGuard)
export class SignalPreKeysController {
  constructor(private readonly signalPreKeysService: SignalPreKeysService) {}

  /**
   * POST /api/chat/signal/prekeys
   * Body: PreKeyBundlePayload (identityKeyBase64, signedPreKey, oneTimePreKeys[])
   *
   * Publishes (or refreshes) the caller's pre-key bundle.
   * Returns { success: true, publishedOneTimePreKeys: N }.
   */
  @Post('prekeys')
  async publishBundle(
    @TenantId() _tenantId: string,
    @Body() body: { userId: string } & PreKeyBundlePayload,
  ) {
    if (!body.userId) throw new BadRequestException('userId is required');
    if (!body.identityKeyBase64) throw new BadRequestException('identityKeyBase64 is required');
    if (!body.signedPreKey?.publicKeyBase64) throw new BadRequestException('signedPreKey.publicKeyBase64 is required');
    if (!body.signedPreKey?.signatureBase64) throw new BadRequestException('signedPreKey.signatureBase64 is required');
    if (!Array.isArray(body.oneTimePreKeys)) throw new BadRequestException('oneTimePreKeys must be an array');

    return this.signalPreKeysService.publishBundle(body.userId, {
      identityKeyBase64: body.identityKeyBase64,
      signedPreKey: body.signedPreKey,
      oneTimePreKeys: body.oneTimePreKeys,
    });
  }

  /**
   * GET /api/chat/signal/prekeys/:userId
   * Returns the user's pre-key bundle. Atomically consumes ONE one-time
   * pre-key (the consumed OPK id is included in the response; the caller
   * must include it in the X3DH header so the recipient can find their
   * matching private key).
   *
   * Returns 404 if the user has no published bundle.
   * Returns 200 with `oneTimePreKey: null` if the user has no available OPKs
   * (X3DH will still succeed but with weaker forward secrecy).
   */
  @Get('prekeys/:userId')
  async fetchBundle(@Param('userId') userId: string) {
    const bundle = await this.signalPreKeysService.fetchBundle(userId);
    if (!bundle) {
      throw new NotFoundException(`No pre-key bundle published for user ${userId}`);
    }
    return bundle;
  }

  /**
   * GET /api/chat/signal/identity/:userId
   * Returns the user's identity public key (base64 SPKI). Does NOT consume
   * any pre-key — used for signature verification + safety number display.
   */
  @Get('identity/:userId')
  async fetchIdentity(@Param('userId') userId: string) {
    const identityKeyBase64 = await this.signalPreKeysService.fetchIdentityKey(userId);
    if (!identityKeyBase64) {
      throw new NotFoundException(`No identity key published for user ${userId}`);
    }
    return { userId, identityKeyBase64 };
  }

  /**
   * GET /api/chat/signal/prekeys-count?userId=...
   * Returns the count of unconsumed one-time pre-keys for the given user.
   * Useful for the client to decide whether to generate more.
   */
  @Get('prekeys-count')
  async countAvailable(@Query('userId') userId?: string) {
    if (!userId) throw new BadRequestException('userId is required');
    const count = await this.signalPreKeysService.countAvailableOneTimePreKeys(userId);
    return { userId, availableOneTimePreKeys: count };
  }
}
