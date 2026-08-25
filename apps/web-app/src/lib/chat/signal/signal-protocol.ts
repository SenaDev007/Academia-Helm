/**
 * ============================================================================
 * SIGNAL PROTOCOL V3 — HIGH-LEVEL API
 * ============================================================================
 *
 * Single entrypoint for the UI to encrypt/decrypt messages using the Signal
 * Protocol (X3DH + Double Ratchet).
 *
 * Usage:
 *   import { SignalProtocol } from '@/lib/chat/signal/signal-protocol';
 *
 *   // One-time setup (called on app boot if user opts into V3):
 *   await SignalProtocol.ensureIdentityKey();
 *   await SignalProtocol.publishPreKeyBundle();
 *
 *   // To send a message:
 *   const ciphertext = await SignalProtocol.encrypt(conversationId, recipientUserId, plaintext);
 *
 *   // To decrypt:
 *   const plaintext = await SignalProtocol.decrypt(conversationId, senderUserId, ciphertext);
 *
 * Ciphertext format: `SIG3:<base64(JSON({x3dh?, header, iv_ct}))>`
 *   - x3dh: present only on the FIRST message of a new session (initiates X3DH)
 *   - header: ratchet header (DH pub + Ns + PN)
 *   - iv_ct: IV (12 bytes) + AES-GCM ciphertext + tag
 *
 * If V3 is not yet enabled for a peer (no identity key fetched, no bundle),
 * the caller should fall back to V2 (crypto.ts `encryptMessage`).
 * ============================================================================
 */

import { IdentityKeyPair, loadIdentityKey, generateIdentityKey, hasIdentityKey } from './identity';
import {
  SignedPreKey, OneTimePreKey, PreKeyBundle,
  generateSignedPreKey, loadSignedPreKey,
  generateOneTimePreKeys, consumeOneTimePreKey, countUnconsumedOneTimePreKeys,
} from './prekeys';
import {
  initiateX3DH, receiveX3DH,
  X3DHHeader, encodeX3DHHeader, decodeX3DHHeader,
} from './x3dh';
import {
  DoubleRatchetState, initDoubleRatchet,
  ratchetEncrypt, ratchetDecrypt, RatchetCiphertext,
} from './double-ratchet';
import {
  saveRatchetState, loadRatchetState, deleteRatchetState,
  savePeerIdentity, loadPeerIdentity,
} from './ratchet-store';
import { bufToBase64, base64ToBuf } from './identity';

// ─── Backend API (fetch pre-key bundles, publish own keys) ─────────────

async function fetchPreKeyBundle(recipientUserId: string): Promise<PreKeyBundle | null> {
  try {
    const res = await fetch(`/api/chat/signal/prekeys/${encodeURIComponent(recipientUserId)}`, {
      credentials: 'include',
    });
    if (!res.ok) return null;
    return (await res.json()) as PreKeyBundle;
  } catch {
    return null;
  }
}

