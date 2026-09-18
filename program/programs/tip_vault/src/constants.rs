use anchor_lang::prelude::*;

/// Ed25519 public key of the server that signs claim attestations.
///
/// The private half lives only in the server env (`AUTHORITY_SECRET`,
/// CLAUDE.md 5.5). Rotating it means redeploying the program, which is fine
/// because the upgrade authority stays with us.
pub const ATTESTATION_AUTHORITY: Pubkey = pubkey!("BbEu1A9qFA8MEqBKHar8MnzMJ1m7CbSAwXcEP95gpsy6");

/// Minimum tip in minor units: $1.00 of a six-decimal stablecoin.
pub const MIN_TIP_AMOUNT: u64 = 1_000_000;

/// Hard limit for the memo, mirroring `MEMO_LIMITS.maxBytes` in the codec.
pub const MAX_MEMO_BYTES: usize = 300;

/// Domain separator: without it a signature could be replayed into any other
/// protocol that happens to sign the same field layout.
pub const ATTESTATION_DOMAIN: &[u8] = b"tipvault-claim-v1";

/// Native ed25519 signature verification program. Anchor 1.x no longer
/// re-exports this id, and it is a fixed address, so it is pinned here.
pub const ED25519_PROGRAM_ID: Pubkey = pubkey!("Ed25519SigVerify111111111111111111111111111");

/// Instructions sysvar: the account that lets a program read the other
/// instructions of its own transaction.
pub const INSTRUCTIONS_SYSVAR_ID: Pubkey = pubkey!("Sysvar1nstructions1111111111111111111111111");

pub const VAULT_SEED: &[u8] = b"vault";
pub const TIP_SEED: &[u8] = b"tip";
pub const NONCE_SEED: &[u8] = b"nonce";
