/**
 * ============================================================================
 * SIGNAL PROTOCOL V3 — DOUBLE RATCHET (forward secrecy)
 * ============================================================================
 *
 * After X3DH establishes a shared secret (SK), both parties run the Double
 * Ratchet algorithm. Each message uses a unique key derived from a chain
 * key, and the chain key is updated after each message. The DH ratchet
 * rotates the root key whenever a new DH public key is received.
 *
 * State per conversation (per direction):
 *   - rootKey: 32 bytes
 *   - sendingChainKey: 32 bytes (or null if not yet initialized)
 *   - receivingChainKey: 32 bytes (or null)
 *   - sendingDhKeyPair: { private, public } — our current DH ratchet keypair
 *   - receivingDhPublicKey: peer's current DH public key
 *   - sendingMessageNumber: counter (Ns)
 *   - receivingMessageNumber: counter (Nr)
 *   - previousChainLength: PN (number of messages in the previous chain)
 *
 * Algorithm (simplified, matches Signal spec):
 *
 *   On SEND:
 *     1. If we have no sendingDhKeyPair yet (just received X3DH), generate one.
 *     2. If peer's DH key changed since last send, ratchet:
 *        - receivingDhPublicKey = peer's new DH key
 *        - sendingDhKeyPair = new ECDH P-256 keypair
 *        - dhOut = DH(sendingDhKeyPair.priv, receivingDhPublicKey)
 *        - [rootKey, sendingChainKey] = HKDF(rootKey, dhOut, "dr_root")
 *        - sendingMessageNumber = 0
 *        - previousChainLength = receivingMessageNumber
 *     3. Derive message key: [messageKey, sendingChainKey] = HKDF(sendingChainKey, "", "dr_msg")
 *     4. sendingMessageNumber++
 *     5. Encrypt plaintext with AES-GCM-256 using messageKey.
 *     6. Header: { dh: sendingDhKeyPair.pub, n: sendingMessageNumber-1, pn: previousChainLength }
 *
 *   On RECEIVE:
 *     1. If header.dh differs from receivingDhPublicKey, ratchet (same as send step 2).
 *     2. Skip ahead in receiving chain: derive Nr - header.n message keys (or use skipped-keys cache).
 *     3. Derive message key from receivingChainKey.
 *     4. Decrypt with AES-GCM-256.
 *
 * ⭐ This implementation is simplified — no skipped-keys cache (we assume
 *    in-order delivery, which is OK for a chat where Socket.io preserves
 *    order per conversation). V3.1 will add a skipped-keys cache for full
 *    out-of-order resilience.
 * ============================================================================
 */

import { bufToBase64, base64ToBuf } from './identity';

// ─── Crypto helpers ─────────────────────────────────────────────────────

async function dh(privateKey: CryptoKey, publicKey: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.deriveBits(
    { name: 'ECDH', public: publicKey },
    privateKey,
    256,
  );
}

async function hkdf(ikm: ArrayBuffer, salt: ArrayBuffer, info: string, outputBytes: number = 64): Promise<ArrayBuffer> {
  const infoBytes = new TextEncoder().encode(info);
  const baseKey = await crypto.subtle.importKey('raw', ikm, { name: 'HKDF' }, false, ['deriveBits']);
  return crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: infoBytes },
    baseKey,
    outputBytes * 8,
  );
}

async function generateDhKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true, ['deriveBits'],
  );
}

async function exportPublicKeyBase64(key: CryptoKey): Promise<string> {
  const buf = await crypto.subtle.exportKey('spki', key);
  return bufToBase64(buf);
}

async function importPublicKey(base64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'spki', base64ToBuf(base64),
    { name: 'ECDH', namedCurve: 'P-256' },
    false, [],
  );
}

async function aesGcmEncrypt(key: ArrayBuffer, iv: ArrayBuffer, plaintext: ArrayBuffer): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'AES-GCM' }, false, ['encrypt'],
  );
  return crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, plaintext);
}

async function aesGcmDecrypt(key: ArrayBuffer, iv: ArrayBuffer, ciphertext: ArrayBuffer): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', key, { name: 'AES-GCM' }, false, ['decrypt'],
  );
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ciphertext);
}

function randomBytes(n: number): ArrayBuffer {
  const arr = new Uint8Array(n);
  crypto.getRandomValues(arr);
  return arr.buffer;
}

async function concatBuffers(...bufs: ArrayBuffer[]): Promise<ArrayBuffer> {
  const total = bufs.reduce((s, b) => s + b.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const b of bufs) {
    out.set(new Uint8Array(b), offset);
    offset += b.byteLength;
  }
  return out.buffer;
}

function splitBuffer(buf: ArrayBuffer, at: number): [ArrayBuffer, ArrayBuffer] {
  return [buf.slice(0, at), buf.slice(at)];
}

// ─── Types ──────────────────────────────────────────────────────────────

