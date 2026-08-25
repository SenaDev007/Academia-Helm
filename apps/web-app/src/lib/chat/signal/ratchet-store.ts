/**
 * ============================================================================
 * SIGNAL PROTOCOL V3 — RATCHET STATE STORE (per-conversation IndexedDB)
 * ============================================================================
 *
 * Persists Double Ratchet state per conversation in IndexedDB.
 * Each conversation has one state record (DoubleRatchetState) + the peer's
 * identity key (for trust-on-first-use verification — V3.1 will add safety
 * number display).
 *
 * Key layout:
 *   "ratchet:<conversationId>" → DoubleRatchetState (serializable form)
 *   "peer-ik:<conversationId>" → { identityKeyBase64, verified }
 * ============================================================================
 */

import { DoubleRatchetState } from './double-ratchet';
import { bufToBase64, base64ToBuf } from './identity';

const DB_NAME = 'academia-helm-signal';
const DB_VERSION = 1;
const STORE_RATCHETS = 'ratchets';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_RATCHETS)) {
        db.createObjectStore(STORE_RATCHETS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: any): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_RATCHETS, 'readwrite');
    tx.objectStore(STORE_RATCHETS).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_RATCHETS, 'readonly');
    const req = tx.objectStore(STORE_RATCHETS).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_RATCHETS, 'readwrite');
    tx.objectStore(STORE_RATCHETS).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Serializable form ──────────────────────────────────────────────────

interface SerializedRatchetState {
  rootKeyBase64: string;
  sendingChainKeyBase64: string | null;
  receivingChainKeyBase64: string | null;
  sendingDhPrivateJwk: JsonWebKey | null;
  sendingDhPublicKeyBase64: string | null;
  receivingDhPublicKeyBase64: string | null;
  sendingMessageNumber: number;
  receivingMessageNumber: number;
  previousChainLength: number;
}

function serialize(state: DoubleRatchetState): SerializedRatchetState {
  return {
    rootKeyBase64: bufToBase64(state.rootKey),
    sendingChainKeyBase64: state.sendingChainKey ? bufToBase64(state.sendingChainKey) : null,
    receivingChainKeyBase64: state.receivingChainKey ? bufToBase64(state.receivingChainKey) : null,
    sendingDhPrivateJwk: state.sendingDhPrivateJwk,
    sendingDhPublicKeyBase64: state.sendingDhPublicKeyBase64,
    receivingDhPublicKeyBase64: state.receivingDhPublicKeyBase64,
    sendingMessageNumber: state.sendingMessageNumber,
    receivingMessageNumber: state.receivingMessageNumber,
    previousChainLength: state.previousChainLength,
  };
}

function deserialize(s: SerializedRatchetState): DoubleRatchetState {
  return {
    rootKey: base64ToBuf(s.rootKeyBase64),
    sendingChainKey: s.sendingChainKeyBase64 ? base64ToBuf(s.sendingChainKeyBase64) : null,
    receivingChainKey: s.receivingChainKeyBase64 ? base64ToBuf(s.receivingChainKeyBase64) : null,
    sendingDhPrivateJwk: s.sendingDhPrivateJwk,
    sendingDhPublicKeyBase64: s.sendingDhPublicKeyBase64,
    receivingDhPublicKeyBase64: s.receivingDhPublicKeyBase64,
    sendingMessageNumber: s.sendingMessageNumber,
    receivingMessageNumber: s.receivingMessageNumber,
    previousChainLength: s.previousChainLength,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────

export async function saveRatchetState(conversationId: string, state: DoubleRatchetState): Promise<void> {
  const serialized = serialize(state);
  await idbSet(`ratchet:${conversationId}`, serialized);
}

export async function loadRatchetState(conversationId: string): Promise<DoubleRatchetState | null> {
  const s = await idbGet<SerializedRatchetState>(`ratchet:${conversationId}`);
  return s ? deserialize(s) : null;
}

export async function deleteRatchetState(conversationId: string): Promise<void> {
  await idbDelete(`ratchet:${conversationId}`);
}

export interface PeerIdentityRecord {
  identityKeyBase64: string;
  /** Whether the user has manually verified the safety number. */
  verified: boolean;
}

export async function savePeerIdentity(conversationId: string, record: PeerIdentityRecord): Promise<void> {
  await idbSet(`peer-ik:${conversationId}`, record);
}

export async function loadPeerIdentity(conversationId: string): Promise<PeerIdentityRecord | null> {
  return idbGet<PeerIdentityRecord>(`peer-ik:${conversationId}`);
}
