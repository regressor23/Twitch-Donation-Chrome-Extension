use anchor_lang::prelude::*;
use anchor_lang::AccountsExit;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, TransferChecked};

use crate::attestation::{attestation_message, verify_attestation};
use crate::constants::{INSTRUCTIONS_SYSVAR_ID, NONCE_SEED, TIP_SEED, VAULT_SEED};
use crate::errors::TipVaultError;
use crate::state::{EscrowTip, UsedNonce, Vault};

/// What the server signed, minus the signature itself: the signature travels
/// in a separate ed25519 instruction in the same transaction.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct AttestationArgs {
    /// Wallet allowed to receive the escrow. Bound into the signed message.
    pub recipient: Pubkey,
    /// One-shot value; burnt into a PDA so the attestation cannot be replayed.
    pub nonce: u64,
    /// Unix seconds after which the attestation is worthless.
    pub expires_at: i64,
}

#[derive(Accounts)]
#[instruction(channel_id: u64, attestation: AttestationArgs)]
pub struct Claim<'info> {
    #[account(mut)]
    pub claimer: Signer<'info>,

    /// CHECK: only the address matters — it is matched against the signed
    /// attestation and used as the token account authority.
    pub recipient: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = claimer,
        associated_token::mint = mint,
        associated_token::authority = recipient
    )]
    pub recipient_token: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [VAULT_SEED, channel_id.to_le_bytes().as_ref()],
        bump = vault.bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut, associated_token::mint = mint, associated_token::authority = vault)]
    pub escrow_token: Account<'info, TokenAccount>,

    /// Replay guard: `init` fails if this nonce was already burnt.
    #[account(
        init,
        payer = claimer,
        space = 8 + UsedNonce::INIT_SPACE,
        seeds = [
            NONCE_SEED,
            channel_id.to_le_bytes().as_ref(),
            attestation.nonce.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub used_nonce: Account<'info, UsedNonce>,

    /// CHECK: address-checked; read only by the attestation verifier.
    #[account(address = INSTRUCTIONS_SYSVAR_ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,

    pub mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[event]
pub struct ClaimEvent {
    pub channel_id: u64,
    pub recipient: Pubkey,
    pub amount: u64,
    pub tips_settled: u32,
}

/// Settles the escrow tips passed as remaining accounts.
///
/// Tips are named explicitly instead of draining the whole vault balance on
/// purpose: an expired tip belongs to its donor, and a claim that swept the
/// balance would race `refund_expired` and take money that is no longer the
/// streamer's to take.
pub fn handle_claim<'info>(
    ctx: Context<'info, Claim<'info>>,
    channel_id: u64,
    attestation: AttestationArgs,
) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;

    require!(
        attestation.expires_at > now,
        TipVaultError::AttestationExpired
    );
    require_keys_eq!(
        attestation.recipient,
        ctx.accounts.recipient.key(),
        TipVaultError::BadAttestation
    );

    let message = attestation_message(
        channel_id,
        &attestation.recipient,
        attestation.nonce,
        attestation.expires_at,
    );
    verify_attestation(&ctx.accounts.instructions_sysvar.to_account_info(), &message)?;

    let mut total: u64 = 0;
    let mut settled: u32 = 0;
    for account in ctx.remaining_accounts.iter() {
        // `try_from` already enforces ownership by this program and the
        // account discriminator; the seed check below pins it to this channel.
        let mut tip: Account<'info, EscrowTip> = Account::try_from(account)?;

        let expected = Pubkey::create_program_address(
            &[
                TIP_SEED,
                channel_id.to_le_bytes().as_ref(),
                tip.index.to_le_bytes().as_ref(),
                &[tip.bump],
            ],
            &crate::ID,
        )
        .map_err(|_| error!(TipVaultError::BadAttestation))?;
        require_keys_eq!(account.key(), expected, TipVaultError::BadAttestation);
        require!(
            tip.channel_id == channel_id,
            TipVaultError::BadAttestation
        );
        require!(!tip.settled, TipVaultError::TipAlreadySettled);
        require!(tip.expires_at > now, TipVaultError::ExpiredEscrow);

        total = total
            .checked_add(tip.amount)
            .ok_or(TipVaultError::MathOverflow)?;
        tip.settled = true;
        tip.exit(&crate::ID)?;
        settled = settled.checked_add(1).ok_or(TipVaultError::MathOverflow)?;
    }

    if total > 0 {
        let channel_bytes = channel_id.to_le_bytes();
        let vault_bump = ctx.accounts.vault.bump;
        let signer_seeds: &[&[&[u8]]] = &[&[VAULT_SEED, channel_bytes.as_ref(), &[vault_bump]]];

        token::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                TransferChecked {
                    from: ctx.accounts.escrow_token.to_account_info(),
                    mint: ctx.accounts.mint.to_account_info(),
                    to: ctx.accounts.recipient_token.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer_seeds,
            ),
            total,
            ctx.accounts.mint.decimals,
        )?;

        ctx.accounts.vault.remove_escrow(total)?;
    }

    let used_nonce = &mut ctx.accounts.used_nonce;
    used_nonce.channel_id = channel_id;
    used_nonce.nonce = attestation.nonce;
    used_nonce.used_at = now;

    emit!(ClaimEvent {
        channel_id,
        recipient: ctx.accounts.recipient.key(),
        amount: total,
        tips_settled: settled,
    });

    Ok(())
}
