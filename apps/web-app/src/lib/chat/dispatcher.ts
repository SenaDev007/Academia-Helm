/**
 * ============================================================================
 * CHAT CRYPTO DISPATCHER — picks V2 (RSA-OAEP) or V3 (Signal) per conversation
 * ============================================================================
 *
 * The UI calls a single function (`encryptOutgoing` / `decryptIncoming`).
 * The dispatcher decides which protocol to use:
 *   - If both peers have a Signal identity key (V3) AND the conversation
 *     has opted into V3 → use SignalProtocol (X3DH + Double Ratchet).
 *   - Else if the recipient has a V2 RSA public key → use crypto.ts
 *     (RSA-OAEP, simplified — no forward secrecy).
 *   - Else → plaintext (no encryption).
 *
 * ⭐ Opt-in: V3 is enabled per conversation via `setConversationV3Enabled()`.
 *    Default: V2 (preserves existing behavior). Flip the flag from the UI
 *    when you're ready to migrate a conversation to V3.
 *
 * Usage:
 *   import { encryptOutgoing, decryptIncoming } from '@/lib/chat/dispatcher';
 *
 *   // On send:
 *   const ciphertext = await encryptOutgoing(conversationId, recipientUserId, plaintext);
 *
 *   // On receive:
 *   const plaintext = await decryptIncoming(conversationId, senderUserId, ciphertext);
 * ============================================================================
 */

import { encryptMessage as v2Encrypt, decryptMessage as v2Decrypt, isEncrypted as v2IsEncrypted } from './crypto';
import { SignalProtocol } from './signal';

// Per-conversation V3 flag. Persisted in localStorage so the user's choice survives reloads.
const V3_FLAG_KEY = 'helm_connect_v3_conversations';

function loadV3Flags(): Set<string> {
  try {
    const raw = localStorage.getItem(V3_FLAG_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveV3Flags(flags: Set<string>): void {
  try {
    localStorage.setItem(V3_FLAG_KEY, JSON.stringify([...flags]));
  } catch {
    // silent
  }
}

export function isConversationV3Enabled(conversationId: string): boolean {
  return loadV3Flags().has(conversationId);
}

export function setConversationV3Enabled(conversationId: string, enabled: boolean): void {
  const flags = loadV3Flags();
  if (enabled) flags.add(conversationId);
  else flags.delete(conversationId);
  saveV3Flags(flags);
}

/**
 * Encrypt an outgoing message.
 *
 * Decision tree:
 *   1. If V3 is enabled for this conversation AND SignalProtocol is enabled
 *      (identity key exists locally) → use V3.
 *   2. Else if recipient has a V2 public key → use V2.
 *   3. Else → plaintext (no encryption).
 *
 * On V3 failure (e.g., recipient has no pre-key bundle published yet),
 * automatically falls back to V2.
 */
export async function encryptOutgoing(
  conversationId: string,
  recipientUserId: string,
  plaintext: string,
  recipientV2PublicKeyBase64?: string | null,
): Promise<string> {
  // 1. Try V3 if enabled.
  if (isConversationV3Enabled(conversationId) && await SignalProtocol.isEnabled()) {
    try {
      return await SignalProtocol.encrypt(conversationId, recipientUserId, plaintext);
    } catch (e) {
      console.warn('[Crypto Dispatcher] V3 encryption failed, falling back to V2:', e);
      // Fall through to V2.
    }
  }

  // 2. Try V2 if recipient has a public key.
  if (recipientV2PublicKeyBase64) {
    return v2Encrypt(plaintext, recipientV2PublicKeyBase64);
  }

  // 3. Plaintext fallback.
  return plaintext;
}

/**
 * Decrypt an incoming message.
 *
 * Detects the payload format:
 *   - `SIG3:<base64>` → V3 Signal decrypt
 *   - `E2E:<base64>`  → V2 RSA-OAEP decrypt
 *   - anything else   → plaintext
 */
export async function decryptIncoming(
  conversationId: string,
  senderUserId: string,
  ciphertext: string,
): Promise<string> {
  if (!ciphertext) return '';

  // 1. V3 Signal payload.
  if (SignalProtocol.isSignalPayload(ciphertext)) {
    try {
      return await SignalProtocol.decrypt(conversationId, senderUserId, ciphertext);
    } catch (e) {
      console.error('[Crypto Dispatcher] V3 decryption failed:', e);
      return '🔒 Message chiffré (Signal V3 — échec de déchiffrement)';
    }
  }

  // 2. V2 E2E payload.
  if (v2IsEncrypted(ciphertext)) {
    return v2Decrypt(ciphertext);
  }

  // 3. Plaintext.
  return ciphertext;
}

/**
 * One-time setup: ensure V3 identity key exists + publish pre-key bundle.
 * Safe to call on app boot — idempotent.
 *
 * ⭐ Does NOT enable V3 for any conversation — that requires an explicit
 *    call to `setConversationV3Enabled(conversationId, true)` from the UI.
 */
export async function ensureSignalIdentity(): Promise<void> {
  try {
    await SignalProtocol.ensureIdentityKey();
    await SignalProtocol.publishPreKeyBundle();
  } catch (e) {
    console.warn('[Crypto Dispatcher] Signal V3 setup failed:', e);
  }
}
