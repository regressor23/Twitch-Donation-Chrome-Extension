# TipVault — журнал етапів

Append-only. Старі записи не редагуються: помилку виправляє наступний запис.
Формат — `CLAUDE.md` §3. Статус `accepted` ставить тільки людина.

---

## S0 — Каркас репозиторію
- **status:** accepted
- **date:** 2026-09-18
- **scope_agreed:** pnpm-монорепо (`program/`, `web/`, `ext/`, `packages/shared/`, `docs/`) без бізнес-логіки; Next.js у `web/`, Vite+TS у `ext/`, Anchor-скелет у `program/`; зелені `pnpm test` і `pnpm lint`; `.env.example` за §5.5, `.gitignore`, `.worktreeinclude`; `docs/journal.md` з першим записом і `docs/evidence/`. Додатково погоджено в чаті перед стартом: перенести `plan-sequential.md` у `docs/`, додати CI-workflow під `regressor23/Twitch-Donation-Chrome-Extension`, скрипт `pnpm e2e` до S3 не додавати (варіант Б), маніфест з `storage` + `https://*.twitch.tv/*`.
- **commit:** e8ea793

### Зроблено
- pnpm-воркспейс на 5 проєктів (`tipvault` + 4 пакети), спільні `tsconfig.base.json`, один flat-config ESLint і один `vitest.config.ts` на весь монорепо.
- `web/` — Next.js 16 App Router з порожньою сторінкою; `ext/` — Vite-збірка MV3 service worker у `ext/dist` разом із маніфестом; `packages/shared` — порожній пакет з `export {}`; `program/` — Anchor-скелет (Cargo-воркспейс + `#[program] mod tip_vault` без інструкцій).
- Smoke-тест `tests/smoke.test.ts` перевіряє сам каркас, а не заглушку: імена 4 воркспейс-пакетів, повний список із 14 змінних `.env.example` у порядку §5.5, те що `.env` у `.gitignore` а `.env.example` — ні, і що в маніфесті рівно `permissions: ["storage"]` + `host_permissions: ["https://*.twitch.tv/*"]`. Будь-яке тихе розширення permissions або втрата env-змінної завалить `pnpm test`.
- Репозиторій ініціалізовано (`git init -b main`), `plan-sequential.md` переїхав у `docs/`, додано `.github/workflows/ci.yml` (install → lint → typecheck → test).
- pnpm встановлено глобально через `npm i -g pnpm@12.4.2`: `corepack enable` на цій машині падає з `EPERM` на `C:\Program Files\nodejs`, бо вимагає адміністратора.

### Змінені файли
- Корінь: `package.json` (32), `pnpm-workspace.yaml` (7), `tsconfig.base.json` (21), `eslint.config.mjs` (37), `vitest.config.ts` (14), `.prettierrc` (6), `.prettierignore` (12), `.gitignore` (40), `.env.example` (31), `.worktreeinclude` (5), `pnpm-lock.yaml` (2263, згенерований)
- `tests/smoke.test.ts` (63), `.github/workflows/ci.yml` (27)
- `packages/shared/`: `package.json` (14), `tsconfig.json` (4), `src/index.ts` (3)
- `web/`: `package.json` (20), `tsconfig.json` (14), `next.config.ts` (5), `app/layout.tsx` (14), `app/page.tsx` (3)
- `ext/`: `package.json` (15), `tsconfig.json` (8), `vite.config.ts` (22), `src/background.ts` (5), `public/manifest.json` (12)
- `program/`: `package.json` (6), `Cargo.toml` (13), `Anchor.toml` (19), `programs/tip_vault/Cargo.toml` (21), `programs/tip_vault/src/lib.rs` (10)
- `docs/`: `journal.md` (новий), `plan-sequential.md` (переїзд із кореня, вміст не змінений), `evidence/.gitkeep`, `evidence/S0-checks.txt` (97)

