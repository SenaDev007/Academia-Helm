/**
 * ============================================================================
 * E2E ENCRYPTION UTILITIES (Web Crypto API)
 * ============================================================================
 *
 * Implements basic end-to-end encryption for chat messages:
 *   - RSA-OAEP key pair generation (2048-bit)
 *   - Public key export as base64 SPKI format
 *   - Private key storage in browser IndexedDB (never sent to server)
 *   - Message encryption with recipient's public key
 *   - Message decryption with own private key
 *
 * ⭐ This is a SIMPLIFIED version of Signal protocol:
 *   - No forward secrecy (ratchet)
 *   - No pre-key bundles
 *   - For group chats: encrypts with each member's public key (or falls back
 *     to plaintext if any member has no key)
 *
 * V3 will implement proper Signal protocol with X3DH + Double Ratchet.
 * ============================================================================
 */

const DB_NAME = 'academia-helm-chat';
const DB_VERSION = 1;
const STORE_NAME = 'crypto-keys';
const PRIVATE_KEY_RECORD_ID = 'my-private-key';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
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

export async function generateKeyPair(): Promise<{ publicKeyBase64: string }> {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['encrypt', 'decrypt'],
  );
  const pubKeyBuf = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const publicKeyBase64 = bufToBase64(pubKeyBuf);
  const privKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
  await idbSet(PRIVATE_KEY_RECORD_ID, privKeyJwk);
  return { publicKeyBase64 };
}

export async function hasPrivateKey(): Promise<boolean> {
  const jwk = await idbGet<JsonWebKey>(PRIVATE_KEY_RECORD_ID);
  return jwk !== null;
}

async function importPublicKey(publicKeyBase64: string): Promise<CryptoKey> {
  const buf = base64ToBuf(publicKeyBase64);
  return crypto.subtle.importKey('spki', buf, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
}

async function loadPrivateKey(): Promise<CryptoKey | null> {
  const jwk = await idbGet<JsonWebKey>(PRIVATE_KEY_RECORD_ID);
  if (!jwk) return null;
  return crypto.subtle.importKey('jwk', jwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['decrypt']);
}

export async function encryptMessage(plaintext: string, recipientPublicKeyBase64: string | null): Promise<string> {
  if (!recipientPublicKeyBase64) return plaintext;
  try {
    const pubKey = await importPublicKey(recipientPublicKeyBase64);
    const data = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pubKey, data);
    return `E2E:${bufToBase64(ciphertext)}`;
  } catch { return plaintext; }
}

export async function decryptMessage(ciphertext: string): Promise<string> {
  if (!ciphertext.startsWith('E2E:')) return ciphertext;
  try {
    const privKey = await loadPrivateKey();
    if (!privKey) return '🔒 Message chiffré (clé privée manquante)';
    const buf = base64ToBuf(ciphertext.substring(4));
    const decrypted = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privKey, buf);
    return new TextDecoder().decode(decrypted);
  } catch { return '🔒 Message chiffré (déchiffrement impossible)'; }
}

export function isEncrypted(content: string): boolean {
  return content?.startsWith('E2E:');
}
