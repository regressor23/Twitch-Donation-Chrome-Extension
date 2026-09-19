import { describe, expect, it } from 'vitest';

import { classify, creditsOf, memoOf, type ParsedLike } from './tx';

const USDC = '7LAHvqAJrBd6Czs3ragsn6fmzkouEUxyE6DgrR4piNRz';
const SCAM = 'Bjo4E8LBet8xtMyD9j5crMg4CUaqVr2gpbPifZ2tYqs3';
const STREAMER = 'DVZmvHwhtjXS28Bun15R2n5wLC4KTnMqZiLXBoYocxbJ';
const CHANNEL = '123456789';
const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

const channelByRecipient = new Map([[STREAMER, CHANNEL]]);
const options = { mint: USDC, channelByRecipient };

interface BuildOptions {
  mint?: string;
  owner?: string;
  before?: string;
  after?: string;
  memoLog?: string | null;
  memoInstruction?: string | null;
  err?: unknown;
  balances?: boolean;
}

function build(overrides: BuildOptions = {}): ParsedLike {
  const {
    mint = USDC,
    owner = STREAMER,
    before = '0',
    after = '2000000',
    memoLog = `tv1|${CHANNEL}|alex|gg wp`,
    memoInstruction = null,
    err = null,
    balances = true,
  } = overrides;

  return {
    slot: 500_000_000,
    meta: {
      err,
      logMessages: [
        'Program J6uAbWr24AsXfhmW8cTannQ7ZE2cqqWiCLs9s9PqWMxz invoke [1]',
        'Program log: Instruction: TipDirect',
        ...(memoLog === null ? [] : [`Program log: tipvault-memo: ${memoLog}`]),
        'Program J6uAbWr24AsXfhmW8cTannQ7ZE2cqqWiCLs9s9PqWMxz success',
      ],
      preTokenBalances: balances
        ? [{ accountIndex: 3, mint, owner, uiTokenAmount: { amount: before } }]
        : [],
      postTokenBalances: balances
        ? [{ accountIndex: 3, mint, owner, uiTokenAmount: { amount: after } }]
        : [],
    },
    transaction: {
      message: {
        instructions:
          memoInstruction === null ? [] : [{ programId: MEMO_PROGRAM, parsed: memoInstruction }],
      },
    },
  };
}

describe('creditsOf', () => {
  it('reports the net increase, not the ending balance', () => {
    const credits = creditsOf(build({ before: '5000000', after: '7000000' }), USDC);
    expect(credits).toEqual([{ owner: STREAMER, mint: USDC, amount: 2_000_000n }]);
  });

  it('ignores an account that only lost tokens', () => {
    expect(creditsOf(build({ before: '7000000', after: '5000000' }), USDC)).toEqual([]);
  });

  it('ignores every other mint', () => {
    expect(creditsOf(build({ mint: SCAM }), USDC)).toEqual([]);
  });

  it('survives an amount past the top of a double', () => {
    const huge = '18446744073709551615';
    const credits = creditsOf(build({ before: '0', after: huge }), USDC);
    expect(credits[0]?.amount).toBe(18_446_744_073_709_551_615n);
  });
});

describe('memoOf', () => {
  it('reads our program log', () => {
    expect(memoOf(build())).toBe(`tv1|${CHANNEL}|alex|gg wp`);
  });

  it('reads an SPL Memo instruction when there is no log', () => {
    const parsed = build({ memoLog: null, memoInstruction: 'hello from elsewhere' });
    expect(memoOf(parsed)).toBe('hello from elsewhere');
  });

  it('is null when neither is present', () => {
    expect(memoOf(build({ memoLog: null }))).toBeNull();
  });
});

describe('classify', () => {
  it('accepts a well-formed tip', () => {
    const verdict = classify(build(), options);
    expect(verdict.kind).toBe('tip');
    if (verdict.kind !== 'tip') return;
    expect(verdict.credit.amount).toBe(2_000_000n);
    expect(verdict.memo.nick).toBe('alex');
    expect(verdict.memo.message).toBe('gg wp');
  });

  /**
   * The condition this whole stage is judged on: a scam token with a perfectly
   * valid memo, sent to the streamer through our own program. Everything is
   * right except the mint, and nothing may be written down.
   */
  it('refuses a different mint even with a valid memo', () => {
    const verdict = classify(build({ mint: SCAM }), options);
    expect(verdict).toEqual({ kind: 'ignored', reason: 'other-mint' });
  });

  it('refuses a transfer to someone we do not watch', () => {
    const verdict = classify(
      build({ owner: 'F1xMgYXeNeuzQmdP6x2RN2tPcnGVYy1gLp9kZAqwfVaW' }),
      options,
    );
    expect(verdict).toEqual({ kind: 'ignored', reason: 'unknown-recipient' });
  });

  it('refuses a failed transaction', () => {
    const verdict = classify(build({ err: { InstructionError: [0, 'Custom'] } }), options);
    expect(verdict).toEqual({ kind: 'ignored', reason: 'transaction-failed' });
  });

  it('records a tip with no memo at all, silently', () => {
    const verdict = classify(build({ memoLog: null }), options);
    expect(verdict.kind).toBe('unreadable-memo');
  });

  it.each([
    ['truncated utf-8', 'tv1|123456789|al�'],
    ['a future version', `tv2|${CHANNEL}|alex|gg`],
    ['another protocol', 'jup:swap 12 SOL'],
    ['empty', ''],
    ['separators only', '|||'],
  ])('records but stays silent on %s', (_name, memo) => {
    const verdict = classify(build({ memoLog: memo }), options);
    expect(verdict.kind).toBe('unreadable-memo');
  });

  it('refuses a memo naming a channel other than the one paid', () => {
    const verdict = classify(build({ memoLog: 'tv1|999999999|alex|gg' }), options);
    expect(verdict.kind).toBe('channel-mismatch');
  });

  it('accepts a tip whose memo arrived through the Memo program', () => {
    const parsed = build({ memoLog: null, memoInstruction: `tv1|${CHANNEL}|bob|hi` });
    const verdict = classify(parsed, options);
    expect(verdict.kind).toBe('tip');
    if (verdict.kind !== 'tip') return;
    expect(verdict.memo.nick).toBe('bob');
  });

  it('reports nothing moved when there are no token balances', () => {
    const verdict = classify(build({ balances: false }), options);
    expect(verdict).toEqual({ kind: 'ignored', reason: 'no-token-movement' });
  });
});