### Перевірка
Повний сирий вивід усіх команд: `docs/evidence/S0-checks.txt`.
- `pnpm install --frozen-lockfile` — exit 0, лок-файл консистентний
- `pnpm lint` — exit 0, 0 errors, 0 warnings
- `pnpm typecheck` — exit 0 у `web`, `ext`, `packages/shared` (у `program/` TS немає)
- `pnpm test` — **1 test file, 7 passed, 0 failed**, 126 ms. `--passWithNoTests` не використовується
- `pnpm --filter @tipvault/ext build` — exit 0, `ext/dist/background.js` + `ext/dist/manifest.json`
- `pnpm --filter @tipvault/web build` — exit 0, 2 статичні роути
- `pnpm format:check` — exit 0
- Окремо перевірено, що `pnpm typecheck` у `web/` проходить на чистому дереві без `.next/` і без `next-env.d.ts` (симуляція свіжого клону) — інакше CI падав би на першому ж запуску

### Як перевірити руками
1. `git log --oneline` — рівно один коміт, `git status` — чисто.
2. `pnpm install` → `pnpm lint` → `pnpm test`. Очікувано: 7 passed, 0 failed, лінт без зауважень.
3. `pnpm dev:web`, відкрити http://localhost:3000 — має бути біла сторінка зі словом `TipVault`.
4. `pnpm --filter @tipvault/ext build`, далі `chrome://extensions` → Developer mode → Load unpacked → вибрати `ext/dist`. Розширення має завантажитись без помилок; у картці permissions — тільки Storage і доступ до `twitch.tv`.
5. Відкрити `.env.example` і звірити: 14 змінних, усі порожні, жодного значення.
6. Відкрити `docs/evidence/S0-checks.txt` і звірити числа з блоком «Перевірка» вище.

### Не зроблено / свідомо відкладено
- **`anchor build` не запускався.** Rust, Solana CLI та Anchor на машині відсутні (видно в логу перевірок: `rustc: command not found`, `anchor: command not found`). `program/` сьогодні — це файли, які ніхто не компілював. Версія `anchor-lang = "1.2.0"`, набір features і `declare_id` узяті зі стандартного шаблона і будуть звірені та виправлені в S2.
- `pnpm e2e` не додано (погоджений варіант Б) — зʼявиться разом з Playwright у S3. Тому перед здачею цього етапу прогнав `pnpm lint && pnpm test`, без третьої команди з §6.
- `eslint-config-next` не ставив: у `web/` ще немає компонентів, зайвий набір плагінів — це ризик зламаного лінта на порожньому місці. Додамо, коли зʼявиться реальний UI.
- `git push` не робив: `origin` додано, але перший push у публічний репозиторій — окреме рішення людини.
- `packages/shared` лишився порожнім навмисно: memo-кодек, типи і networks — це S1 і §2 (зміни в shared потребують окремого погодження).

### Ризики й відкриті питання
- **TypeScript зафіксований на 5.9.3, не 7.0.2.** `typescript-eslint@8.70` має peer `typescript <6.1.0`, тобто TS 7 зламав би `pnpm lint`. Повернемось до оновлення, коли вийде сумісна версія typescript-eslint.
- **pnpm 12 сам дописав** у `pnpm-workspace.yaml` блок `minimumReleaseAgeExclude: prettier@3.9.8` — це його політика карантину свіжих релізів. Правка не моя, але вона потрапляє в коміт; якщо не подобається — прибираємо разом з `prettier`.
- **CI жодного разу не запускався**, бо коміт локальний. Версії екшенів (`checkout@v7`, `setup-node@v7`, `pnpm/action-setup@v6`) звірені з GitHub сьогодні, але перший реальний прогін буде тільки після push.
- `next-env.d.ts` у `.gitignore` (як у шаблоні Next). Перевірено, що без нього typecheck проходить.
- Anchor на Windows реально збирається через WSL — це вилізе в «S1.5: тулчейн».
- **Кінці рядків.** У git глобально `core.autocrlf=true`, файли в репо лежать з LF, але на свіжому клоні під Windows вони розгорнуться в CRLF і `pnpm format:check` (prettier `endOfLine: lf`) впаде. Лікується одним рядком у `.gitattributes` (`* text=auto eol=lf`), але це поза погодженим обсягом S0 — не робив, питаю окремо.

