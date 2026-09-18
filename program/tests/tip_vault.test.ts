import { SystemProgram, type PublicKey, type Keypair } from '@solana/web3.js';
import { beforeAll, describe, expect, it } from 'vitest';

import * as h from './helpers.js';

const { BN } = h;

let provider: ReturnType<typeof h.makeProvider>;
let program: ReturnType<typeof h.makeProgram>;
let programId: PublicKey;
let authority: Keypair;
let mintAuthority: Keypair;
let mint: PublicKey;
let donor: Keypair;
let donorToken: PublicKey;
let claimer: Keypair;

/**
 * Fresh channel and nonce per scenario, seeded from the wall clock so that a
 * second run against the same ledger never lands on PDAs the first run already
 * created. Without the seed the suite only passes once per fresh validator —
 * which would also make it useless against devnet.
 */
const RUN_SEED = BigInt(Date.now());

let channelCounter = RUN_SEED * 1_000n;
const nextChannel = (): bigint => ++channelCounter;

let nonceCounter = RUN_SEED * 1_000n;
const nextNonce = (): bigint => ++nonceCounter;

const inAnHour = (): bigint => BigInt(Math.floor(Date.now() / 1000) + 3600);
const inSeconds = (seconds: number): bigint => BigInt(Math.floor(Date.now() / 1000) + seconds);
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

beforeAll(async () => {
  provider = h.makeProvider();
  program = h.makeProgram(provider);
  programId = program.programId;
  authority = h.loadAttestationAuthority();

  mintAuthority = await h.fundedKeypair(provider);
  mint = await h.createUsdcLikeMint(provider, mintAuthority);
  donor = await h.fundedKeypair(provider);
  claimer = await h.fundedKeypair(provider);
  donorToken = await h.fundToken(provider, mint, mintAuthority, donor, 10_000 * h.ONE_USDC);
}, 180_000);

async function escrowTip(
  channelId: bigint,
  amount: number,
  expiresAt: bigint,
): Promise<{ vault: PublicKey; escrowToken: PublicKey; tip: PublicKey }> {
  const vault = h.vaultPda(programId, channelId);
  const escrowToken = h.ataFor(mint, vault, true);

  let index = 0n;
  try {
    const state = await program.account.vault.fetch(vault);
    index = BigInt((state as { tipCount: { toString(): string } }).tipCount.toString());
  } catch {
    // vault does not exist yet: the first tip gets index 0
  }
  const tip = h.tipPda(programId, channelId, index);

  await program.methods
    .tipEscrow(new BN(channelId.toString()), new BN(amount), new BN(expiresAt.toString()))
    .accountsPartial({
      donor: donor.publicKey,
      vault,
      escrowToken,
      escrowTip: tip,
      donorToken,
      mint,
      tokenProgram: h.SPL.tokenProgram,
      associatedTokenProgram: h.SPL.associatedTokenProgram,
      systemProgram: SystemProgram.programId,
    })
    .signers([donor])
    .rpc({ commitment: 'confirmed' });

  return { vault, escrowToken, tip };
}

interface ClaimOptions {
  channelId: bigint;
  recipient: PublicKey;
  tips: PublicKey[];
  nonce: bigint;
  expiresAt: bigint;
  /** Who signs the attestation; defaults to the real authority. */
  signer?: Keypair;
  /** Values put into the signed message instead of the real ones. */
  signed?: { channelId?: bigint; recipient?: PublicKey; nonce?: bigint; expiresAt?: bigint };
}

