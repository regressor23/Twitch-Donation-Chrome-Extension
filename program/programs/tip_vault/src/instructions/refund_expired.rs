use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::constants::{TIP_SEED, VAULT_SEED};
use crate::errors::TipVaultError;
use crate::state::{EscrowTip, Vault};

#[derive(Accounts)]
#[instruction(channel_id: u64, tip_index: u64)]
pub struct RefundExpired<'info> {
    /// Anyone may trigger a refund; the money can only go to the donor.
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [VAULT_SEED, channel_id.to_le_bytes().as_ref()],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [
            TIP_SEED,
            channel_id.to_le_bytes().as_ref(),
            tip_index.to_le_bytes().as_ref()
        ],
        bump = escrow_tip.bump
    )]
    pub escrow_tip: Account<'info, EscrowTip>,

    #[account(mut, associated_token::mint = mint, associated_token::authority = vault)]
    pub escrow_token: Account<'info, TokenAccount>,

    /// Constrained to the donor recorded in the tip, so a refund cannot be
    /// redirected by whoever happens to send the transaction.
    #[account(mut, token::mint = mint, token::authority = escrow_tip.donor)]
    pub donor_token: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_refund_expired(ctx: Context<RefundExpired>, channel_id: u64, _tip_index: u64) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    require!(
        !ctx.accounts.escrow_tip.settled,
        TipVaultError::TipAlreadySettled
    );
    require!(
        now > ctx.accounts.escrow_tip.expires_at,
        TipVaultError::NotExpiredYet
    );

    let amount = ctx.accounts.escrow_tip.amount;
    let channel_bytes = channel_id.to_le_bytes();
    let vault_bump = ctx.accounts.vault.bump;
    let signer_seeds: &[&[&[u8]]] = &[&[VAULT_SEED, channel_bytes.as_ref(), &[vault_bump]]];

    token::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.escrow_token.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.donor_token.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    // Mark settled only after the transfer succeeded.
    ctx.accounts.escrow_tip.settled = true;
    ctx.accounts.vault.remove_escrow(amount)?;

    Ok(())
}
