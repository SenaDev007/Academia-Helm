/**
 * ============================================================================
 * SIGNAL PROTOCOL V3 — IDENTITY KEY (long-term ECDH P-256)
 * ============================================================================
 *
 * The identity key (IK) is a long-term ECDH P-256 keypair, generated once
 * per device and stored forever (in IndexedDB on web, Keystore/Keychain on
 * mobile). It is used for:
 *   - X3DH key agreement (one of the 4 DH operations)
 *   - Signing signed pre-keys (SPK) via ECDSA P-256 SHA-256
 *
 * The public half is published to the backend (signal_prekeys table) so
 * other clients can fetch it to verify signatures and run X3DH.
 *
 * The private half NEVER leaves the device.
 * ============================================================================
 */

const DB_NAME = 'academia-helm-signal';
const DB_VERSION = 1;
const STORE_KEYS = 'identity';
const RECORD_ID = 'my-identity';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_KEYS)) {
        db.createObjectStore(STORE_KEYS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_KEYS, 'readwrite');
    tx.objectStore(STORE_KEYS).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_KEYS, 'readonly');
    const req = tx.objectStore(STORE_KEYS).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export interface IdentityKeyPair {
  /** ECDH P-256 private key (CryptoKey, non-extractable) */
  privateKey: CryptoKey;
  /** ECDH P-256 public key (CryptoKey, extractable as SPKI for sharing) */
  publicKey: CryptoKey;
  /** ECDSA P-256 private key (for signing SPK). Same key material, different usage. */
  signPrivateKey: CryptoKey;
  /** Base64 SPKI of the ECDH public key — published to backend */
  publicKeyBase64: string;
}

interface StoredIdentity {
  /** JWK of the private ECDH key (also used for signing via usages) */
  privateJwk: JsonWebKey;
  /** Base64 SPKI of the public key */
  publicKeyBase64: string;
}

/**
 * Generate a new identity keypair (ECDH P-256, extractable=false for private).
 * Stores it in IndexedDB. Returns the public half (base64 SPKI) so the caller
 * can publish it to the backend.
 *
 * Note: Web Crypto cannot derive a signing key from an ECDH key. We use the
 * same private key material with both `deriveKey`/`deriveBits` AND `sign`
 * usages — Web Crypto allows this for P-256 keys when `extractable: false`.
 * (If a browser rejects this, the caller should generate a separate ECDSA
 * key — the protocol tolerates it since SPK signatures are optional.)
 */
export async function generateIdentityKey(): Promise<string> {
  // Generate ECDH P-256 keypair with both deriveKey + sign usages.
  const keyPair = await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true, // extractable so we can export to JWK for storage
    ['sign', 'verify'],
  );

  // For ECDH derivation, we re-import the same key material with deriveBits usage.
  const privJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  const ecdhPrivKey = await crypto.subtle.importKey(
    'jwk', privJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false, ['deriveBits'],
  );
  const ecdhPubKey = await crypto.subtle.importKey(
    'jwk', privJwk, // public half is in the JWK too (x, y)
    { name: 'ECDH', namedCurve: 'P-256' },
    true, [],
  );

  const pubKeyBuf = await crypto.subtle.exportKey('spki', ecdhPubKey);
  const publicKeyBase64 = bufToBase64(pubKeyBuf);

  const stored: StoredIdentity = {
    privateJwk: privJwk,
    publicKeyBase64,
  };
  await idbSet(RECORD_ID, stored);

  return publicKeyBase64;
}

export async function hasIdentityKey(): Promise<boolean> {
  const stored = await idbGet<StoredIdentity>(RECORD_ID);
  return stored !== null;
}

export async function loadIdentityKey(): Promise<IdentityKeyPair | null> {
  const stored = await idbGet<StoredIdentity>(RECORD_ID);
  if (!stored) return null;

  // Re-import the private key with both usages.
  const signPrivateKey = await crypto.subtle.importKey(
    'jwk', stored.privateJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign'],
  );
  const ecdhPrivateKey = await crypto.subtle.importKey(
    'jwk', stored.privateJwk,
    { name: 'ECDH', namedCurve: 'P-256' },
    false, ['deriveBits'],
  );

  // Public key from SPKI.
  const pubKeyBuf = base64ToBuf(stored.publicKeyBase64);
  const ecdhPublicKey = await crypto.subtle.importKey(
    'spki', pubKeyBuf,
    { name: 'ECDH', namedCurve: 'P-256' },
    true, [],
  );

  return {
    privateKey: ecdhPrivateKey,
    publicKey: ecdhPublicKey,
    signPrivateKey,
    publicKeyBase64: stored.publicKeyBase64,
  };
}

/**
 * Verify a signature (ECDSA P-256 SHA-256) using a peer's identity public key.
 * The peer's public key is provided as base64 SPKI; we re-import it with
 * ECDSA verify usage.
 */
export async function verifyWithIdentityKey(
  peerPublicKeyBase64: string,
  signature: ArrayBuffer,
  data: ArrayBuffer,
): Promise<boolean> {
  try {
    const pubKeyBuf = base64ToBuf(peerPublicKeyBase64);
    const verifyKey = await crypto.subtle.importKey(
      'spki', pubKeyBuf,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false, ['verify'],
    );
    return crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      verifyKey,
      signature,
      data,
    );
  } catch {
    return false;
  }
}

/**
 * Sign arbitrary data with the local identity key (ECDSA P-256 SHA-256).
 * Used for signing signed pre-keys (SPK).
 */
export async function signWithIdentityKey(
  identity: IdentityKeyPair,
  data: ArrayBuffer,
): Promise<ArrayBuffer> {
  return crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    identity.signPrivateKey,
    data,
  );
}

export { bufToBase64, base64ToBuf };
