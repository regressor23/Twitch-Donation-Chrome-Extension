/**
 * Turns an API failure into something a streamer can read.
 *
 * The routes answer with a short `code` next to their English `error` string;
 * this maps the code to a message key. The list is closed on purpose — the code
 * arrives over the network, and building a dictionary key out of unvalidated
 * input is how a page ends up rendering `undefined`.
 */
import type { MessageKey } from './i18n';

const CODES = ['session', 'address', 'expired', 'mismatch', 'declined', 'other'] as const;

export function errorKey(code: unknown): MessageKey {
  if (typeof code === 'string' && (CODES as readonly string[]).includes(code)) {
    return `error.${code}` as MessageKey;
  }
  return 'error.other';
}

/** The message key for a response that came back not-ok. */
export async function failureKey(response: Response): Promise<MessageKey> {
  try {
    const body = (await response.json()) as { code?: unknown };
    return errorKey(body.code);
  } catch {
    return 'error.other';
  }
}
