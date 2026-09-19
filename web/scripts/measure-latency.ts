/**
 * Measures the number the stage is judged on: seconds from a confirmed
 * transaction to the alert arriving at an overlay.
 *
 * It subscribes to the real SSE endpoint the way OBS does, sends real tips
 * through `tip-devnet.ts` as a child process, and matches events by signature.
 *
 * Two baselines are reported, because they answer different questions:
 *
 *  - **from signature** — the signed transaction left the donor's machine. This
 *    is the number the acceptance condition names and the one a viewer feels:
 *    it contains Solana's confirmation time as well as ours.
 *  - **from our confirmation** — our own confirmation round trip returned. This
 *    one can go negative, and legitimately so: Helius pushes from its own node
 *    the moment the slot confirms, which can beat our client's round trip. A
 *    negative value is not a broken clock — both instants are `Date.now()` in
 *    this process — it means the alert path was never the bottleneck.
 *
 *   pnpm --filter @tipvault/web measure -- --base https://<host> --token <t> --runs 5
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { loadLocalEnv } from '../lib/env';

loadLocalEnv();

const run = promisify(execFile);

interface Arrival {
  signature: string;
  at: number;
}

/** Reads the stream forever, recording when each tip event lands. */
async function listen(url: string, arrivals: Arrival[], done: AbortSignal): Promise<void> {
  const response = await fetch(url, {
    headers: { accept: 'text/event-stream' },
    signal: done,
  });
  if (!response.ok || !response.body) {
    throw new Error(`stream failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done: finished, value } = await reader.read();
    if (finished) {
      return;
    }
    buffer += decoder.decode(value, { stream: true });

    let split = buffer.indexOf('\n\n');
    while (split >= 0) {
      const frame = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      split = buffer.indexOf('\n\n');

      const at = Date.now();
      const data = frame
        .split('\n')
        .find((line) => line.startsWith('data: '))
        ?.slice(6);
      if (!data) {
        continue;
      }
      try {
        const alert = JSON.parse(data) as { signature?: string };
        if (alert.signature) {
          arrivals.push({ signature: alert.signature, at });
        }
      } catch {
        // A comment frame or a partial write: nothing to record.
      }
    }
  }
}

async function sendTip(
  index: number,
): Promise<{ signature: string; sentAt: number; confirmedAt: number }> {
  const { stdout } = await run(
    'pnpm',
    ['exec', 'tsx', 'scripts/tip-devnet.ts', '--amount', '1', '--nick', `run${index}`, '--message', `latency run ${index}`],
    { cwd: process.cwd(), maxBuffer: 1024 * 1024 },
  );
  const match = /SENT_AT=(\d+) CONFIRMED_AT=(\d+) SIGNATURE=(\S+)/.exec(stdout);
  if (!match) {
    throw new Error(`could not read the signature back:\n${stdout.slice(-400)}`);
  }
  return {
    sentAt: Number(match[1]),
    confirmedAt: Number(match[2]),
    signature: match[3] as string,
  };
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const flag = (name: string, fallback: string): string => {
    const index = argv.indexOf(`--${name}`);
    return index >= 0 ? (argv[index + 1] ?? fallback) : fallback;
  };

  const base = flag('base', 'http://127.0.0.1:3000').replace(/\/$/, '');
  const token = flag('token', process.env.TEST_OVERLAY_TOKEN ?? '');
  const runs = Number(flag('runs', '5'));
  if (!token) {
    throw new Error('pass --token <overlay token>');
  }

  const arrivals: Arrival[] = [];
  const controller = new AbortController();
  const stream = listen(`${base}/api/overlay/${token}/stream`, arrivals, controller.signal);
  stream.catch((error: unknown) => {
    if (!controller.signal.aborted) {
      console.error('stream error:', error);
    }
  });

  // Let the catch-up burst land before the first measured tip.
  await new Promise((resolve) => setTimeout(resolve, 1500));
  arrivals.length = 0;

  const fromSignature: number[] = [];
  const fromConfirmation: number[] = [];
  for (let index = 1; index <= runs; index += 1) {
    const { signature, sentAt, confirmedAt } = await sendTip(index);

    const deadline = Date.now() + 30_000;
    let arrival: Arrival | undefined;
    while (!arrival && Date.now() < deadline) {
      arrival = arrivals.find((entry) => entry.signature === signature);
      if (!arrival) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }

    if (!arrival) {
      console.log(`run ${index}: NO ALERT within 30 s  ${signature.slice(0, 12)}…`);
      continue;
    }
    const signed = (arrival.at - sentAt) / 1000;
    const confirmed = (arrival.at - confirmedAt) / 1000;
    fromSignature.push(signed);
    fromConfirmation.push(confirmed);
    console.log(
      `run ${index}: ${signed.toFixed(2)} s from signature, ` +
        `${confirmed.toFixed(2)} s from our confirmation  ${signature.slice(0, 12)}…`,
    );
  }

  controller.abort();

  const report = (label: string, values: number[]): void => {
    if (values.length === 0) {
      return;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] as number;
    console.log(
      `${label.padEnd(20)} runs ${values.length}/${runs}  median ${median.toFixed(2)} s  ` +
        `min ${sorted[0]?.toFixed(2)} s  max ${sorted[sorted.length - 1]?.toFixed(2)} s`,
    );
  };

  console.log('');
  report('from signature', fromSignature);
  report('from confirmation', fromConfirmation);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
