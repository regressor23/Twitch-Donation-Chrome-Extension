import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import * as anchor from '@coral-xyz/anchor';
import { AnchorProvider, BN, Program, Wallet } from '@coral-xyz/anchor';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  mintTo,
} from '@solana/spl-token';
import {
  Connection,
  Ed25519Program,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

import idl from '../target/idl/tip_vault.json' with { type: 'json' };

export const LOCALNET = 'http://127.0.0.1:8899';
export const USDC_DECIMALS = 6;
export const ONE_USDC = 1_000_000;

/** Mirrors `ATTESTATION_DOMAIN` in the program. */
const ATTESTATION_DOMAIN = Buffer.from('tipvault-claim-v1');

export function loadKeypair(path: string): Keypair {
  const bytes = Uint8Array.from(JSON.parse(readFileSync(path, 'utf8')) as number[]);
  return Keypair.fromSecretKey(bytes);
}

/**
 * The program hard-codes this key, so the tests cannot substitute their own.
 * The file is gitignored: running these tests needs the same key the devnet
 * deployment uses.
 */
export function loadAttestationAuthority(): Keypair {
  const path = join(process.cwd(), 'keys', 'attestation-authority-devnet.json');
  try {
    return loadKeypair(path);
  } catch {
    throw new Error(
      `attestation authority keypair not found at ${path}. It is gitignored on purpose; restore it from your backup before running the program tests.`,
    );
  }
}

export function makeProvider(): AnchorProvider {
  const connection = new Connection(LOCALNET, 'confirmed');
  const wallet = new Wallet(loadKeypair(join(homedir(), '.config', 'solana', 'id.json')));
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  anchor.setProvider(provider);
  return provider;
}

export function makeProgram(provider: AnchorProvider): Program {
  return new Program(idl as anchor.Idl, provider);
}

export function u64le(value: bigint | number): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(BigInt(value));
  return buffer;
}

export function i64le(value: bigint | number): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigInt64LE(BigInt(value));
  return buffer;
}

export function vaultPda(programId: PublicKey, channelId: bigint): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('vault'), u64le(channelId)], programId)[0];
}

export function tipPda(programId: PublicKey, channelId: bigint, index: bigint): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('tip'), u64le(channelId), u64le(index)],
    programId,
  )[0];
}

export function noncePda(programId: PublicKey, channelId: bigint, nonce: bigint): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('nonce'), u64le(channelId), u64le(nonce)],
    programId,
  )[0];
}

/** Exactly the bytes `attestation_message` builds on the program side. */
export function attestationMessage(
  programId: PublicKey,
  channelId: bigint,
  recipient: PublicKey,
  nonce: bigint,
  expiresAt: bigint,
): Buffer {
  return Buffer.concat([
    ATTESTATION_DOMAIN,
    programId.toBuffer(),
    u64le(channelId),
    recipient.toBuffer(),
    u64le(nonce),
    i64le(expiresAt),
  ]);
}

export function ed25519Instruction(signer: Keypair, message: Buffer): TransactionInstruction {
  return Ed25519Program.createInstructionWithPrivateKey({
    privateKey: signer.secretKey,
    message,
  });
}

export async function fundedKeypair(provider: AnchorProvider, sol = 5): Promise<Keypair> {
  const keypair = Keypair.generate();
  const signature = await provider.connection.requestAirdrop(
    keypair.publicKey,
    sol * LAMPORTS_PER_SOL,
  );
  const latest = await provider.connection.getLatestBlockhash();
  await provider.connection.confirmTransaction({ signature, ...latest }, 'confirmed');
  return keypair;
}

export async function createUsdcLikeMint(
  provider: AnchorProvider,
  authority: Keypair,
): Promise<PublicKey> {
  return createMint(provider.connection, authority, authority.publicKey, null, USDC_DECIMALS);
}

/** Creates the owner's ATA if needed and mints `amount` minor units into it. */
export async function fundToken(
  provider: AnchorProvider,
  mint: PublicKey,
  mintAuthority: Keypair,
  owner: Keypair,
  amount: number,
): Promise<PublicKey> {
  const { getOrCreateAssociatedTokenAccount } = await import('@solana/spl-token');
  const account = await getOrCreateAssociatedTokenAccount(
    provider.connection,
    owner,
    mint,
    owner.publicKey,
  );
  await mintTo(provider.connection, mintAuthority, mint, account.address, mintAuthority, amount);
  return account.address;
}

export function ataFor(mint: PublicKey, owner: PublicKey, allowOwnerOffCurve = false): PublicKey {
  return getAssociatedTokenAddressSync(mint, owner, allowOwnerOffCurve);
}

export async function tokenBalance(provider: AnchorProvider, account: PublicKey): Promise<bigint> {
  const info = await getAccount(provider.connection, account, 'confirmed');
  return info.amount;
}

export async function sendWithSigners(
  provider: AnchorProvider,
  instructions: TransactionInstruction[],
  signers: Keypair[],
): Promise<string> {
  const transaction = new Transaction().add(...instructions);
  return provider.sendAndConfirm(transaction, signers, { commitment: 'confirmed' });
}

/**
 * Asserts that a transaction failed with a specific Anchor error.
 *
 * Matching on the error name rather than the numeric code keeps the assertion
 * readable and survives renumbering of the enum.
 */
export async function expectAnchorError(
  run: () => Promise<unknown>,
  expected: string,
): Promise<void> {
  try {
    await run();
  } catch (error) {
    const text = JSON.stringify(error, (_key, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value,
    );
    const message = `${String(error)} ${text}`;
    if (!message.includes(expected)) {
      throw new Error(`expected error ${expected}, got: ${message.slice(0, 1200)}`, {
        cause: error,
      });
    }
    return;
  }
  throw new Error(`expected the transaction to fail with ${expected}, but it succeeded`);
}

export const SPL = {
  tokenProgram: TOKEN_PROGRAM_ID,
  associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
  instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
};

export { BN, PublicKey, Keypair };