### Пропозиція на наступний етап
- S1 `packages/shared` (memo-кодек + фазз-тести, типи, networks) за планом, орієнтовно 0.5–1 день.
- Перед S2 — короткий окремий крок «S1.5: тулчейн»: Rust + Solana CLI + Anchor (імовірно WSL), гейт = `anchor build` на цьому скелеті проходить. Без нього S2 не почати.

### Доповнення після здачі (2026-09-18)
Запис вище не переписую, дописую нижче — обидва відкриті питання закриті твоїм рішенням у чаті.
- **`.gitattributes` додано** (`* text=auto eol=lf` + правила для бінарників). `git add --renormalize .` не змінив жодного файлу — вміст уже був LF, тож ризик CRLF закритий на майбутнє, без переписування історії. Коміт етапу заамендено, бо на той момент нічого ще не було запушено; коміт як був один, так і лишився.
- **Запушено в `origin`** (`git push -u origin main`), CI запустився вперше. Результат першого прогону впишу сюди при прийнятті етапу.
- **Знайдено на машині рецензента (не в коді):** у Windows PowerShell 5.1 оператор `&&` не підтримується, і `pnpm` не запускається — `pnpm.ps1 cannot be loaded because running scripts is disabled` (ExecutionPolicy). Обхід без зміни налаштувань: викликати `pnpm.cmd` замість `pnpm`. Саму ExecutionPolicy не чіпав — це системна безпекова настройка, змінює її тільки людина.

### Прийнято
- **accepted_by:** Олексій, 2026-09-18, у чаті після ручної перевірки: `pnpm.cmd install; pnpm.cmd lint; pnpm.cmd test` — 7 passed, 0 failed; `pnpm.cmd dev:web` — `GET / 200 in 791ms`; `git log` — `e8ea793 (HEAD -> main, origin/main)`, `git status` чистий.
- **CI:** перший прогін на `e8ea793` зелений, 27 с — `install --frozen-lockfile` → `lint` → `typecheck` → `test`, на Linux теж `Tests 7 passed (7)`. Прогін: https://github.com/regressor23/Twitch-Donation-Chrome-Extension/actions/runs/35387012761, повний лог — `docs/evidence/S0-ci-run.txt`.
- Шум `ObjectMultiplex - orphaned data for stream "metamask-multichain-provider"` у виводі `next dev` — це лог MetaMask з Firefox-профілю рецензента, який Next 16 пересилає в термінал. До коду проєкту стосунку не має.

---

## S1 — packages/shared: memo-кодек, типи, networks
- **status:** ready_for_review
- **date:** 2026-09-18
- **scope_agreed:** `memo.ts` (encode/decode за §5.1), `types.ts` (`Tip`, `Channel`, `ResolveResponse`, `AlertEvent`, статуси `seen|confirmed|alerted`), `networks.ts` (мінти USDC mainnet/devnet, пресети, мінімальний тіп, program id-заглушка), юніт- і фазз-тести на кодек. Погоджено в чаті перед стартом: `fast-check` як dev-залежність; ліміти = 24/180 графем **і** 300 байт на все memo; `decode` поблажливий до перевищення лімітів (клампить, не віддає `null`); wire-DTO із сумами десятковими рядками замість `bigint`.
- **commit:** `S1: packages/shared — memo-кодек, типи, networks` — єдиний коміт етапу. Точний хеш вписую при прийнятті, як і в S0.

