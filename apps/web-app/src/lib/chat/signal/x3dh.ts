/**
 * ============================================================================
 * SIGNAL PROTOCOL V3 — X3DH (Extended Triple Diffie-Hellman)
 * ============================================================================
 *
 * X3DH establishes a shared secret between an initiator (Alice) and a
 * recipient (Bob) using:
 *   - Alice's identity key (IK_A)
 *   - Alice's ephemeral key (EK_A) — fresh per session
 *   - Bob's identity key (IK_B) — fetched from backend
 *   - Bob's signed pre-key (SPK_B) — fetched from backend, signed by IK_B
 *   - Bob's one-time pre-key (OPK_B) — fetched from backend (optional, atomically consumed)
 *
 * Shared secret:
 *   DH1 = DH(IK_A_priv, SPK_B_pub)
 *   DH2 = DH(EK_A_priv, IK_B_pub)
 *   DH3 = DH(EK_A_priv, SPK_B_pub)
 *   DH4 = DH(EK_A_priv, OPK_B_pub)   [if OPK available]
 *   SK  = HKDF-SHA256(DH1 || DH2 || DH3 || DH4, salt="", info="helm_connect_x3dh_v1")
 *
 * The output SK (32 bytes) seeds the Double Ratchet as the initial root_key.
 *
 * Alice's initial message header (sent with the first DR message):
 *   { ik: IK_A_pub_base64, ek: EK_A_pub_base64, opkId: number|null }
 *
 * Bob, on receiving this header, looks up his SPK + OPK private halves and
 * computes the same SK. He then initializes his DR and processes the message.
 * ============================================================================
 */

import { IdentityKeyPair, loadIdentityKey, verifyWithIdentityKey } from './identity';
import {
  PreKeyBundle, SignedPreKey, OneTimePreKey,
  importEcdhPublicKey, importEcdhPrivateKey,
} from './prekeys';
import { bufToBase64, base64ToBuf } from './identity';

// ─── DH + HKDF helpers ──────────────────────────────────────────────────

async function dh(privateKey: CryptoKey, publicKey: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256, // 32 bytes
  );
}

async function hkdf(ikm: ArrayBuffer, salt: ArrayBuffer, info: string): Promise<ArrayBuffer> {
  const infoBytes = new TextEncoder().encode(info);
  const baseKey = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits']);
  return crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: infoBytes },
    baseKey,
    256, // 32 bytes output (root key)
  );
}

async function concatBuffers(...bufs: ArrayBuffer[]): Promise<ArrayBuffer> {
  const total = bufs.reduce((sum, b) => sum + b.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const b of bufs) {
    out.set(new Uint8Array(b), offset);
    offset += b.byteLength;
  }
  return out.buffer;
}

// ─── X3DH Initiator (Alice) ─────────────────────────────────────────────

export interface X3DHInitiatorResult {
  /** Derived 32-byte shared secret (used as initial DR root key). */
  sharedSecret: ArrayBuffer;
  /** Alice's ephemeral public key (base64 SPKI) — to include in the header. */
  ephemeralPublicKeyBase64: string;
  /** Alice's identity public key (base64 SPKI). */
  identityPublicKeyBase64: string;
  /** ID of Bob's one-time pre-key that was consumed (null if none). */
  oneTimePreKeyId: number | null;
}

/**
 * Run X3DH as the initiator (Alice). Fetches Bob's bundle (assumed already
 * fetched from backend), verifies the SPK signature, generates an ephemeral
 * key, and derives the shared secret.
 *
 * @param aliceIdentity Alice's loaded identity keypair
 * @param bobBundle Bob's pre-key bundle (fetched from backend)
 */
export async function initiateX3DH(
  aliceIdentity: IdentityKeyPair,
  bobBundle: PreKeyBundle,
): Promise<X3DHInitiatorResult> {
  // 1. Verify Bob's SPK signature using his identity key.
  const spkSignature = base64ToBuf(bobBundle.signedPreKey.signatureBase64);
  const spkPubKeyBuf = base64ToBuf(bobBundle.signedPreKey.publicKeyBase64);
  const valid = await verifyWithIdentityKey(
    bobBundle.identityKeyBase64,
    spkSignature,
    spkPubKeyBuf,
  );
  if (!valid) {
    throw new Error('X3DH: signed pre-key signature verification failed');
  }

  // 2. Generate ephemeral key (EK_A).
  const ephemeralKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, ['deriveBits'],
  );
  const ephemeralPubKeyBuf = await crypto.subtle.exportKey('spki', ephemeralKeyPair.publicKey);
  const ephemeralPublicKeyBase64 = bufToBase64(ephemeralPubKeyBuf);

  // 3. Import Bob's public keys.
  const bobIkPub = await importEcdhPublicKey(bobBundle.identityKeyBase64);
  const bobSpkPub = await importEcdhPublicKey(bobBundle.signedPreKey.publicKeyBase64);
  const bobOpkPub = bobBundle.oneTimePreKey
    ? await importEcdhPublicKey(bobBundle.oneTimePreKey.publicKeyBase64)
    : null;

  // 4. Compute DH1, DH2, DH3, (DH4).
  const dh1 = await dh(aliceIdentity.privateKey, bobSpkPub);
  const dh2 = await dh(ephemeralKeyPair.privateKey, bobIkPub);
  const dh3 = await dh(ephemeralKeyPair.privateKey, bobSpkPub);
  const dh4 = bobOpkPub ? await dh(ephemeralKeyPair.privateKey, bobOpkPub) : null;

  // 5. Concatenate in order + HKDF.
  const ikm = dh4
    ? await concatBuffers(dh1, dh2, dh3, dh4)
    : await concatBuffers(dh1, dh2, dh3);
  const salt = new ArrayBuffer(0); // empty salt per Signal spec
  const sharedSecret = await hkdf(ikm, salt, 'helm_connect_x3dh_v1');

  return {
    sharedSecret,
    ephemeralPublicKeyBase64,
    identityPublicKeyBase64: aliceIdentity.publicKeyBase64,
    oneTimePreKeyId: bobBundle.oneTimePreKey?.id ?? null,
  };
}

