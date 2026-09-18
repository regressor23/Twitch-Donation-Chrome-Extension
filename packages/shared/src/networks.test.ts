import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CLUSTER,
  MIN_TIP,
  TIP_PRESETS,
  TIP_VAULT_PROGRAM_ID,
  USDC_DECIMALS,
  USDC_MINT,
} from './networks.js';

/** Base58 as Solana uses it: no 0, O, I or l. */
const BASE58_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

describe('mints', () => {
  it.each([
    ['mainnet-beta', USDC_MINT['mainnet-beta']],
    ['devnet', USDC_MINT.devnet],
  ])('%s USDC mint is a base58 address', (_cluster, mint) => {
    expect(mint).toMatch(BASE58_ADDRESS_RE);
  });

  it('does not reuse one mint for both clusters', () => {
    expect(USDC_MINT['mainnet-beta']).not.toBe(USDC_MINT.devnet);
  });

  it('pins the well-known mainnet USDC mint', () => {
    expect(USDC_MINT['mainnet-beta']).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  });

  it('uses six decimals', () => {
    expect(USDC_DECIMALS).toBe(6);
  });
});

describe('amounts', () => {
  it('floors tips at $1 in minor units', () => {
    expect(MIN_TIP).toBe(1_000_000n);
  });

  it('offers $2 / $5 / $20 presets, ascending and above the floor', () => {
    expect(TIP_PRESETS).toEqual([2_000_000n, 5_000_000n, 20_000_000n]);
    expect([...TIP_PRESETS].sort((a, b) => Number(a - b))).toEqual([...TIP_PRESETS]);
    for (const preset of TIP_PRESETS) {
      expect(preset).toBeGreaterThanOrEqual(MIN_TIP);
      expect(typeof preset).toBe('bigint');
    }
  });
});

describe('program id', () => {
  it('is a base58 address', () => {
    expect(TIP_VAULT_PROGRAM_ID).toMatch(BASE58_ADDRESS_RE);
  });
});

describe('default cluster', () => {
  it('is devnet, so nothing reaches mainnet by accident before S5', () => {
    expect(DEFAULT_CLUSTER).toBe('devnet');
  });
});

describe('program id', () => {
  it('is no longer the Anchor template placeholder', () => {
    expect(TIP_VAULT_PROGRAM_ID).not.toBe('Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS');
  });
});