### Зроблено
- Кодек `tv1|<channel_id>|<nick>|<message>` з одним спільним санітайзером на обидва напрямки: що `encodeMemo` не кладе в ланцюг, те `decodeMemo` не віддає в UI. Викидаються роздільник, C0/C1-контрольні, ZWSP, самотні сурогати й bidi-оверрайди (`U+202A–202E`, `U+2066–2069`) — останні саме тому, що цей текст рендериться на оверлеї стримера. ZWJ і variation selectors збережені, інакше складені емодзі розсипаються.
- Обрізання по графемних кластерах через `Intl.Segmenter` з бюджетом у UTF-8 байтах: спершу ліміт 24/180 графем, потім жорсткий стель 300 байт, де нік тримає своє місце, а решту бюджету забирає повідомлення. Жодна графема не ріжеться навпіл.
- `decodeMemo` — тотальна функція: приймає `string` і `Uint8Array` (memo з ланцюга — це байти), на невалідному UTF-8 і самотніх сурогатах віддає `null`, на незнайомій версії (`tv2`, `TV1`, чужий протокол) — теж `null`, і не кидає виняток ні на чому.
- `types.ts`: доменні суми — `bigint` у мінорних юнітах, wire-DTO — десяткові рядки, бо `JSON.stringify(1n)` кидає, а «полагодити» це зазвичай пробують через `Number()`, що й губить копійки. Конвертери `toU64String`/`fromU64String` валідують діапазон u64 і канонічність рядка.
- `networks.ts`: обидва мінти звірені з мережею перед тим, як їх вписати (деталі в «Перевірка»), program id — та сама заглушка, що в `program/`, з коментарем про заміну в S2.

### Змінені файли
- `packages/shared/src/memo.ts` (новий, 212 рядків)
- `packages/shared/src/types.ts` (новий, 96)
- `packages/shared/src/networks.ts` (новий, 37)
- `packages/shared/src/index.ts` (був `export {}`, тепер barrel, 4)
- `packages/shared/src/memo.test.ts` (новий, 219)
- `packages/shared/src/memo.fuzz.test.ts` (новий, 178)
- `packages/shared/src/networks.test.ts` (новий, 60)
- `packages/shared/src/types.test.ts` (новий, 47)
- `packages/shared/package.json` (+`fast-check` у devDependencies), `pnpm-lock.yaml`
- `ext/public/manifest.json` — **зміни вмісту немає**, тільки CRLF→LF (див. «Ризики»)
- `docs/evidence/S1-checks.txt` (новий, 265)

### Перевірка
Сирий вивід усіх команд: `docs/evidence/S1-checks.txt`.
- `pnpm test` — **95 passed, 0 failed**: smoke 7, `memo.test` 56, `memo.fuzz` 10, `networks.test` 9, `types.test` 13
- Фазз: 11 property-тверджень по 500 прогонів кожне — приблизно 5 500 згенерованих кейсів за запуск. Генератори: `fc.string({unit:'grapheme'})` (емодзі-послідовності, комбіновані знаки, RTL, CJK), `fc.string({unit:'binary'})`, `fc.uint8Array()` і окремо memo-подібне сміття, щоб гілки парсера реально відвідувались
- `pnpm lint` — exit 0; `pnpm typecheck` — exit 0 у трьох пакетах; `pnpm format:check` — exit 0
- **Мутаційна перевірка** (тести не декоративні): (1) обрізання по code points замість графем → 3 падіння, fast-check зменшив контрприклад до `["👩‍👩‍👧", 17, "1"]`; (2) парсер приймає будь-яку версію → 4 падіння. Після відкату sha256 `memo.ts` збігається з початковим і контрольний прогін знову 95 passed — обидва хеші в артефакті
- **Гейт «типи імпортуються»**: тимчасово підключив `@tipvault/shared` до `web` і `ext`, написав пробний файл з реальними імпортами (`encodeMemo`, `TIP_PRESETS`, `ResolveResponse`, `AlertEvent`, `TipStatus`) — `pnpm typecheck` зелений в обох. Негативний контроль: імпорт неіснуючого символу дав `TS2305`, тобто перевірка справді читала файл, а не проходила повз. Обвʼязку і пробні файли **відкотив**, у коміт вони не входять
- **Константи звірені з першоджерелами, не з памʼяті:** `getAccountInfo` на mainnet і devnet — обидва SPL Token mint з `decimals: 6`; Jupiter token API для mainnet — `symbol: USDC`, `name: USD Coin`, `isVerified: true`; devnet-адреса — з документації Circle «USDC on testing networks» (сторінка віддається тільки через пошук, прямий fetch блокується 403/404)

