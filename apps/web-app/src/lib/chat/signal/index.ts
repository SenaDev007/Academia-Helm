/**
 * Signal Protocol V3 — public re-exports.
 *
 * Usage:
 *   import { SignalProtocol } from '@/lib/chat/signal';
 *
 * For low-level access (testing, advanced use):
 *   import { IdentityKey, PreKeys, X3DH, DoubleRatchet } from '@/lib/chat/signal';
 */

export { SignalProtocol } from './signal-protocol';
export { loadIdentityKey, generateIdentityKey, hasIdentityKey } from './identity';
export {
  generateSignedPreKey, loadSignedPreKey,
  generateOneTimePreKeys, consumeOneTimePreKey,
} from './prekeys';
export { initiateX3DH, receiveX3DH } from './x3dh';
export { initDoubleRatchet, ratchetEncrypt, ratchetDecrypt } from './double-ratchet';
export {
  saveRatchetState, loadRatchetState, deleteRatchetState,
} from './ratchet-store';
