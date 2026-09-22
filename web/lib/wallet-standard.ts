/**
 * A wallet connector in one file, no adapter kit.
 *
 * The dashboard asks a wallet for exactly two things — an address and a
 * signature over a short message — and the Wallet Standard already defines
 * both. Pulling in `@solana/wallet-adapter-react` plus a UI kit to spend a
 * single button would add a provider tree, a modal and a pile of transitive
 * dependencies for behaviour this file covers in a hundred lines.
 *
 * Discovery follows the standard's handshake in both directions, because a
 * wallet extension may load before or after this page:
 *
 *  - wallets already present listen for `wallet-standard:app-ready` and call
 *    our `register` when they hear it;
 *  - wallets that load later announce themselves with
 *    `wallet-standard:register-wallet`, handing us a callback to feed our API
 *    into.
 *
 * Anything that does not speak the standard is picked up by the legacy branch
 * at the bottom: Phantom and Solflare both still inject a provider object, and
 * a streamer with an older build should not be told to reinstall their wallet.
 */
'use client';

interface StandardAccount {
  address: string;
  publicKey: Uint8Array;
  features: readonly string[];
}

interface StandardWallet {
  name: string;
  icon?: string;
  accounts: readonly StandardAccount[];
  features: Record<string, unknown>;
}

interface ConnectFeature {
  connect(): Promise<{ accounts: readonly StandardAccount[] }>;
}

interface SignMessageFeature {
  signMessage(input: {
    account: StandardAccount;
    message: Uint8Array;
  }): Promise<ReadonlyArray<{ signature: Uint8Array }>>;
}

/** What the dashboard sees: a name to show and two things it can do. */
export interface WalletHandle {
  name: string;
  icon?: string;
  connect(): Promise<ConnectedWallet>;
}

export interface ConnectedWallet {
  name: string;
  address: string;
  signMessage(message: string): Promise<Uint8Array>;
}

const CONNECT = 'standard:connect';
const SIGN_MESSAGE = 'solana:signMessage';

function wrap(wallet: StandardWallet): WalletHandle {
  return {
    name: wallet.name,
    icon: wallet.icon,
    async connect(): Promise<ConnectedWallet> {
      const connect = wallet.features[CONNECT] as ConnectFeature | undefined;
      const signer = wallet.features[SIGN_MESSAGE] as SignMessageFeature | undefined;
      if (!connect || !signer) {
        throw new Error(`${wallet.name} cannot sign messages`);
      }

      const { accounts } = await connect.connect();
      const account = accounts[0] ?? wallet.accounts[0];
      if (!account) {
        throw new Error(`${wallet.name} returned no account`);
      }

      return {
        name: wallet.name,
        address: account.address,
        async signMessage(message: string): Promise<Uint8Array> {
          const [result] = await signer.signMessage({
            account,
            message: new TextEncoder().encode(message),
          });
          if (!result) {
            throw new Error('the wallet returned no signature');
          }
          return result.signature;
        },
      };
    },
  };
}

interface LegacyProvider {
  isPhantom?: boolean;
  connect(): Promise<{ publicKey: { toString(): string } }>;
  signMessage(message: Uint8Array, encoding?: string): Promise<{ signature: Uint8Array }>;
}

function wrapLegacy(name: string, provider: LegacyProvider): WalletHandle {
  return {
    name,
    async connect(): Promise<ConnectedWallet> {
      const { publicKey } = await provider.connect();
      return {
        name,
        address: publicKey.toString(),
        async signMessage(message: string): Promise<Uint8Array> {
          const { signature } = await provider.signMessage(
            new TextEncoder().encode(message),
            'utf8',
          );
          return signature;
        },
      };
    },
  };
}

/**
 * Every wallet this browser can offer, deduplicated by name.
 *
 * Synchronous on purpose: the standard's handshake is event-based but
 * instantaneous, so a caller can ask on mount and re-ask when the user clicks,
 * rather than holding a subscription for a dialog that lasts two seconds.
 */
export function availableWallets(): WalletHandle[] {
  if (typeof window === 'undefined') {
    return [];
  }

  const found = new Map<string, WalletHandle>();
  const register = (...wallets: StandardWallet[]): (() => void) => {
    for (const wallet of wallets) {
      if (!found.has(wallet.name)) {
        found.set(wallet.name, wrap(wallet));
      }
    }
    return () => undefined;
  };
  const api = {
    register,
    get: (): StandardWallet[] => [],
    on: (): (() => void) => () => undefined,
  };

  const onRegister = (event: Event): void => {
    const callback = (event as CustomEvent<(api: unknown) => void>).detail;
    if (typeof callback === 'function') {
      callback(api);
    }
  };

  window.addEventListener('wallet-standard:register-wallet', onRegister);
  window.dispatchEvent(new CustomEvent('wallet-standard:app-ready', { detail: api }));
  window.removeEventListener('wallet-standard:register-wallet', onRegister);

  const legacy = window as unknown as {
    solana?: LegacyProvider;
    solflare?: LegacyProvider & { isSolflare?: boolean };
  };
  if (legacy.solana && !found.has('Phantom')) {
    found.set('Phantom', wrapLegacy(legacy.solana.isPhantom ? 'Phantom' : 'Wallet', legacy.solana));
  }
  if (legacy.solflare && !found.has('Solflare')) {
    found.set('Solflare', wrapLegacy('Solflare', legacy.solflare));
  }

  return [...found.values()];
}