async function claim(options: ClaimOptions): Promise<string> {
  const { channelId, recipient, tips, nonce, expiresAt } = options;
  const signer = options.signer ?? authority;
  const signed = options.signed ?? {};

  const message = h.attestationMessage(
    programId,
    signed.channelId ?? channelId,
    signed.recipient ?? recipient,
    signed.nonce ?? nonce,
    signed.expiresAt ?? expiresAt,
  );

  const claimInstruction = await program.methods
    .claim(new BN(channelId.toString()), {
      recipient,
      nonce: new BN(nonce.toString()),
      expiresAt: new BN(expiresAt.toString()),
    })
    .accountsPartial({
      claimer: claimer.publicKey,
      recipient,
      recipientToken: h.ataFor(mint, recipient),
      vault: h.vaultPda(programId, channelId),
      escrowToken: h.ataFor(mint, h.vaultPda(programId, channelId), true),
      usedNonce: h.noncePda(programId, channelId, nonce),
      instructionsSysvar: h.SPL.instructionsSysvar,
      mint,
      tokenProgram: h.SPL.tokenProgram,
      associatedTokenProgram: h.SPL.associatedTokenProgram,
      systemProgram: SystemProgram.programId,
    })
    .remainingAccounts(tips.map((pubkey) => ({ pubkey, isWritable: true, isSigner: false })))
    .instruction();

  return h.sendWithSigners(
    provider,
    [h.ed25519Instruction(signer, message), claimInstruction],
    [claimer],
  );
}

describe('tip_direct', () => {
  it('moves tokens straight to the streamer and carries the memo', async () => {
    const streamer = await h.fundedKeypair(provider);
    const streamerToken = await h.fundToken(provider, mint, mintAuthority, streamer, 0);
    const before = await h.tokenBalance(provider, streamerToken);
    const memo = `tv1|${nextChannel()}|alex|gg wp`;

    const signature = await program.methods
      .tipDirect(new BN(2 * h.ONE_USDC), memo)
      .accountsPartial({
        donor: donor.publicKey,
        donorToken,
        recipientToken: streamerToken,
        mint,
        tokenProgram: h.SPL.tokenProgram,
      })
      .signers([donor])
      .rpc({ commitment: 'confirmed' });

    expect(await h.tokenBalance(provider, streamerToken)).toBe(before + BigInt(2 * h.ONE_USDC));

    const tx = await provider.connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
    const logs = (tx?.meta?.logMessages ?? []).join('\n');
    expect(logs).toContain(`tipvault-memo: ${memo}`);
  });

  it('rejects a tip below the minimum', async () => {
    const streamer = await h.fundedKeypair(provider);
    const streamerToken = await h.fundToken(provider, mint, mintAuthority, streamer, 0);

    await h.expectAnchorError(
      () =>
        program.methods
          .tipDirect(new BN(h.ONE_USDC - 1), 'tv1|1|a|b')
          .accountsPartial({
            donor: donor.publicKey,
            donorToken,
            recipientToken: streamerToken,
            mint,
            tokenProgram: h.SPL.tokenProgram,
          })
          .signers([donor])
          .rpc({ commitment: 'confirmed' }),
      'AmountTooSmall',
    );
  });

  it('rejects a memo over 300 bytes', async () => {
    const streamer = await h.fundedKeypair(provider);
    const streamerToken = await h.fundToken(provider, mint, mintAuthority, streamer, 0);

    await h.expectAnchorError(
      () =>
        program.methods
          .tipDirect(new BN(h.ONE_USDC), 'x'.repeat(301))
          .accountsPartial({
            donor: donor.publicKey,
            donorToken,
            recipientToken: streamerToken,
            mint,
            tokenProgram: h.SPL.tokenProgram,
          })
          .signers([donor])
          .rpc({ commitment: 'confirmed' }),
      'MemoTooLong',
    );
  });
});

