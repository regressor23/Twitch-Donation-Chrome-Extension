use anchor_lang::prelude::*;

#[error_code]
pub enum TipVaultError {
    #[msg("Escrow tip has expired and can only be refunded to the donor")]
    ExpiredEscrow,
    #[msg("Escrow tip has not expired yet")]
    NotExpiredYet,
    #[msg("Attestation is missing, malformed, or not signed by the authority for this claim")]
    BadAttestation,
    #[msg("Tip is below the minimum amount")]
    AmountTooSmall,
    #[msg("Memo exceeds the maximum size")]
    MemoTooLong,
    #[msg("Attestation has expired")]
    AttestationExpired,
    #[msg("Escrow tip has already been claimed or refunded")]
    TipAlreadySettled,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}
