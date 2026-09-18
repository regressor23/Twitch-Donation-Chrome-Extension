use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::constants::{MIN_TIP_AMOUNT, TIP_SEED, VAULT_SEED};
use crate::errors::TipVaultError;
use crate::state::{EscrowTip, Vault};

#[derive(Accounts)]
#[instruction(channel_id: u64)]
pub struct TipEscrow<'info> {
    #[account(mut)]
    pub donor: Signer<'info>,

    #[account(
        init_if_needed,
        payer = donor,
        space = 8 + Vault::INIT_SPACE,
        seeds = [VAULT_SEED, channel_id.to_le_bytes().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init_if_needed,
        payer = donor,
        associated_token::mint = mint,
        associated_token::authority = vault
    )]
    pub escrow_token: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = donor,
        space = 8 + EscrowTip::INIT_SPACE,
        seeds = [
            TIP_SEED,
            channel_id.to_le_bytes().as_ref(),
            vault.tip_count.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub escrow_tip: Account<'info, EscrowTip>,

    #[account(mut, token::mint = mint, token::authority = donor)]
    pub donor_token: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Tip to a channel nobody has registered yet: funds sit in the vault's own
/// token account until the streamer proves ownership, and go back to the donor
/// automatically once `expires_at` passes.
pub fn handle_tip_escrow(
    ctx: Context<TipEscrow>,
    channel_id: u64,
    amount: u64,
    expires_at: i64,
) -> Result<()> {
    require!(amount >= MIN_TIP_AMOUNT, TipVaultError::AmountTooSmall);

    let now = Clock::get()?.unix_timestamp;
    require!(expires_at > now, TipVaultError::ExpiredEscrow);

    let index = ctx.accounts.vault.tip_count;

    let vault = &mut ctx.accounts.vault;
    // Safe to assign unconditionally: the PDA seeds already pin channel_id.
    vault.channel_id = channel_id;
    vault.bump = ctx.bumps.vault;
    vault.tip_count = index
        .checked_add(1)
        .ok_or(TipVaultError::MathOverflow)?;
    vault.add_escrow(amount)?;

    let tip = &mut ctx.accounts.escrow_tip;
    tip.channel_id = channel_id;
    tip.index = index;
    tip.donor = ctx.accounts.donor.key();
    tip.amount = amount;
    tip.expires_at = expires_at;
    tip.settled = false;
    tip.bump = ctx.bumps.escrow_tip;

    token::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.donor_token.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.escrow_token.to_account_info(),
                authority: ctx.accounts.donor.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    Ok(())
}