describe('tip_escrow', () => {
  it('locks the tip in the vault and records it', async () => {
    const channelId = nextChannel();
    const expiresAt = inAnHour();
    const { vault, escrowToken, tip } = await escrowTip(channelId, 5 * h.ONE_USDC, expiresAt);

    expect(await h.tokenBalance(provider, escrowToken)).toBe(BigInt(5 * h.ONE_USDC));

    const vaultState = await program.account.vault.fetch(vault);
    expect(vaultState.channelId.toString()).toBe(channelId.toString());
    expect(vaultState.tipCount.toString()).toBe('1');
    expect(vaultState.totalEscrowed.toString()).toBe(String(5 * h.ONE_USDC));

    const tipState = await program.account.escrowTip.fetch(tip);
    expect(tipState.donor.toBase58()).toBe(donor.publicKey.toBase58());
    expect(tipState.amount.toString()).toBe(String(5 * h.ONE_USDC));
    expect(tipState.settled).toBe(false);
  });

  it('rejects an escrow tip below the minimum', async () => {
    const channelId = nextChannel();
    await h.expectAnchorError(
      () => escrowTip(channelId, h.ONE_USDC - 1, inAnHour()),
      'AmountTooSmall',
    );
  });

  it('rejects an expiry in the past', async () => {
    const channelId = nextChannel();
    await h.expectAnchorError(
      () => escrowTip(channelId, h.ONE_USDC, inSeconds(-60)),
      'ExpiredEscrow',
    );
  });
});

describe('claim', () => {
  it('pays the attested streamer, creating their token account on the way', async () => {
    const channelId = nextChannel();
    const { vault, tip } = await escrowTip(channelId, 4 * h.ONE_USDC, inAnHour());
    const streamer = await h.fundedKeypair(provider);
    const streamerToken = h.ataFor(mint, streamer.publicKey);

    // The streamer has never held this token: the ATA must not exist yet.
    expect(await provider.connection.getAccountInfo(streamerToken)).toBeNull();

    await claim({
      channelId,
      recipient: streamer.publicKey,
      tips: [tip],
      nonce: nextNonce(),
      expiresAt: inAnHour(),
    });

    expect(await h.tokenBalance(provider, streamerToken)).toBe(BigInt(4 * h.ONE_USDC));
    const vaultState = await program.account.vault.fetch(vault);
    expect(vaultState.totalEscrowed.toString()).toBe('0');
    const tipState = await program.account.escrowTip.fetch(tip);
    expect(tipState.settled).toBe(true);
  });

  it('refuses to replay the same attestation', async () => {
    const channelId = nextChannel();
    const first = await escrowTip(channelId, h.ONE_USDC, inAnHour());
    const second = await escrowTip(channelId, h.ONE_USDC, inAnHour());
    const streamer = await h.fundedKeypair(provider);
    const nonce = nextNonce();
    const expiresAt = inAnHour();

    await claim({
      channelId,
      recipient: streamer.publicKey,
      tips: [first.tip],
      nonce,
      expiresAt,
    });

    await h.expectAnchorError(
      () =>
        claim({
          channelId,
          recipient: streamer.publicKey,
          tips: [second.tip],
          nonce,
          expiresAt,
        }),
      'already in use',
    );
  });

  it('refuses an attestation signed for another channel', async () => {
    const channelId = nextChannel();
    const { tip } = await escrowTip(channelId, h.ONE_USDC, inAnHour());
    const streamer = await h.fundedKeypair(provider);

    await h.expectAnchorError(
      () =>
        claim({
          channelId,
          recipient: streamer.publicKey,
          tips: [tip],
          nonce: nextNonce(),
          expiresAt: inAnHour(),
          signed: { channelId: channelId + 1n },
        }),
      'BadAttestation',
    );
  });

  it('refuses an attestation signed for another recipient', async () => {
    const channelId = nextChannel();
    const { tip } = await escrowTip(channelId, h.ONE_USDC, inAnHour());
    const streamer = await h.fundedKeypair(provider);
    const impostor = await h.fundedKeypair(provider);

    await h.expectAnchorError(
      () =>
        claim({
          channelId,
          recipient: impostor.publicKey,
          tips: [tip],
          nonce: nextNonce(),
          expiresAt: inAnHour(),
          signed: { recipient: streamer.publicKey },
        }),
      'BadAttestation',
    );
  });

  it('refuses an expired attestation', async () => {
    const channelId = nextChannel();
    const { tip } = await escrowTip(channelId, h.ONE_USDC, inAnHour());
    const streamer = await h.fundedKeypair(provider);

    await h.expectAnchorError(
      () =>
        claim({
          channelId,
          recipient: streamer.publicKey,
          tips: [tip],
          nonce: nextNonce(),
          expiresAt: inSeconds(-60),
        }),
      'AttestationExpired',
    );
  });

  it('refuses a signature from the wrong key', async () => {
    const channelId = nextChannel();
    const { tip } = await escrowTip(channelId, h.ONE_USDC, inAnHour());
    const streamer = await h.fundedKeypair(provider);
    const forger = await h.fundedKeypair(provider);

    await h.expectAnchorError(
      () =>
        claim({
          channelId,
          recipient: streamer.publicKey,
          tips: [tip],
          nonce: nextNonce(),
          expiresAt: inAnHour(),
          signer: forger,
        }),
      'BadAttestation',
    );
  });

  it('refuses to settle the same tip twice, even with a fresh attestation', async () => {
    const channelId = nextChannel();
    const { tip } = await escrowTip(channelId, h.ONE_USDC, inAnHour());
    const streamer = await h.fundedKeypair(provider);

    await claim({
      channelId,
      recipient: streamer.publicKey,
      tips: [tip],
      nonce: nextNonce(),
      expiresAt: inAnHour(),
    });

    await h.expectAnchorError(
      () =>
        claim({
          channelId,
          recipient: streamer.publicKey,
          tips: [tip],
          nonce: nextNonce(),
          expiresAt: inAnHour(),
        }),
      'TipAlreadySettled',
    );
  });

  it('refuses to claim a tip that has already expired', async () => {
    const channelId = nextChannel();
    const { tip } = await escrowTip(channelId, h.ONE_USDC, inSeconds(2));
    const streamer = await h.fundedKeypair(provider);

    await sleep(4_000);

    await h.expectAnchorError(
      () =>
        claim({
          channelId,
          recipient: streamer.publicKey,
          tips: [tip],
          nonce: nextNonce(),
          expiresAt: inAnHour(),
        }),
      'ExpiredEscrow',
    );
  }, 60_000);
});

