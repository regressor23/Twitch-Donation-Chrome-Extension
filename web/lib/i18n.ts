/**
 * UI strings (CLAUDE.md §8): `uk` is the default, `en` is mandatory.
 *
 * No i18n framework. The whole need here is "two dictionaries and a lookup",
 * and a framework would bring a provider, a loader and a build step to solve a
 * problem we do not have. What it would buy — a missing translation being
 * caught — is bought instead by the type: `Dictionary` is
 * `Record<MessageKey, string>`, so a key added to `uk` and forgotten in `en`
 * fails `tsc` rather than shipping a blank label.
 *
 * Interpolation is `{name}` and nothing more. Anything that needs plurals or
 * dates goes through `Intl` at the call site, where the locale is known.
 */
export const locales = ['uk', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'uk';

const uk = {
  'common.appName': 'TipVault',
  'common.loading': 'Завантаження…',
  'common.copy': 'Копіювати',
  'common.copied': 'Скопійовано',
  'common.cancel': 'Скасувати',

  'signin.title': 'Вхід для стримерів',
  'signin.lead': 'Увійдіть через Twitch, щоб підключити гаманець і отримати посилання на оверлей.',
  'signin.button': 'Увійти через Twitch',
  'signin.scopes': 'Ми не читаємо чат, підписки чи пошту — лише ідентифікатор каналу.',
  'signin.error.cancelled': 'Вхід скасовано.',
  'signin.error.incomplete': 'Twitch повернув неповну відповідь. Спробуйте ще раз.',
  'signin.error.state': 'Не вдалося підтвердити, що вхід почали саме ви. Спробуйте ще раз.',
  'signin.error.twitch': 'Twitch не відповів. Спробуйте за хвилину.',

  'dashboard.title': 'Кабінет стримера',
  'dashboard.signedInAs': 'Ви увійшли як {login}',
  'dashboard.signOut': 'Вийти',
  'dashboard.noChannel': 'Канал ще не налаштований. Підключіть гаманець — і він зʼявиться тут.',

  'wallet.title': 'Гаманець для виплат',
  'wallet.lead': 'Тіпи йдуть напряму сюди. Ми ніколи не тримаємо ваші кошти.',
  'wallet.none': 'Гаманець не підключено',
  'wallet.connect': 'Підключити гаманець',
  'wallet.choose': 'Виберіть гаманець',
  'wallet.connecting': 'Чекаємо на гаманець…',
  'wallet.noWallets':
    'У браузері не знайдено гаманця. Встановіть Phantom або Solflare і оновіть сторінку.',
  'wallet.sign': 'Підтвердити підписом',
  'wallet.signing': 'Підпишіть повідомлення в гаманці…',
  'wallet.signHint': 'Підпис нічого не коштує і не надсилає транзакцію.',
  'wallet.verified': 'Підтверджено',
  'wallet.change': 'Змінити гаманець',

  // Keyed by the `code` the API returns, so a failure reads as a sentence in
  // the streamer's language instead of an English fragment from a route.
  'error.session': 'Сесія завершилась. Увійдіть через Twitch ще раз.',
  'error.address': 'Гаманець повернув адресу, якої ми не розпізнали.',
  'error.expired': 'Підтвердження застаріло. Спробуйте ще раз.',
  'error.mismatch': 'Підпис не збігається з адресою гаманця.',
  'error.declined': 'Підпис скасовано в гаманці.',
  'error.other': 'Щось пішло не так. Спробуйте ще раз.',

  'overlay.title': 'Оверлей для OBS',
  'overlay.lead': 'Додайте це посилання як Browser Source. Нікому його не показуйте.',
  'overlay.hidden': 'Посилання приховане',
  'overlay.reveal': 'Показати',
  'overlay.hide': 'Сховати',
  'overlay.rotate': 'Замінити посилання',
  'overlay.rotateWarning':
    'Старе посилання перестане працювати. Після заміни оновіть джерело в OBS.',
  'overlay.rotated': 'Посилання замінено. Оновіть Browser Source в OBS.',

  'tips.title': 'Останні тіпи',
  'tips.empty': 'Тіпів поки немає.',
  'tips.when': 'Коли',
  'tips.who': 'Від кого',
  'tips.amount': 'Сума',
  'tips.message': 'Повідомлення',
  'tips.status': 'Стан',
  'tips.status.seen': 'Записано',
  'tips.status.confirmed': 'У черзі',
  'tips.status.alerted': 'Показано',
  'tips.viewTx': 'Транзакція',
} as const;

export type MessageKey = keyof typeof uk;
export type Dictionary = Record<MessageKey, string>;

const en: Dictionary = {
  'common.appName': 'TipVault',
  'common.loading': 'Loading…',
  'common.copy': 'Copy',
  'common.copied': 'Copied',
  'common.cancel': 'Cancel',

  'signin.title': 'Streamer sign-in',
  'signin.lead': 'Sign in with Twitch to connect a wallet and get your overlay link.',
  'signin.button': 'Sign in with Twitch',
  'signin.scopes': 'We do not read your chat, subscribers or email — only your channel id.',
  'signin.error.cancelled': 'Sign-in cancelled.',
  'signin.error.incomplete': 'Twitch sent an incomplete response. Please try again.',
  'signin.error.state': 'We could not confirm this sign-in started here. Please try again.',
  'signin.error.twitch': 'Twitch did not answer. Try again in a minute.',

  'dashboard.title': 'Streamer dashboard',
  'dashboard.signedInAs': 'Signed in as {login}',
  'dashboard.signOut': 'Sign out',
  'dashboard.noChannel': 'No channel set up yet. Connect a wallet and it will appear here.',

  'wallet.title': 'Payout wallet',
  'wallet.lead': 'Tips go straight here. We never hold your funds.',
  'wallet.none': 'No wallet connected',
  'wallet.connect': 'Connect wallet',
  'wallet.choose': 'Choose a wallet',
  'wallet.connecting': 'Waiting for the wallet…',
  'wallet.noWallets': 'No wallet found in this browser. Install Phantom or Solflare and reload.',
  'wallet.sign': 'Confirm with a signature',
  'wallet.signing': 'Approve the message in your wallet…',
  'wallet.signHint': 'Signing is free and sends no transaction.',
  'wallet.verified': 'Confirmed',
  'wallet.change': 'Change wallet',

  'error.session': 'Your session ended. Sign in with Twitch again.',
  'error.address': 'The wallet returned an address we could not read.',
  'error.expired': 'The confirmation expired. Please try again.',
  'error.mismatch': 'The signature does not match the wallet address.',
  'error.declined': 'The signature was cancelled in the wallet.',
  'error.other': 'Something went wrong. Please try again.',

  'overlay.title': 'OBS overlay',
  'overlay.lead': 'Add this link as a Browser Source. Do not show it to anyone.',
  'overlay.hidden': 'Link hidden',
  'overlay.reveal': 'Reveal',
  'overlay.hide': 'Hide',
  'overlay.rotate': 'Replace link',
  'overlay.rotateWarning': 'The old link stops working. Update the source in OBS afterwards.',
  'overlay.rotated': 'Link replaced. Update the Browser Source in OBS.',

  'tips.title': 'Recent tips',
  'tips.empty': 'No tips yet.',
  'tips.when': 'When',
  'tips.who': 'From',
  'tips.amount': 'Amount',
  'tips.message': 'Message',
  'tips.status': 'State',
  'tips.status.seen': 'Recorded',
  'tips.status.confirmed': 'Queued',
  'tips.status.alerted': 'Shown',
  'tips.viewTx': 'Transaction',
};

const dictionaries: Record<Locale, Dictionary> = { uk, en };

export function dictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/**
 * Picks a locale from an `Accept-Language` header.
 *
 * Quality values are ignored on purpose: with two languages and `uk` as the
 * default, the only question worth asking is whether English appears before
 * Ukrainian.
 */
export function localeFrom(header: string | null | undefined): Locale {
  if (!header) {
    return defaultLocale;
  }
  for (const part of header.split(',')) {
    const tag = part.split(';')[0]?.trim().toLowerCase() ?? '';
    if (tag.startsWith('uk')) {
      return 'uk';
    }
    if (tag.startsWith('en')) {
      return 'en';
    }
  }
  return defaultLocale;
}

export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string>): string {
  const template = dictionary(locale)[key];
  if (!vars) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) => vars[name] ?? match);
}