export interface DoubleRatchetState {
  /** 32-byte root key (updated on each DH ratchet step). */
  rootKey: ArrayBuffer;
  /** 32-byte sending chain key (or null if not yet initialized). */
  sendingChainKey: ArrayBuffer | null;
  /** 32-byte receiving chain key (or null). */
  receivingChainKey: ArrayBuffer | null;
  /** Our current DH keypair (private + public) — JWK-formatted for storage. */
  sendingDhPrivateJwk: JsonWebKey | null;
  sendingDhPublicKeyBase64: string | null;
  /** Peer's current DH public key (base64 SPKI). */
  receivingDhPublicKeyBase64: string | null;
  /** Message number in the sending chain. */
  sendingMessageNumber: number;
  /** Message number in the receiving chain. */
  receivingMessageNumber: number;
  /** Length of the previous sending chain (PN). */
  previousChainLength: number;
}

export interface RatchetHeader {
  /** Our DH public key (base64 SPKI). */
  dh: string;
  /** Message number in the current chain (Ns). */
  n: number;
  /** Previous chain length (PN). */
  pn: number;
}

export interface RatchetCiphertext {
  /** Base64-encoded X3DH header (only present on the first message). */
  x3dhHeaderBase64?: string;
  /** Base64-encoded ratchet header. */
  headerBase64: string;
  /** Base64-encoded IV (12 bytes) + ciphertext + tag. */
  ivCiphertextBase64: string;
}

// ─── State management ────────────────────────────────────────────────────

/**
 * Initialize the Double Ratchet state from the X3DH shared secret.
 * - For the initiator (Alice): peerDhPublicKeyBase64 is null (she hasn't
 *   received a message yet) — the ratchet will be created on first send
 *   with a fresh DH keypair.
 * - For the recipient (Bob): peerDhPublicKeyBase64 is also null initially
 *   (the DH ratchet kicks in on the first message exchange).
 */
export function initDoubleRatchet(
  sharedSecret: ArrayBuffer,
  peerDhPublicKeyBase64: string | null = null,
): DoubleRatchetState {
  return {
    rootKey: sharedSecret,
    sendingChainKey: null,
    receivingChainKey: null,
    sendingDhPrivateJwk: null,
    sendingDhPublicKeyBase64: null,
    receivingDhPublicKeyBase64: peerDhPublicKeyBase64,
    sendingMessageNumber: 0,
    receivingMessageNumber: 0,
    previousChainLength: 0,
  };
}

// ─── Encrypt (send) ─────────────────────────────────────────────────────

/**
 * Encrypt a message using the Double Ratchet.
 * Updates the state in-place (mutates `state`).
 */
export async function ratchetEncrypt(
  state: DoubleRatchetState,
  plaintext: ArrayBuffer,
  x3dhHeaderBase64?: string,
): Promise<RatchetCiphertext> {
  // 1. If no sending DH keypair yet, generate one + ratchet (if peer key known).
  if (!state.sendingDhPrivateJwk) {
    const newKeyPair = await generateDhKeyPair();
    state.sendingDhPrivateJwk = await crypto.subtle.exportKey('jwk', newKeyPair.privateKey);
    state.sendingDhPublicKeyBase64 = await exportPublicKeyBase64(newKeyPair.publicKey);

    // If we know the peer's DH key, perform the DH ratchet step.
    if (state.receivingDhPublicKeyBase64) {
      const peerPub = await importPublicKey(state.receivingDhPublicKeyBase64);
      const privKey = await crypto.subtle.importKey(
        'jwk', state.sendingDhPrivateJwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        false, ['deriveBits'],
      );
      const dhOut = await dh(privKey, peerPub);
      const derived = await hkdf(state.rootKey, dhOut, 'helm_dr_root_v1', 64);
      const [newRoot, newChain] = splitBuffer(derived, 32);
      state.rootKey = newRoot;
      state.sendingChainKey = newChain;
      state.sendingMessageNumber = 0;
      state.previousChainLength = state.receivingMessageNumber;
    }
  }

  // 2. If still no sending chain key (rare — peer key unknown on first send),
  //    derive it from the root key directly.
  if (!state.sendingChainKey) {
    const derived = await hkdf(state.rootKey, new ArrayBuffer(0), 'helm_dr_init_v1', 64);
    const [newRoot, newChain] = splitBuffer(derived, 32);
    state.rootKey = newRoot;
    state.sendingChainKey = newChain;
  }

  // 3. Derive message key from sending chain key (and advance the chain).
  const derived = await hkdf(state.sendingChainKey, new ArrayBuffer(0), 'helm_dr_msg_v1', 64);
  const [messageKey, newChainKey] = splitBuffer(derived, 32);
  state.sendingChainKey = newChainKey;
  const n = state.sendingMessageNumber;
  state.sendingMessageNumber++;

  // 4. Encrypt plaintext with AES-GCM-256.
  const iv = randomBytes(12);
  const ciphertext = await aesGcmEncrypt(messageKey, iv, plaintext);

  // 5. Build header.
  const header: RatchetHeader = {
    dh: state.sendingDhPublicKeyBase64!,
    n,
    pn: state.previousChainLength,
  };
  const headerBase64 = bufToBase64(new TextEncoder().encode(JSON.stringify(header)).buffer);

  // 6. Concatenate IV + ciphertext (the GCM tag is appended by Web Crypto).
  const ivCiphertext = await concatBuffers(iv, ciphertext);
  const ivCiphertextBase64 = bufToBase64(ivCiphertext);

  return {
    x3dhHeaderBase64,
    headerBase64,
    ivCiphertextBase64,
  };
}

