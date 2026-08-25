/**
 * ============================================================================
 * SIGNAL PROTOCOL V3 — PRE-KEYS (Signed Pre-Key + One-Time Pre-Keys)
 * ============================================================================
 *
 * Pre-keys are ECDH P-256 keypairs published to the backend so other clients
 * can initiate X3DH sessions with us without us being online.
 *
 * Hierarchy:
 *   - Signed Pre-Key (SPK): medium-term (rotated every ~1 month). Signed by
 *     the identity key. Stored on device + published to backend.
 *   - One-Time Pre-Keys (OPK): single-use. Generated in batches (e.g., 50),
 *     published to backend. Server atomically consumes one per X3DH initiation.
 *
 * On the device, the private halves are stored in IndexedDB so we can compute
 * the DH shared secret when an initiator contacts us.
 * ============================================================================
 */

import { bufToBase64, base64ToBuf } from './identity';

const DB_NAME = 'academia-helm-signal';
const DB_VERSION = 1;
const STORE_PREKEYS = 'prekeys';
const SPK_RECORD_ID = 'signed-prekey';
const OPK_STORE_PREFIX = 'one-time-prekey:'; // + prekeyId

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PREKEYS)) {
        db.createObjectStore(STORE_PREKEYS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PREKEYS, 'readwrite');
    tx.objectStore(STORE_PREKEYS).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PREKEYS, 'readonly');
    const req = tx.objectStore(STORE_PREKEYS).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PREKEYS, 'readwrite');
    tx.objectStore(STORE_PREKEYS).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Types ─────────────────────────────────────────────────────────────

export interface SignedPreKey {
  /** Numeric ID (assigned by client, monotonic). */
  id: number;
  /** Public key as base64 SPKI. */
  publicKeyBase64: string;
  /** Private key (JWK, non-extractable after import). Stored for our own X3DH. */
  privateJwk: JsonWebKey;
  /** ECDSA signature over the public key (SPKI bytes) by our identity key. */
  signatureBase64: string;
  /** ISO timestamp of creation. */
  createdAt: string;
}

export interface OneTimePreKey {
  /** Numeric ID (assigned by client, unique within a user). */
  id: number;
  /** Public key as base64 SPKI. */
  publicKeyBase64: string;
  /** Private key (JWK). */
  privateJwk: JsonWebKey;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** Whether this OPK has been consumed by an X3DH initiation. */
  consumed: boolean;
}

export interface PreKeyBundle {
  /** Publisher's identity public key (base64 SPKI). */
  identityKeyBase64: string;
  /** Publisher's signed pre-key. */
  signedPreKey: {
    id: number;
    publicKeyBase64: string;
    signatureBase64: string;
  };
  /** One one-time pre-key (server consumes atomically; may be null if exhausted). */
  oneTimePreKey: { id: number; publicKeyBase64: string } | null;
}

// ─── Signed Pre-Key (SPK) ────────────────────────────────────────────────

/**
 * Generate a new signed pre-key. Caller provides the identity keypair so we
 * can sign the SPK's public half.
 *
 * Returns the SPK (with private key JWK for local storage) + the signature.
 */
export async function generateSignedPreKey(
  identitySignPrivateKey: CryptoKey,
  id: number,
): Promise<SignedPreKey> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, ['deriveBits'],
  );

  const pubKeyBuf = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const publicKeyBase64 = bufToBase64(pubKeyBuf);
  const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

  // Sign the SPKI bytes of the public key with the identity key (ECDSA P-256 SHA-256).
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    identitySignPrivateKey,
    pubKeyBuf,
  );
  const signatureBase64 = bufToBase64(signature);

  const spk: SignedPreKey = {
    id,
    publicKeyBase64,
    privateJwk,
    signatureBase64,
    createdAt: new Date().toISOString(),
  };
  await idbSet(SPK_RECORD_ID, spk);
  return spk;
}

export async function loadSignedPreKey(): Promise<SignedPreKey | null> {
  return idbGet<SignedPreKey>(SPK_RECORD_ID);
}

// ─── One-Time Pre-Keys (OPK) ──────────────────────────────────────────────

/**
 * Generate a batch of one-time pre-keys. Each is a fresh ECDH P-256 keypair.
 * IDs should be unique within the user; the caller assigns them (e.g., 100..149).
 */
export async function generateOneTimePreKeys(
  startId: number,
  count: number,
): Promise<OneTimePreKey[]> {
  const keys: OneTimePreKey[] = [];
  for (let i = 0; i < count; i++) {
    const id = startId + i;
    const keyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-256' },
      true, ['deriveBits'],
    );
    const pubKeyBuf = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    const publicKeyBase64 = bufToBase64(pubKeyBuf);
    const privateJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
    const opk: OneTimePreKey = {
      id,
      publicKeyBase64,
      privateJwk,
      createdAt: new Date().toISOString(),
      consumed: false,
    };
    await idbSet(OPK_STORE_PREFIX + id, opk);
    keys.push(opk);
  }
  return keys;
}

/**
 * Look up an OPK by ID + load its private key (for X3DH on the recipient side).
 * Marks it as consumed so it can't be reused.
 */
export async function consumeOneTimePreKey(id: number): Promise<OneTimePreKey | null> {
  const opk = await idbGet<OneTimePreKey>(OPK_STORE_PREFIX + id);
  if (!opk) return null;
  if (opk.consumed) return null;
  opk.consumed = true;
  await idbSet(OPK_STORE_PREFIX + id, opk);
  // After consumption, we can delete it (the priv key is no longer needed once
  // the X3DH session is established — the DR takes over).
  await idbDelete(OPK_STORE_PREFIX + id);
  return opk;
}

/**
 * Get the count of unconsumed OPKs (for the client to decide whether to
 * generate more).
 */
export async function countUnconsumedOneTimePreKeys(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PREKEYS, 'readonly');
    const req = tx.objectStore(STORE_PREKEYS).getAllKeys();
    req.onsuccess = () => {
      const keys = (req.result as string[]) || [];
      const opkKeys = keys.filter(k => k.startsWith(OPK_STORE_PREFIX));
      // We don't track consumed state in storage (we delete on consume), so
      // all remaining OPKs are unconsumed.
      resolve(opkKeys.length);
    };
    req.onerror = () => reject(req.error);
  });
}

// ─── Import helpers (for use in X3DH) ────────────────────────────────────

export async function importEcdhPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  const buf = base64ToBuf(publicKeyBase64);
  return crypto.subtle.importKey(
    'spki', buf,
    { name: 'ECDH', namedCurve: 'P-256' },
    false, [],
  );
}

export async function importEcdhPrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false, ['deriveBits'],
  );
}
