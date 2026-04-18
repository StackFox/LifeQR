// backend/src/services/qrEncryption.ts
// NaCl box encryption for offline QR payloads

import nacl from 'tweetnacl';

export interface EncryptionKeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

/**
 * Generate a new NaCl box keypair.
 */
export function generateKeyPair(): EncryptionKeyPair {
  return nacl.box.keyPair();
}

/**
 * Encrypt a plaintext string using NaCl box.
 * Returns base64-encoded string: nonce(24) + ephemeralPubKey(32) + ciphertext
 */
export function encryptPayload(plaintext: string, recipientPublicKey: Uint8Array): string {
  const nonce = nacl.randomBytes(24);
  const ephemeralKeyPair = nacl.box.keyPair();
  const messageBytes = new TextEncoder().encode(plaintext);

  const encrypted = nacl.box(
    messageBytes,
    nonce,
    recipientPublicKey,
    ephemeralKeyPair.secretKey
  );

  if (!encrypted) {
    throw new Error('Encryption failed');
  }

  // Combine: nonce(24) + ephemeralPublicKey(32) + ciphertext
  const combined = new Uint8Array(24 + 32 + encrypted.length);
  combined.set(nonce, 0);
  combined.set(ephemeralKeyPair.publicKey, 24);
  combined.set(encrypted, 56);

  return Buffer.from(combined).toString('base64');
}

/**
 * Decrypt a base64 encoded payload using NaCl box.open.
 * Expects: nonce(24) + ephemeralPubKey(32) + ciphertext
 */
export function decryptPayload(base64Payload: string, recipientSecretKey: Uint8Array): string {
  const combined = Buffer.from(base64Payload, 'base64');

  const nonce = new Uint8Array(combined.slice(0, 24));
  const ephemeralPublicKey = new Uint8Array(combined.slice(24, 56));
  const ciphertext = new Uint8Array(combined.slice(56));

  const decrypted = nacl.box.open(
    ciphertext,
    nonce,
    ephemeralPublicKey,
    recipientSecretKey
  );

  if (!decrypted) {
    throw new Error('Decryption failed: invalid key or corrupted data');
  }

  return new TextDecoder().decode(decrypted);
}

/**
 * Convert Uint8Array keypair to hex strings for storage/transport.
 */
export function keyPairToHex(kp: EncryptionKeyPair) {
  return {
    publicKey: Buffer.from(kp.publicKey).toString('hex'),
    secretKey: Buffer.from(kp.secretKey).toString('hex')
  };
}

/**
 * Restore Uint8Array from hex string.
 */
export function hexToUint8Array(hex: string): Uint8Array {
  return new Uint8Array(Buffer.from(hex, 'hex'));
}