// ─── Decrypt (receive) ──────────────────────────────────────────────────

/**
 * Decrypt a message using the Double Ratchet.
 * Updates the state in-place (mutates `state`).
 *
 * Throws if the message key cannot be derived (e.g., out-of-order message
 * that we can't handle without a skipped-keys cache — V3.1 will fix).
 */
export async function ratchetDecrypt(
  state: DoubleRatchetState,
  ciphertext: RatchetCiphertext,
): Promise<ArrayBuffer> {
  const headerJson = new TextDecoder().decode(new Uint8Array(base64ToBuf(ciphertext.headerBase64)));
  const header = JSON.parse(headerJson) as RatchetHeader;

  // 1. If the peer's DH key changed (or first message), ratchet.
  if (state.receivingDhPublicKeyBase64 !== header.dh) {
    state.receivingDhPublicKeyBase64 = header.dh;
    state.receivingMessageNumber = 0;

    // If we have a sending DH keypair, derive new root + receiving chain.
    if (state.sendingDhPrivateJwk) {
      const peerPub = await importPublicKey(header.dh);
      const privKey = await crypto.subtle.importKey(
        'jwk', state.sendingDhPrivateJwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        false, ['deriveBits'],
      );
      const dhOut = await dh(privKey, peerPub);
      const derived = await hkdf(state.rootKey, dhOut, 'helm_dr_root_v1', 64);
      const [newRoot, newRecvChain] = splitBuffer(derived, 32);
      state.rootKey = newRoot;
      state.receivingChainKey = newRecvChain;

      // Generate a new sending DH keypair for the next send.
      const newKeyPair = await generateDhKeyPair();
      state.sendingDhPrivateJwk = await crypto.subtle.exportKey('jwk', newKeyPair.privateKey);
      state.sendingDhPublicKeyBase64 = await exportPublicKeyBase64(newKeyPair.publicKey);

      // Derive sending chain from new DH (using the new peer key).
      const newPrivKey = await crypto.subtle.importKey(
        'jwk', state.sendingDhPrivateJwk,
        { name: 'ECDH', namedCurve: 'P-256' },
        false, ['deriveBits'],
      );
      const dhOut2 = await dh(newPrivKey, peerPub);
      const derived2 = await hkdf(state.rootKey, dhOut2, 'helm_dr_root_v1', 64);
      const [newRoot2, newSendChain] = splitBuffer(derived2, 32);
      state.rootKey = newRoot2;
      state.sendingChainKey = newSendChain;
      state.sendingMessageNumber = 0;
      state.previousChainLength = header.pn;
    }
  }

  // 2. Skip-ahead detection (simplified — assumes in-order delivery).
  if (header.n < state.receivingMessageNumber) {
    throw new Error('DR: out-of-order message not supported in V3 (skipped-keys cache coming in V3.1)');
  }
  // For simplicity, we advance the receiving chain key to match header.n.
  // If header.n > receivingMessageNumber, we derive + discard intermediate keys.
  while (state.receivingMessageNumber < header.n) {
    if (!state.receivingChainKey) {
      // No receiving chain yet — derive from root.
      const derived = await hkdf(state.rootKey, new ArrayBuffer(0), 'helm_dr_init_v1', 64);
      const [newRoot, newChain] = splitBuffer(derived, 32);
      state.rootKey = newRoot;
      state.receivingChainKey = newChain;
    }
    const adv = await hkdf(state.receivingChainKey, new ArrayBuffer(0), 'helm_dr_msg_v1', 64);
    const [, newChainKey] = splitBuffer(adv, 32);
    state.receivingChainKey = newChainKey;
    state.receivingMessageNumber++;
  }

  // 3. Derive the message key from the receiving chain key.
  if (!state.receivingChainKey) {
    const derived = await hkdf(state.rootKey, new ArrayBuffer(0), 'helm_dr_init_v1', 64);
    const [newRoot, newChain] = splitBuffer(derived, 32);
    state.rootKey = newRoot;
    state.receivingChainKey = newChain;
  }
  const msgDerived = await hkdf(state.receivingChainKey, new ArrayBuffer(0), 'helm_dr_msg_v1', 64);
  const [messageKey, newRecvChain] = splitBuffer(msgDerived, 32);
  state.receivingChainKey = newRecvChain;
  state.receivingMessageNumber++;

  // 4. Split IV + ciphertext.
  const ivCiphertext = base64ToBuf(ciphertext.ivCiphertextBase64);
  const [iv, ct] = splitBuffer(ivCiphertext, 12);

  // 5. Decrypt with AES-GCM-256.
  return aesGcmDecrypt(messageKey, iv, ct);
}
