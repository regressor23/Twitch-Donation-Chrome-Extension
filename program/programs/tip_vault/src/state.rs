use anchor_lang::prelude::*;

use crate::errors::TipVaultError;

/// One channel's escrow. Created lazily by the first escrow tip.
#[account]
#[derive(InitSpace)]
pub struct Vault {
    /// Numeric Twitch user id, also part of the PDA seeds.
    pub channel_id: u64,
    /// Index handed to the next `EscrowTip`; never decreases.
    pub tip_count: u64,
    /// Minor units currently held for this channel, with claimed and refunded
    /// amounts already subtracted.
    pub total_escrowed: u64,
    pub bump: u8,
}

impl Vault {
    /// Every increase of the escrow total goes through here.
    ///
    /// Overflow is a hard error, never a wrap: wrapping this counter would let
    /// the vault report less than it holds, and the difference would be money
    /// nobody could ever take out.
    pub fn add_escrow(&mut self, amount: u64) -> Result<()> {
        self.total_escrowed = self
            .total_escrowed
            .checked_add(amount)
            .ok_or(TipVaultError::MathOverflow)?;
        Ok(())
    }

    /// Every decrease — claim or refund — goes through here.
    pub fn remove_escrow(&mut self, amount: u64) -> Result<()> {
        self.total_escrowed = self
            .total_escrowed
            .checked_sub(amount)
            .ok_or(TipVaultError::MathOverflow)?;
        Ok(())
    }
}

/// One escrowed tip. Kept as its own account so a donor can refund exactly
/// their own tip and a claim can settle tips one by one.
#[account]
#[derive(InitSpace)]
pub struct EscrowTip {
    pub channel_id: u64,
    pub index: u64,
    /// Wallet that funded the tip; the only valid refund destination.
    pub donor: Pubkey,
    pub amount: u64,
    pub expires_at: i64,
    /// True once the tip has been claimed by the streamer or refunded to the
    /// donor. A settled tip is inert: it can never move funds again.
    pub settled: bool,
    pub bump: u8,
}

/// Burnt attestation nonce. The existence of this account is the replay guard:
/// a second claim with the same nonce fails to `init` it.
#[account]
#[derive(InitSpace)]
pub struct UsedNonce {
    pub channel_id: u64,
    pub nonce: u64,
    pub used_at: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn vault_with(total: u64) -> Vault {
        Vault {
            channel_id: 42,
            tip_count: 0,
            total_escrowed: total,
            bump: 255,
        }
    }

    #[test]
    fn add_escrow_accumulates() {
        let mut vault = vault_with(1_000_000);
        vault.add_escrow(2_000_000).unwrap();
        assert_eq!(vault.total_escrowed, 3_000_000);
    }

    #[test]
    fn add_escrow_rejects_overflow_and_leaves_the_total_alone() {
        let mut vault = vault_with(u64::MAX - 5);
        assert!(vault.add_escrow(6).is_err());
        assert_eq!(vault.total_escrowed, u64::MAX - 5);
    }

    #[test]
    fn add_escrow_accepts_the_exact_boundary() {
        let mut vault = vault_with(u64::MAX - 5);
        vault.add_escrow(5).unwrap();
        assert_eq!(vault.total_escrowed, u64::MAX);
    }

    #[test]
    fn remove_escrow_rejects_underflow() {
        let mut vault = vault_with(1_000_000);
        assert!(vault.remove_escrow(1_000_001).is_err());
        assert_eq!(vault.total_escrowed, 1_000_000);
    }

    #[test]
    fn remove_escrow_can_empty_the_vault() {
        let mut vault = vault_with(1_000_000);
        vault.remove_escrow(1_000_000).unwrap();
        assert_eq!(vault.total_escrowed, 0);
    }
}
