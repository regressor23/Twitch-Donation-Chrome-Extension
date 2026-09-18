use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::constants::{MAX_MEMO_BYTES, MIN_TIP_AMOUNT};
use crate::errors::TipVaultError;

#[derive(Accounts)]
pub struct TipDirect<'info> {
    pub donor: Signer<'info>,

    #[account(mut, token::mint = mint, token::authority = donor)]
    pub donor_token: Account<'info, TokenAccount>,

    #[account(mut, token::mint = mint)]
    pub recipient_token: Account<'info, TokenAccount>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[event]
pub struct TipDirectEvent {
    pub donor: Pubkey,
    pub recipient: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
    pub memo: String,
}

/// Straight transfer into the streamer's own token account. The program never
/// touches the funds; it is here to carry the memo and emit an event the
/// indexer can trust, because the alert must come from a confirmed
/// transaction rather than from the client that claims to have sent one.
pub fn handle_tip_direct(ctx: Context<TipDirect>, amount: u64, memo: String) -> Result<()> {
    require!(amount >= MIN_TIP_AMOUNT, TipVaultError::AmountTooSmall);
    // String::len is already the UTF-8 byte count, which is the unit the chain
    // charges for and the unit MEMO_LIMITS.maxBytes is written in.
    require!(memo.len() <= MAX_MEMO_BYTES, TipVaultError::MemoTooLong);

    token::transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.donor_token.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.recipient_token.to_account_info(),
                authority: ctx.accounts.donor.to_account_info(),
            },
        ),
        amount,
        ctx.accounts.mint.decimals,
    )?;

    // The event is what the indexer parses; the plain line keeps the memo
    // greppable in raw transaction logs when something has to be debugged.
    msg!("tipvault-memo: {}", memo);
    emit!(TipDirectEvent {
        donor: ctx.accounts.donor.key(),
        recipient: ctx.accounts.recipient_token.owner,
        mint: ctx.accounts.mint.key(),
        amount,
        memo,
    });

    Ok(())
}