### Як перевірити руками
1. `pnpm.cmd test` — очікувано `95 passed`.
2. Зламати навмисно: у `packages/shared/src/memo.ts` у функції `toGraphemes` замінити тіло на `return Array.from(value);` і знову запустити `pnpm.cmd test` — мають впасти рівно тести про графеми. Повернути через `git checkout -- packages/shared/src/memo.ts`.
3. Відкрити `packages/shared/src/memo.test.ts` і переглянути таблиці `decodeMemo — rejects`: там усі шість кейсів із твого списку (порожній рядок, самі роздільники, `|` у ніку, невалідний UTF-8, чужий протокол, `tv2`).
4. Звірити числа з `docs/evidence/S1-checks.txt` — там і мутаційні прогони, і два sha256.

### Не зроблено / свідомо відкладено
- `buildTipTx` — S5, як і домовлялись.
- Жодного мережевого виклику в коді пакета немає: звірка мінтів робилась мною вручну через `curl`, у бандл нічого з цього не потрапляє.
- `@tipvault/shared` **не** підключений постійно до `web` і `ext` — за умовою етапу «жодного коду поза `packages/shared`». Постійна обвʼязка — один рядок у двох `package.json`, зроблю в S3, коли зʼявиться перший справжній імпорт.
- `MEMO_PROGRAM_ID` (SPL Memo) свідомо не додавав: не було в обсязі, потрібен буде в S5 разом із `buildTipTx`.
- Фолбек `toGraphemes` на code points (коли немає `Intl.Segmenter`) тестами не покритий — на наших рантаймах (Node 24, Chrome MV3) ця гілка недосяжна.

### Ризики й відкриті питання
- **Поблажливість `decode` — це політика, а не технічна дрібниця.** Memo від чужого tv1-клієнта з зайвими `|` склеюється в повідомлення, а завеликий нік обрізається замість `null`. Логіка: тіп уже оплачений транзакцією, ковтати його через зайвий байт гірше. Якщо на пілоті побачимо зловживання — робимо строгий режим, це один рядок.
- **CRLF-інцидент, який я прогнозував у S0.** `ext/public/manifest.json` отримав CRLF ще в S0 від `git checkout` під час мутаційної перевірки, коли `.gitattributes` ще не існувало, і саме на ньому впав `pnpm format:check`. Нормалізував назад у LF; git показує файл як змінений, але `git diff` порожній — вміст не чіпався. Тепер `.gitattributes` не дасть цьому повторитись.
- `no-control-regex` довелось глушити в `memo.ts` блоковою директивою з поясненням: правило чесно ловить контрольні символи в регулярці, а ми їх туди кладемо навмисно, бо саме їх і вирізаємо.
- У тестах усі невидимі символи записані екрануванням `\u{...}`; літеральних контрольних символів у джерелах немає — перевіряється `grep`-скануванням, яке я прогнав перед комітом.
- `TIP_VAULT_PROGRAM_ID` лишається заглушкою до S2.

### Пропозиція на наступний етап
- Перед S2 — короткий крок «S1.5: тулчейн» (Rust + Solana CLI + Anchor, імовірно WSL), гейт: `anchor build` на скелеті з S0 проходить. Без нього S2 не почати.
- Далі S2 за планом: `tip_direct`, `tip_escrow`, `claim`, `refund_expired`, деплой на devnet, реальний program id замість заглушки в `networks.ts` (це буде зміна в `packages/shared`, тобто окреме погодження за §2).
