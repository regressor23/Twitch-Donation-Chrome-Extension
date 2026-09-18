/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/tip_vault.json`.
 */
export type TipVault = {
  "address": "J6uAbWr24AsXfhmW8cTannQ7ZE2cqqWiCLs9s9PqWMxz",
  "metadata": {
    "name": "tipVault",
    "version": "0.0.0",
    "spec": "0.1.0",
    "description": "TipVault: non-custodial USDC tips for Twitch channels"
  },
  "docs": [
    "Non-custodial tipping for Twitch channels.",
    "",
    "The program never holds a key that can spend a user's funds: direct tips go",
    "wallet to wallet, and escrow is held by a PDA that can only pay the",
    "attested streamer or refund the original donor after expiry."
  ],
  "instructions": [
    {
      "name": "claim",
      "discriminator": [
        62,
        198,
        214,
        193,
        213,
        159,
        108,
        210
      ],
      "accounts": [
        {
          "name": "claimer",
          "writable": true,
          "signer": true
        },
        {
          "name": "recipient",
          "docs": [
            "attestation and used as the token account authority."
          ]
        },
        {
          "name": "recipientToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "recipient"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "channelId"
              }
            ]
          }
        },
        {
          "name": "escrowToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "usedNonce",
          "docs": [
            "Replay guard: `init` fails if this nonce was already burnt."
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  111,
                  110,
                  99,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "channelId"
              },
              {
                "kind": "arg",
                "path": "attestation.nonce"
              }
            ]
          }
        },
        {
          "name": "instructionsSysvar",
          "address": "Sysvar1nstructions1111111111111111111111111"
        },
        {
          "name": "mint"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "channelId",
          "type": "u64"
        },
        {
          "name": "attestation",
          "type": {
            "defined": {
              "name": "attestationArgs"
            }
          }
        }
      ]
    },
    {
      "name": "refundExpired",
      "discriminator": [
        118,
        153,
        164,
        244,
        40,
        128,
        242,
        250
      ],
      "accounts": [
        {
          "name": "payer",
          "docs": [
            "Anyone may trigger a refund; the money can only go to the donor."
          ],
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "channelId"
              }
            ]
          }
        },
        {
          "name": "escrowTip",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  105,
                  112
                ]
              },
              {
                "kind": "arg",
                "path": "channelId"
              },
              {
                "kind": "arg",
                "path": "tipIndex"
              }
            ]
          }
        },
        {
          "name": "escrowToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "donorToken",
          "docs": [
            "Constrained to the donor recorded in the tip, so a refund cannot be",
            "redirected by whoever happens to send the transaction."
          ],
          "writable": true
        },
        {
          "name": "mint"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "channelId",
          "type": "u64"
        },
        {
          "name": "tipIndex",
          "type": "u64"
        }
      ]
    },
    {
      "name": "tipDirect",
      "discriminator": [
        115,
        77,
        74,
        159,
        245,
        23,
        115,
        51
      ],
      "accounts": [
        {
          "name": "donor",
          "signer": true
        },
        {
          "name": "donorToken",
          "writable": true
        },
        {
          "name": "recipientToken",
          "writable": true
        },
        {
          "name": "mint"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "memo",
          "type": "string"
        }
      ]
    },
    {
      "name": "tipEscrow",
      "discriminator": [
        126,
        22,
        211,
        33,
        233,
        51,
        140,
        139
      ],
      "accounts": [
        {
          "name": "donor",
          "writable": true,
          "signer": true
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "channelId"
              }
            ]
          }
        },
        {
          "name": "escrowToken",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "vault"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "mint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "escrowTip",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  116,
                  105,
                  112
                ]
              },
              {
                "kind": "arg",
                "path": "channelId"
              },
              {
                "kind": "account",
                "path": "vault.tipCount",
                "account": "vault"
              }
            ]
          }
        },
        {
          "name": "donorToken",
          "writable": true
        },
        {
          "name": "mint"
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "channelId",
          "type": "u64"
        },
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "expiresAt",
          "type": "i64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "escrowTip",
      "discriminator": [
        29,
        178,
        80,
        147,
        249,
        233,
        158,
        38
      ]
    },
    {
      "name": "usedNonce",
      "discriminator": [
        212,
        222,
        157,
        252,
        130,
        71,
        179,
        238
      ]
    },
    {
      "name": "vault",
      "discriminator": [
        211,
        8,
        232,
        43,
        2,
        152,
        117,
        119
      ]
    }
  ],
  "events": [
    {
      "name": "claimEvent",
      "discriminator": [
        93,
        15,
        70,
        170,
        48,
        140,
        212,
        219
      ]
    },
    {
      "name": "tipDirectEvent",
      "discriminator": [
        1,
        164,
        220,
        199,
        194,
        53,
        239,
        248
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "expiredEscrow",
      "msg": "Escrow tip has expired and can only be refunded to the donor"
    },
    {
      "code": 6001,
      "name": "notExpiredYet",
      "msg": "Escrow tip has not expired yet"
    },
    {
      "code": 6002,
      "name": "badAttestation",
      "msg": "Attestation is missing, malformed, or not signed by the authority for this claim"
    },
    {
      "code": 6003,
      "name": "amountTooSmall",
      "msg": "Tip is below the minimum amount"
    },
    {
      "code": 6004,
      "name": "memoTooLong",
      "msg": "Memo exceeds the maximum size"
    },
    {
      "code": 6005,
      "name": "attestationExpired",
      "msg": "Attestation has expired"
    },
    {
      "code": 6006,
      "name": "tipAlreadySettled",
      "msg": "Escrow tip has already been claimed or refunded"
    },
    {
      "code": 6007,
      "name": "mathOverflow",
      "msg": "Arithmetic overflow"
    }
  ],
  "types": [
    {
      "name": "attestationArgs",
      "docs": [
        "What the server signed, minus the signature itself: the signature travels",
        "in a separate ed25519 instruction in the same transaction."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "recipient",
            "docs": [
              "Wallet allowed to receive the escrow. Bound into the signed message."
            ],
            "type": "pubkey"
          },
          {
            "name": "nonce",
            "docs": [
              "One-shot value; burnt into a PDA so the attestation cannot be replayed."
            ],
            "type": "u64"
          },
          {
            "name": "expiresAt",
            "docs": [
              "Unix seconds after which the attestation is worthless."
            ],
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "claimEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "channelId",
            "type": "u64"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "tipsSettled",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "escrowTip",
      "docs": [
        "One escrowed tip. Kept as its own account so a donor can refund exactly",
        "their own tip and a claim can settle tips one by one."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "channelId",
            "type": "u64"
          },
          {
            "name": "index",
            "type": "u64"
          },
          {
            "name": "donor",
            "docs": [
              "Wallet that funded the tip; the only valid refund destination."
            ],
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "expiresAt",
            "type": "i64"
          },
          {
            "name": "settled",
            "docs": [
              "True once the tip has been claimed by the streamer or refunded to the",
              "donor. A settled tip is inert: it can never move funds again."
            ],
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "tipDirectEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "donor",
            "type": "pubkey"
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "mint",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "memo",
            "type": "string"
          }
        ]
      }
    },
    {
      "name": "usedNonce",
      "docs": [
        "Burnt attestation nonce. The existence of this account is the replay guard:",
        "a second claim with the same nonce fails to `init` it."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "channelId",
            "type": "u64"
          },
          {
            "name": "nonce",
            "type": "u64"
          },
          {
            "name": "usedAt",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "vault",
      "docs": [
        "One channel's escrow. Created lazily by the first escrow tip."
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "channelId",
            "docs": [
              "Numeric Twitch user id, also part of the PDA seeds."
            ],
            "type": "u64"
          },
          {
            "name": "tipCount",
            "docs": [
              "Index handed to the next `EscrowTip`; never decreases."
            ],
            "type": "u64"
          },
          {
            "name": "totalEscrowed",
            "docs": [
              "Minor units currently held for this channel, with claimed and refunded",
              "amounts already subtracted."
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
