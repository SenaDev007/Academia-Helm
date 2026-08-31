/**
 * ============================================================================
 * LIVEKIT TOKEN SERVICE — Mints JWT access tokens for LiveKit rooms
 * ============================================================================
 *
 * LiveKit is the SFU (Selective Forwarding Unit) that powers Discord-style
 * persistent voice channels, stage channels, and live streaming (Go Live).
 *
 * This service mints short-lived JWT tokens that grant a user access to a
 * specific LiveKit room. The token is sent to the frontend, which uses
 * `livekit-client` to connect to the LiveKit server.
 *
 * Token format (LiveKit Access Token):
 *   - Header: { alg: 'HS256', typ: 'JWT' }
 *   - Payload: {
 *       iss: <API_KEY>,
 *       sub: <userId>,        // identity
 *       nbf: <now>,
 *       exp: <now + 6h>,
 *       video: {
 *         room: <roomId>,    // the voice channel ID
 *         roomJoin: true,
 *         canPublish: true,
 *         canSubscribe: true,
 *         canPublishData: true,
 *       },
 *     }
 *   - Signature: HMAC-SHA256(API_SECRET, base64url(header) + '.' + base64url(payload))
 *
 * We implement the JWT minting manually (no external dependency) so the
 * service works in environments where `livekit-server-sdk` is not installed.
 * The output is 100% compatible with LiveKit servers.
 *
 * If LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET are not set, the
 * service returns `{ configured: false }` and the caller should fall back
 * to mesh WebRTC (≤5 participants).
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';

export interface LiveKitTokenResult {
  configured: boolean;
  token?: string;
  url?: string;
  room?: string;
  identity?: string;
  /** If false, the caller should fall back to mesh WebRTC. */
  fallbackToMesh?: boolean;
}

@Injectable()
export class LiveKitTokenService {
  private readonly logger = new Logger(LiveKitTokenService.name);

  private get apiKey(): string | undefined {
    return process.env.LIVEKIT_API_KEY;
  }

  private get apiSecret(): string | undefined {
    return process.env.LIVEKIT_API_SECRET;
  }

  private get livekitUrl(): string | undefined {
    return process.env.LIVEKIT_URL;
  }

  get isConfigured(): boolean {
    return !!(this.apiKey && this.apiSecret && this.livekitUrl);
  }

  /**
   * Mint a LiveKit access token for a user to join a room.
   *
   * @param identity   The user's ID (used as the LiveKit participant identity)
   * @param roomName   The room name (usually the voice channel ID)
   * @param options    Optional: canPublish, canSubscribe, canPublishData, ttl (seconds)
   * @returns          { configured, token, url, room, identity } or { configured: false, fallbackToMesh: true }
   */
  async mintToken(
    identity: string,
    roomName: string,
    options?: {
      canPublish?: boolean;
      canSubscribe?: boolean;
      canPublishData?: boolean;
      /** Token time-to-live in seconds (default: 6 hours = 21600) */
      ttl?: number;
      /** For STAGE channels: only the broadcaster can publish */
      isBroadcaster?: boolean;
    },
  ): Promise<LiveKitTokenResult> {
    if (!this.isConfigured) {
      this.logger.warn('LiveKit not configured — falling back to mesh WebRTC. Set LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET.');
      return { configured: false, fallbackToMesh: true };
    }

    const now = Math.floor(Date.now() / 1000);
    const ttl = options?.ttl ?? 21600; // 6 hours
    const exp = now + ttl;

    // LiveKit JWT payload (video grant)
    const payload: any = {
      iss: this.apiKey,
      sub: identity,
      nbf: now,
      exp,
      video: {
        room: roomName,
        roomJoin: true,
        canPublish: options?.canPublish ?? true,
        canSubscribe: options?.canSubscribe ?? true,
        canPublishData: options?.canPublishData ?? true,
      },
      // sid + jti for uniqueness / revocation tracking
      sid: randomBytes(8).toString('hex'),
      jti: randomBytes(8).toString('hex'),
    };

    // For STAGE channels, non-broadcasters can only subscribe (listen)
    if (options?.isBroadcaster === false) {
      payload.video.canPublish = false;
      payload.video.canPublishData = false;
      payload.video.canSubscribe = true;
    }

    const token = this.signJwt(payload);
    this.logger.log(`Minted LiveKit token for identity=${identity} room=${roomName} exp=${new Date(exp * 1000).toISOString()}`);

    return {
      configured: true,
      token,
      url: this.livekitUrl,
      room: roomName,
      identity,
    };
  }

  /**
   * Sign a JWT with HS256 using the LiveKit API secret.
   */
  private signJwt(payload: any): string {
    const header = { alg: 'HS256', typ: 'JWT', kid: this.apiKey };
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const signature = createHmac('sha256', this.apiSecret!)
      .update(signingInput)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    return `${signingInput}.${signature}`;
  }

  /**
   * Base64URL-encode a string (no padding).
   */
  private base64UrlEncode(str: string): string {
    return Buffer.from(str, 'utf-8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}
