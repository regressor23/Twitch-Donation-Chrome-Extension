/**
 * The only two Twitch calls this product makes.
 *
 * We are not a Twitch integration: we never read chat, subscriptions, follows
 * or email. The whole purpose of signing in is to learn one fact — which
 * numeric channel id this person owns — because that id is what the memo
 * carries (§5.1) and what decides whose overlay a tip lands on.
 *
 * That is why the authorize URL asks for **no scopes at all**. Helix's Get
 * Users returns the authenticated user with an unscoped user token; asking for
 * `user:read:email` would get us a field we must then be careful not to store
 * (§5.4: no donor PII, and no more creator PII than we need).
 */
import { twitchConfig } from './env';

const AUTHORIZE_URL = 'https://id.twitch.tv/oauth2/authorize';
const TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const USERS_URL = 'https://api.twitch.tv/helix/users';

export interface TwitchUser {
  /** Numeric user id — the `channel_id` in every memo. */
  id: string;
  login: string;
  displayName: string;
}

export function authorizeUrl(state: string): string {
  const config = twitchConfig();
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set('client_id', config.TWITCH_CLIENT_ID);
  url.searchParams.set('redirect_uri', config.TWITCH_REDIRECT_URI);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', '');
  url.searchParams.set('state', state);
  return url.toString();
}

/** Exchanges the one-time code for a user access token. */
async function exchangeCode(code: string): Promise<string> {
  const config = twitchConfig();
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.TWITCH_CLIENT_ID,
      client_secret: config.TWITCH_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.TWITCH_REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    // The body can contain the client secret back in an error echo, so only the
    // status travels any further than this line.
    throw new Error(`twitch token exchange failed: ${response.status}`);
  }
  const body = (await response.json()) as { access_token?: unknown };
  if (typeof body.access_token !== 'string') {
    throw new Error('twitch token exchange returned no access_token');
  }
  return body.access_token;
}

/**
 * The signed-in user, and nothing else about them.
 *
 * The access token is used once, here, and then dropped: we have no reason to
 * hold a credential that lets us act as the streamer on Twitch, so we do not
 * store one (§4.1 in spirit — never hold what we cannot need).
 */
export async function signedInUser(code: string): Promise<TwitchUser> {
  const accessToken = await exchangeCode(code);
  const response = await fetch(USERS_URL, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      'client-id': twitchConfig().TWITCH_CLIENT_ID,
    },
  });
  if (!response.ok) {
    throw new Error(`twitch get users failed: ${response.status}`);
  }

  const body = (await response.json()) as {
    data?: Array<{ id?: unknown; login?: unknown; display_name?: unknown }>;
  };
  const user = body.data?.[0];
  if (!user || typeof user.id !== 'string' || typeof user.login !== 'string') {
    throw new Error('twitch get users returned no usable user');
  }

  return {
    id: user.id,
    login: user.login,
    displayName: typeof user.display_name === 'string' ? user.display_name : user.login,
  };
}
