//! Verification of claim attestations signed by the server.
//!
//! The signature itself is checked by Solana's native ed25519 program, which
//! must appear as a separate instruction in the same transaction. This module
//! does the part the native program cannot do: prove that what was signed is
//! exactly this claim, by this authority, and that the signed bytes really
//! live inside that ed25519 instruction rather than being borrowed from
//! somewhere else in the transaction.

use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::Instruction;
use solana_instructions_sysvar::{load_current_index_checked, load_instruction_at_checked};

use crate::constants::{ATTESTATION_AUTHORITY, ATTESTATION_DOMAIN, ED25519_PROGRAM_ID};
use crate::errors::TipVaultError;

/// Ed25519SigVerify instruction data: `num_signatures` (u8), padding (u8),
/// then one 14-byte offsets struct per signature.
const OFFSETS_START: usize = 2;
const OFFSETS_SIZE: usize = 14;
const SIGNATURE_LEN: usize = 64;
const PUBKEY_LEN: usize = 32;

/// Sentinel meaning "this same instruction" in the offsets struct.
const THIS_INSTRUCTION: u16 = u16::MAX;

/// The exact bytes the authority has to sign.
///
/// The program id is part of the message so a signature produced for one
/// deployment cannot be replayed against another.
pub fn attestation_message(
    channel_id: u64,
    recipient: &Pubkey,
    nonce: u64,
    expires_at: i64,
) -> Vec<u8> {
    let mut message = Vec::with_capacity(ATTESTATION_DOMAIN.len() + 32 + 8 + 32 + 8 + 8);
    message.extend_from_slice(ATTESTATION_DOMAIN);
    message.extend_from_slice(crate::ID.as_ref());
    message.extend_from_slice(&channel_id.to_le_bytes());
    message.extend_from_slice(recipient.as_ref());
    message.extend_from_slice(&nonce.to_le_bytes());
    message.extend_from_slice(&expires_at.to_le_bytes());
    message
}

/// Requires exactly one ed25519 instruction before this one, and requires it
/// to carry the authority's signature over `expected_message`.
pub fn verify_attestation(ix_sysvar: &AccountInfo, expected_message: &[u8]) -> Result<()> {
    let current = load_current_index_checked(ix_sysvar)? as usize;

    let mut verified = 0usize;
    for index in 0..current {
        let ix = load_instruction_at_checked(index, ix_sysvar)?;
        if ix.program_id != ED25519_PROGRAM_ID {
            continue;
        }
        // Every ed25519 instruction in front of the claim has to be the right
        // one: a decoy alongside a valid one would otherwise slip through.
        check_ed25519_instruction(&ix, expected_message)?;
        verified += 1;
    }

    require!(verified == 1, TipVaultError::BadAttestation);
    Ok(())
}

fn check_ed25519_instruction(ix: &Instruction, expected_message: &[u8]) -> Result<()> {
    let data = ix.data.as_slice();
    require!(
        data.len() >= OFFSETS_START + OFFSETS_SIZE,
        TipVaultError::BadAttestation
    );
    // Exactly one signature, and the padding byte the runtime expects.
    require!(data[0] == 1, TipVaultError::BadAttestation);
    require!(data[1] == 0, TipVaultError::BadAttestation);

    let offsets = &data[OFFSETS_START..OFFSETS_START + OFFSETS_SIZE];
    let read_u16 = |at: usize| u16::from_le_bytes([offsets[at], offsets[at + 1]]);

    let signature_offset = read_u16(0) as usize;
    let signature_ix_index = read_u16(2);
    let pubkey_offset = read_u16(4) as usize;
    let pubkey_ix_index = read_u16(6);
    let message_offset = read_u16(8) as usize;
    let message_size = read_u16(10) as usize;
    let message_ix_index = read_u16(12);

    // The attack this blocks: the offsets may point into *another* instruction
    // of the transaction. The native program would then happily verify a
    // genuine signature over bytes we never inspect, while we compare the
    // message we can see. Everything must live in this instruction.
    require!(
        signature_ix_index == THIS_INSTRUCTION
            && pubkey_ix_index == THIS_INSTRUCTION
            && message_ix_index == THIS_INSTRUCTION,
        TipVaultError::BadAttestation
    );

    let signature_end = signature_offset
        .checked_add(SIGNATURE_LEN)
        .ok_or(TipVaultError::BadAttestation)?;
    let pubkey_end = pubkey_offset
        .checked_add(PUBKEY_LEN)
        .ok_or(TipVaultError::BadAttestation)?;
    let message_end = message_offset
        .checked_add(message_size)
        .ok_or(TipVaultError::BadAttestation)?;
    require!(
        signature_end <= data.len() && pubkey_end <= data.len() && message_end <= data.len(),
        TipVaultError::BadAttestation
    );

    require!(
        data[pubkey_offset..pubkey_end] == *ATTESTATION_AUTHORITY.as_ref(),
        TipVaultError::BadAttestation
    );
    require!(
        &data[message_offset..message_end] == expected_message,
        TipVaultError::BadAttestation
    );

    Ok(())
}