// ─── X3DH Recipient (Bob) ───────────────────────────────────────────────

export interface X3DHRecipientResult {
  /** Derived 32-byte shared secret (used as initial DR root key). */
  sharedSecret: ArrayBuffer;
  /** Alice's identity public key (base64 SPKI) — to associate with the DR session. */
  aliceIdentityPublicKeyBase64: string;
}

/**
 * Run X3DH as the recipient (Bob). Called when Bob receives Alice's initial
 * message header. Looks up his SPK + OPK private halves (the OPK was
 * atomically marked consumed on the server when Alice fetched it; Bob's
 * local copy may still be present if he hasn't synced yet — we look it up
 * and consume it locally too).
 *
 * @param bobIdentity Bob's loaded identity keypair
 * @param bobSignedPreKey Bob's signed pre-key (with private JWK)
 * @param bobOneTimePreKey Bob's one-time pre-key matching the header's opkId
 *        (null if Alice didn't use one)
 * @param aliceHeader Alice's initial message header
 */
export async function receiveX3DH(
  bobIdentity: IdentityKeyPair,
  bobSignedPreKey: SignedPreKey,
  bobOneTimePreKey: OneTimePreKey | null,
  aliceHeader: X3DHHeader,
): Promise<X3DHRecipientResult> {
  // 1. Import Bob's private keys.
  const bobSpkPriv = await importEcdhPrivateKey(bobSignedPreKey.privateJwk);
  const bobOpkPriv = bobOneTimePreKey
    ? await importEcdhPrivateKey(bobOneTimePreKey.privateJwk)
    : null;

  // 2. Import Alice's public keys.
  const aliceIkPub = await importEcdhPublicKey(aliceHeader.identityPublicKeyBase64);
  const aliceEkPub = await importEcdhPublicKey(aliceHeader.ephemeralPublicKeyBase64);

  // 3. Compute DH1 = DH(IK_B_priv, SPK_A_pub)? No — wait. Signal spec for recipient:
  //    DH1 = DH(IK_B_priv, SPK_A_pub)? No. The spec says:
  //    DH1 = DH(IK_A, SPK_B) — Alice computes DH(IK_A_priv, SPK_B_pub)
  //                        — Bob computes DH(SPK_B_priv, IK_A_pub) — same ECDH result.
  //    DH2 = DH(EK_A, IK_B) — Alice: DH(EK_A_priv, IK_B_pub)
  //                        — Bob: DH(IK_B_priv, EK_A_pub)
  //    DH3 = DH(EK_A, SPK_B) — Alice: DH(EK_A_priv, SPK_B_pub)
  //                         — Bob: DH(SPK_B_priv, EK_A_pub)
  //    DH4 = DH(EK_A, OPK_B) — Alice: DH(EK_A_priv, OPK_B_pub)
  //                         — Bob: DH(OPK_B_priv, EK_A_pub)
  const dh1 = await dh(bobSpkPriv, aliceIkPub);
  const dh2 = await dh(bobIdentity.privateKey, aliceEkPub);
  const dh3 = await dh(bobSpkPriv, aliceEkPub);
  const dh4 = bobOpkPriv ? await dh(bobOpkPriv, aliceEkPub) : null;

  // 4. Concatenate + HKDF (same as initiator).
  const ikm = dh4
    ? await concatBuffers(dh1, dh2, dh3, dh4)
    : await concatBuffers(dh1, dh2, dh3);
  const salt = new ArrayBuffer(0);
  const sharedSecret = await hkdf(ikm, salt, 'helm_connect_x3dh_v1');

  return {
    sharedSecret,
    aliceIdentityPublicKeyBase64: aliceHeader.identityPublicKeyBase64,
  };
}

// ─── Header (transmitted with the first DR message) ───────────────────

export interface X3DHHeader {
  identityPublicKeyBase64: string;
  ephemeralPublicKeyBase64: string;
  oneTimePreKeyId: number | null;
}

export function encodeX3DHHeader(header: X3DHHeader): string {
  return bufToBase64(new TextEncoder().encode(JSON.stringify(header)).buffer);
}

export function decodeX3DHHeader(encoded: string): X3DHHeader {
  const json = new TextDecoder().decode(new Uint8Array(base64ToBuf(encoded)));
  return JSON.parse(json) as X3DHHeader;
}