describe('refund_expired', () => {
  async function refund(channelId: bigint, index: bigint): Promise<string> {
    const vault = h.vaultPda(programId, channelId);
    return program.methods
      .refundExpired(new BN(channelId.toString()), new BN(index.toString()))
      .accountsPartial({
        payer: claimer.publicKey,
        vault,
        escrowTip: h.tipPda(programId, channelId, index),
        escrowToken: h.ataFor(mint, vault, true),
        donorToken,
        mint,
        tokenProgram: h.SPL.tokenProgram,
      })
      .signers([claimer])
      .rpc({ commitment: 'confirmed' });
  }

  it('refuses to refund before the tip expires', async () => {
    const channelId = nextChannel();
    await escrowTip(channelId, h.ONE_USDC, inAnHour());

    await h.expectAnchorError(() => refund(channelId, 0n), 'NotExpiredYet');
  });

  it('returns the money to the donor once the tip expires', async () => {
    const channelId = nextChannel();
    const { vault, tip } = await escrowTip(channelId, 3 * h.ONE_USDC, inSeconds(2));
    const before = await h.tokenBalance(provider, donorToken);

    await sleep(4_000);
    await refund(channelId, 0n);

    expect(await h.tokenBalance(provider, donorToken)).toBe(before + BigInt(3 * h.ONE_USDC));
    const tipState = await program.account.escrowTip.fetch(tip);
    expect(tipState.settled).toBe(true);
    const vaultState = await program.account.vault.fetch(vault);
    expect(vaultState.totalEscrowed.toString()).toBe('0');
  }, 60_000);

  it('refuses to refund a tip twice', async () => {
    const channelId = nextChannel();
    await escrowTip(channelId, h.ONE_USDC, inSeconds(2));

    await sleep(4_000);
    await refund(channelId, 0n);

    await h.expectAnchorError(() => refund(channelId, 0n), 'TipAlreadySettled');
  }, 60_000);
});
