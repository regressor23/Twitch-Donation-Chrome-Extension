#![deny(clippy::all)]

use anchor_lang::prelude::*;

// Placeholder id from the Anchor template. Replaced with the real keypair in S2.
declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

/// tip_vault: tip_direct / tip_escrow / claim / refund_expired land in S2.
#[program]
pub mod tip_vault {}