async function publishBundle(payload: {
  identityKeyBase64: string;
  signedPreKey: { id: number; publicKeyBase64: string; signatureBase64: string };
  oneTimePreKeys: Array<{ id: number; publicKeyBase64: string }>;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/chat/signal/prekeys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────

export class SignalProtocol {
  /**
   * Ensure the local device has an identity keypair. Generates one if missing.
   * Returns the public key (base64 SPKI).
   */
  static async ensureIdentityKey(): Promise<string> {
    if (await hasIdentityKey()) {
      const ik = await loadIdentityKey();
      return ik!.publicKeyBase64;
    }
    return generateIdentityKey();
  }

  /**
   * Generate + publish a fresh pre-key bundle:
   *   - 1 signed pre-key (rotated each call — old one is overwritten)
   *   - N one-time pre-keys (only if the local pool is low)
   *
   * @param forceOneTimeCount If >0, generate exactly that many OPKs even if pool is sufficient.
   */
  static async publishPreKeyBundle(forceOneTimeCount: number = 0): Promise<boolean> {
    const identity = await loadIdentityKey();
    if (!identity) throw new Error('SignalProtocol.publishPreKeyBundle: no identity key — call ensureIdentityKey() first');

    // 1. Generate (or rotate) the signed pre-key. ID = unix seconds mod 1000000.
    const spkId = Math.floor(Date.now() / 1000) % 1000000;
    const spk = await generateSignedPreKey(identity.signPrivateKey, spkId);

    // 2. Generate one-time pre-keys if pool is low (< 10 remaining) or forced.
    const remaining = await countUnconsumedOneTimePreKeys();
    const needed = forceOneTimeCount > 0
      ? forceOneTimeCount
      : (remaining < 10 ? 10 : 0);
    let opks: OneTimePreKey[] = [];
    if (needed > 0) {
      const startId = Math.floor(Date.now() / 1000) % 1000000;
      opks = await generateOneTimePreKeys(startId, needed);
    }

    // 3. Publish to backend.
    return publishBundle({
      identityKeyBase64: identity.publicKeyBase64,
      signedPreKey: {
        id: spk.id,
        publicKeyBase64: spk.publicKeyBase64,
        signatureBase64: spk.signatureBase64,
      },
      oneTimePreKeys: opks.map(o => ({ id: o.id, publicKeyBase64: o.publicKeyBase64 })),
    });
  }

  /**
   * Encrypt a plaintext message for a recipient. Establishes a new X3DH
   * session on first message, then uses the Double Ratchet.
   *
   * @param conversationId ID of the conversation (used as the ratchet state key)
   * @param recipientUserId Recipient's user ID (for fetching their pre-key bundle)
   * @param plaintext UTF-8 plaintext
   * @returns `SIG3:<base64>` ciphertext string, ready to send via REST/Socket
   */
  static async encrypt(
    conversationId: string,
    recipientUserId: string,
    plaintext: string,
  ): Promise<string> {
    const identity = await loadIdentityKey();
    if (!identity) throw new Error('SignalProtocol.encrypt: no identity key — call ensureIdentityKey() first');

    // 1. Load existing ratchet state (if any).
    let state = await loadRatchetState(conversationId);
    let x3dhHeaderEncoded: string | undefined;

    if (!state) {
      // New session — run X3DH as initiator.
      const bundle = await fetchPreKeyBundle(recipientUserId);
      if (!bundle) {
        throw new Error(`SignalProtocol.encrypt: no pre-key bundle for user ${recipientUserId}`);
      }
      const x3dh = await initiateX3DH(identity, bundle);

      // Save peer's identity key (trust-on-first-use).
      const existingPeer = await loadPeerIdentity(conversationId);
      if (!existingPeer) {
        await savePeerIdentity(conversationId, {
          identityKeyBase64: bundle.identityKeyBase64,
          verified: false,
        });
      }

      // Initialize DR with shared secret as root key.
      state = initDoubleRatchet(x3dh.sharedSecret, null);

      // Encode the X3DH header to embed in the first message.
      const x3dhHeader: X3DHHeader = {
        identityPublicKeyBase64: x3dh.identityPublicKeyBase64,
        ephemeralPublicKeyBase64: x3dh.ephemeralPublicKeyBase64,
        oneTimePreKeyId: x3dh.oneTimePreKeyId,
      };
      x3dhHeaderEncoded = encodeX3DHHeader(x3dhHeader);
    }

    // 2. Encrypt with Double Ratchet.
    const plaintextBytes = new TextEncoder().encode(plaintext);
    const ct: RatchetCiphertext = await ratchetEncrypt(state, plaintextBytes, x3dhHeaderEncoded);

    // 3. Persist updated state.
    await saveRatchetState(conversationId, state!);

    // 4. Encode the final payload.
    const payload = {
      v: 1,
      x3dh: ct.x3dhHeaderBase64 ?? null,
      header: ct.headerBase64,
      iv_ct: ct.ivCiphertextBase64,
    };
    const payloadStr = JSON.stringify(payload);
    const payloadB64 = bufToBase64(new TextEncoder().encode(payloadStr).buffer);
    return `SIG3:${payloadB64}`;
  }

  /**
   * Decrypt a `SIG3:`-prefixed message.
   *
   * @param conversationId Conversation ID
   * @param senderUserId Sender's user ID (for fetching their identity key if needed)
   * @param ciphertext `SIG3:<base64>` payload
   * @returns UTF-8 plaintext
   */
  static async decrypt(
    conversationId: string,
    senderUserId: string,
    ciphertext: string,
  ): Promise<string> {
    if (!ciphertext.startsWith('SIG3:')) {
      throw new Error('SignalProtocol.decrypt: not a SIG3 message');
    }
    const payloadB64 = ciphertext.substring(5);
    const payloadJson = new TextDecoder().decode(new Uint8Array(base64ToBuf(payloadB64)));
    const payload = JSON.parse(payloadJson) as {
      v: number;
      x3dh: string | null;
      header: string;
      iv_ct: string;
    };

    let state = await loadRatchetState(conversationId);

    // 1. If there's an X3DH header, this is the first message of a new session.
    if (payload.x3dh) {
      const x3dhHeader = decodeX3DHHeader(payload.x3dh);

      // Load our identity + signed pre-key + (if specified) the consumed OPK.
      const myIdentity = await loadIdentityKey();
      if (!myIdentity) throw new Error('SignalProtocol.decrypt: no local identity key');
      const mySpk = await loadSignedPreKey();
      if (!mySpk) throw new Error('SignalProtocol.decrypt: no signed pre-key — call publishPreKeyBundle() first');

      // Try to consume the OPK locally (server has already marked it consumed
      // when Alice fetched it; we may still have the priv key in IDB).
      let myOpk: OneTimePreKey | null = null;
      if (x3dhHeader.oneTimePreKeyId !== null) {
        myOpk = await consumeOneTimePreKey(x3dhHeader.oneTimePreKeyId);
        // If myOpk is null (already consumed in a prior message), X3DH will
        // produce a different SK — but since this is the first message of a
        // new session, that shouldn't happen in normal flow.
      }

      const x3dh = await receiveX3DH(myIdentity, mySpk, myOpk, x3dhHeader);

      // Save peer identity (trust-on-first-use).
      const existingPeer = await loadPeerIdentity(conversationId);
      if (!existingPeer) {
        await savePeerIdentity(conversationId, {
          identityKeyBase64: x3dh.aliceIdentityPublicKeyBase64,
          verified: false,
        });
      }

      state = initDoubleRatchet(x3dh.sharedSecret, null);
    }

    if (!state) {
      throw new Error('SignalProtocol.decrypt: no ratchet state and no X3DH header — cannot decrypt');
    }

    // 2. Decrypt with Double Ratchet.
    const ct: RatchetCiphertext = {
      headerBase64: payload.header,
      ivCiphertextBase64: payload.iv_ct,
    };
    const plaintextBytes = await ratchetDecrypt(state, ct);

    // 3. Persist updated state.
    await saveRatchetState(conversationId, state);

    return new TextDecoder().decode(plaintextBytes);
  }

  /**
   * Reset the session for a conversation (e.g., after a key change).
   * Deletes ratchet state + peer identity.
   */
  static async resetSession(conversationId: string): Promise<void> {
    await deleteRatchetState(conversationId);
    // Keep peer identity for trust continuity.
  }

  /**
   * Check if V3 Signal is enabled for this device (identity key exists).
   */
  static async isEnabled(): Promise<boolean> {
    return hasIdentityKey();
  }

  /**
   * Check if a `SIG3:`-prefixed message is a V3 Signal payload.
   */
  static isSignalPayload(content: string): boolean {
    return content?.startsWith('SIG3:');
  }
}
