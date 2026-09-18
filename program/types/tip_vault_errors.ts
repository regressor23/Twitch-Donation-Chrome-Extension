
export const TipVaultErrorCode = {
  ExpiredEscrow: 6000,
  NotExpiredYet: 6001,
  BadAttestation: 6002,
  AmountTooSmall: 6003,
  MemoTooLong: 6004,
  AttestationExpired: 6005,
  TipAlreadySettled: 6006,
  MathOverflow: 6007
};

export type TipVaultErrorName = keyof typeof TipVaultErrorCode;
