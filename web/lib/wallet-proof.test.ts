/**
 * These tests sign with real keypairs rather than fixtures: a hand-written
 * "valid signature" constant only proves that the constant was copied
 * correctly, and the thing worth proving here is that a wrong key, a wrong
 * message or a wrong wallet is rejected.
 */
import { createPrivateKey, generateKeyPairSync, sign } from 'node:crypto';

import { Keypair } from '@solana/web3.js';
import { describe, expect, it } from 'vitest';

import { challengeMessage, decodeBase58, verifyWalletSignature } from './wallet-proof';

function signWith(keypair: Keypair, message: string): Uint8Array {
  // Node needs the private key in PKCS#8; Solana keypairs hand out raw bytes,
  // so the test builds the DER wrapper the same way the verifier builds SPKI.
  const pkcs8 = Buffer.concat([
    Buffer.from('302e020100300506032b657004220420', 'hex'),
    Buffer.from(keypair.secretKey.slice(0, 32)),
  ]);
  const key = createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
  return new Uint8Array(sign(null, Buffer.from(message, 'utf8'), key));
}

const challenge = {
  twitchUserId: '123456789',
  login: 'regressor',
  wallet: '',
  issuedAt: 1_789_000_000,
};

describe('challengeMessage', () => {
  it('names the site, the channel, the wallet and when it was issued', () => {
    const text = challengeMessage({
      ...challenge,
      wallet: 'So11111111111111111111111111111111111111112',
    });
    expect(text).toContain('TipVault');
    expect(text).toContain('regressor (123456789)');
    expect(text).toContain('So11111111111111111111111111111111111111112');
    expect(text).toContain('2026-');
    // A person has to be able to tell this is harmless before approving it.
    expect(text).toContain('sends no transaction');
  });

  it('changes when any bound field changes, so one proof cannot serve another channel', () => {
    const base = challengeMessage({ ...challenge, wallet: 'AAAA' });
    expect(challengeMessage({ ...challenge, wallet: 'BBBB' })).not.toEqual(base);
    expect(challengeMessage({ ...challenge, login: 'someone-else' })).not.toEqual(base);
    expect(challengeMessage({ ...challenge, twitchUserId: '999' })).not.toEqual(base);
    expect(challengeMessage({ ...challenge, issuedAt: challenge.issuedAt + 1 })).not.toEqual(base);
  });
});

describe('decodeBase58', () => {
  it('round-trips a real Solana address to 32 bytes', () => {
    const keypair = Keypair.generate();
    const decoded = decodeBase58(keypair.publicKey.toBase58());
    expect(decoded).not.toBeNull();
    expect(decoded).toHaveLength(32);
    expect(Buffer.from(decoded as Uint8Array)).toEqual(Buffer.from(keypair.publicKey.toBytes()));
  });

  it('returns null for characters base58 does not have', () => {
    // 0, O, I and l are excluded from the alphabet precisely to avoid mistakes.
    for (const bad of ['0', 'O', 'I', 'l', 'not a key!', '']) {
      const decoded = decodeBase58(bad);
      expect(decoded === null || decoded.length !== 32).toBe(true);
    }
  });
});

describe('verifyWalletSignature', () => {
  it('accepts a signature the wallet really made', () => {
    const keypair = Keypair.generate();
    const message = challengeMessage({ ...challenge, wallet: keypair.publicKey.toBase58() });
    const signature = signWith(keypair, message);

    expect(verifyWalletSignature(message, keypair.publicKey.toBase58(), signature)).toBe(true);
  });

  it('rejects a signature from a different wallet', () => {
    const mine = Keypair.generate();
    const attacker = Keypair.generate();
    const message = challengeMessage({ ...challenge, wallet: mine.publicKey.toBase58() });
    // The attacker signs the victim's challenge with their own key and claims
    // the victim's address.
    const signature = signWith(attacker, message);

    expect(verifyWalletSignature(message, mine.publicKey.toBase58(), signature)).toBe(false);
  });

  it('rejects a valid signature over a different message', () => {
    const keypair = Keypair.generate();
    const signed = challengeMessage({ ...challenge, wallet: keypair.publicKey.toBase58() });
    const signature = signWith(keypair, signed);
    const other = challengeMessage({
      ...challenge,
      login: 'another-channel',
      wallet: keypair.publicKey.toBase58(),
    });

    expect(verifyWalletSignature(other, keypair.publicKey.toBase58(), signature)).toBe(false);
  });

  it('rejects malformed input instead of throwing', () => {
    const keypair = Keypair.generate();
    const message = 'anything';
    const good = signWith(keypair, message);

    expect(verifyWalletSignature(message, 'not-base58-!!', good)).toBe(false);
    expect(verifyWalletSignature(message, keypair.publicKey.toBase58(), new Uint8Array(10))).toBe(
      false,
    );
    expect(verifyWalletSignature(message, '1111', good)).toBe(false);
  });

  it('rejects a key that is 32 valid bytes but not this signer', () => {
    // A well-formed address with no relationship to the signature at all.
    const keypair = Keypair.generate();
    const message = 'anything';
    const signature = signWith(keypair, message);
    const { publicKey } = generateKeyPairSync('ed25519');
    const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(12);
    const other = Keypair.fromSeed(new Uint8Array(raw)).publicKey.toBase58();

    expect(verifyWalletSignature(message, other, signature)).toBe(false);
  });
});
