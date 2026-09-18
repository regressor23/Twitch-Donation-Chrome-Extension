#![deny(clippy::all)]

use anchor_lang::prelude::*;

pub mod attestation;
pub mod constants;
pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("J6uAbWr24AsXfhmW8cTannQ7ZE2cqqWiCLs9s9PqWMxz");

/// Non-custodial tipping for Twitch channels.
///
/// The program never holds a key that can spend a user's funds: direct tips go
/// wallet to wallet, and escrow is held by a PDA that can only pay the
/// attested streamer or refund the original donor after expiry.
#[program]
pub mod tip_vault {
    use super::*;

    pub fn tip_direct(ctx: Context<TipDirect>, amount: u64, memo: String) -> Result<()> {
        instructions::tip_direct::handle_tip_direct(ctx, amount, memo)
    }

    pub fn tip_escrow(
        ctx: Context<TipEscrow>,
        channel_id: u64,
        amount: u64,
        expires_at: i64,
    ) -> Result<()> {
        instructions::tip_escrow::handle_tip_escrow(ctx, channel_id, amount, expires_at)
    }

    pub fn claim<'info>(
        ctx: Context<'info, Claim<'info>>,
        channel_id: u64,
        attestation: AttestationArgs,
    ) -> Result<()> {
        instructions::claim::handle_claim(ctx, channel_id, attestation)
    }

    pub fn refund_expired(
        ctx: Context<RefundExpired>,
        channel_id: u64,
        tip_index: u64,
    ) -> Result<()> {
        instructions::refund_expired::handle_refund_expired(ctx, channel_id, tip_index)
    }
}
