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
- **status:** accepted
- **date:** 2026-09-18
- **scope_agreed:** `memo.ts` (encode/decode за §5.1), `types.ts` (`Tip`, `Channel`, `ResolveResponse`, `AlertEvent`, статуси `seen|confirmed|alerted`), `networks.ts` (мінти USDC mainnet/devnet, пресети, мінімальний тіп, program id-заглушка), юніт- і фазз-тести на кодек. Погоджено в чаті перед стартом: `fast-check` як dev-залежність; ліміти = 24/180 графем **і** 300 байт на все memo; `decode` поблажливий до перевищення лімітів (клампить, не віддає `null`); wire-DTO із сумами десятковими рядками замість `bigint`.
- **commit:** 86543fd

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

### Прийнято
- **accepted_by:** Олексій, 2026-09-19, у чаті.
- **CI:** прогін на `86543fd` зелений — install → lint → typecheck → test, на Linux теж `95 passed (95)`: https://github.com/regressor23/Twitch-Donation-Chrome-Extension/actions/runs/35389410191

---

## S1.5 — Тулчейн для Anchor (WSL2)
- **status:** accepted
- **date:** 2026-09-18
- **scope_agreed:** WSL2 + Ubuntu, у ньому Rust / Solana CLI / Anchor / Node+pnpm; правки в `program/Cargo.toml`, `program/Anchor.toml` (і `lib.rs`, якщо без них не збирається) до стану, коли `anchor build` на скелеті S0 проходить. Бізнес-логіки контракту не пишемо, `declare_id` не міняємо — це S2.
- **commit:** 9371103

### Зроблено
- Діагностика того, чому «вікно Ubuntu не відкрилось»: WSL-платформа була встановлена й робоча (2.7.14, ядро 6.18, віртуалізація увімкнена), але **жодного дистрибутива не було** — `wsl --install` підняв компоненти, а дистрибутив не доїхав. Поставив `Ubuntu-24.04` (свідомо не 26.04: solana platform-tools постачаються бінарниками під старішу glibc).
- Тулчейн у WSL, увесь у user-space: `rustc/cargo 1.98.1`, `clippy 0.1.98`, `rustfmt 1.9.0`, `solana-cli 4.2.2 (Agave)`, `anchor-cli 1.2.0`, `node 24.16.0`, `pnpm 12.4.2`, `solana-test-validator 4.2.2`. Anchor поставлено готовим бінарником з релізу, а не через `avm` — економить 10–20 хвилин компіляції CLI з джерел.
- **Ключова знахідка:** `anchor build` падав на `llvm-objcopy: 'target/deploy/tip_vault.so': Operation not permitted`. Причина — диск `D:` монтується в WSL без метаданих, тож права на файл виставити неможливо. Лікується `[automount] options = "metadata,umask=022,fmask=011"` у `/etc/wsl.conf`; репозиторій лишається одним деревом на `D:`, другої копії всередині Linux немає.
- Скелет доведено до чистої збірки: у `Cargo.toml` додані `check-cfg` для трьох anchor-івських фіч і `target_os = "solana"` (без них 3 попередження на кожну збірку і 2 на кожен clippy), з `Anchor.toml` прибрана секція `[registry]`, яку Anchor 1.x ігнорує з попередженням, і зафіксовано `package_manager = "pnpm"`. `lib.rs` не чіпав — порожній `#[program] mod` компілюється як є.
- Локальний ключ для збірок: `solana config` переведено на devnet, кейпара згенерована з `--silent`, щоб seed-фраза не потрапила ні в транскрипт, ні в лог. Баланс 0 SOL, нічого не фінансувалось.

### Змінені файли
- `program/programs/tip_vault/Cargo.toml` (+8 рядків: секція `[lints.rust]`)
- `program/Anchor.toml` (−`[registry]`, +`package_manager = "pnpm"`)
- `program/Cargo.lock` (новий, 2 190 рядків, згенерований) — комітимо навмисно: програма, яка піде в mainnet, має збиратись відтворювано
- `docs/evidence/S1.5-toolchain.txt` (новий) — сирий вивід версій, clippy, обох збірок і замірів
- Поза репозиторієм (стан машини, не код): дистрибутив `Ubuntu-24.04`, користувач `oleksii` без пароля, `/etc/wsl.conf`

### Перевірка
- `anchor build` — **exit 0**, холодна збірка після `cargo clean` 63 с, артефакти: `target/deploy/tip_vault.so` 49 856 байт, `target/idl/tip_vault.json` 346 байт
- `cargo clippy --all-targets` — **exit 0, 0 попереджень** (у файлі `grep -c "^warning|^error"` дає 0)
- Версії — сирим виводом у `docs/evidence/S1.5-toolchain.txt`
- Замір, де тримати `target/`: на `/mnt/d` повторна збірка без змін — **38 с**, на ext4 через `CARGO_TARGET_DIR` — 51 с холодна і далі **0 с**. `.so` однаковий, `anchor` знаходить артефакти в обох випадках

### Як перевірити руками
1. `wsl -d Ubuntu-24.04` — має відкритись Ubuntu під користувачем `oleksii` (пароля немає, він і не питається).
2. Усередині: `cd "/mnt/d/Twitch Donation Chrome Extension/program"`, далі `anchor build` — очікувано `exit 0` без жодного попередження.
3. `anchor --version` → `anchor-cli 1.2.0`, `solana --version` → `4.2.2`, `cargo --version` → `1.98.1`.
4. `ls -la target/deploy` — має бути `tip_vault.so` ~49 КБ.
5. Якщо захочеш `sudo` всередині WSL — пароля в користувача немає, постав його разом: `wsl -d Ubuntu-24.04 -u root -- passwd oleksii`. Я паролів не встановлюю.

### Не зроблено / свідомо відкладено
- `avm` не ставив: Anchor стоїть фіксованим бінарником 1.2.0. Якщо в S2 доведеться перемикати версії — поставимо тоді.
- `CARGO_TARGET_DIR` нікуди не зашивав. Прописати шлях `/home/oleksii/...` у репозиторій не можна (зламається в іншого й у CI), а робити це «заодно» — поза обсягом етапу. Рішення на початок S2.
- `declare_id` лишається плейсхолдером, `packages/shared` не чіпав.
- CI не вчив збирати Anchor: Rust-крок додасть 5–10 хвилин до кожного прогону, це окреме рішення.
- Пароль користувача WSL не встановлював — це робить людина.

### Ризики й відкриті питання
- **Ключ програми зараз нестабільний.** `target/` у `.gitignore`, тож `target/deploy/tip_vault-keypair.json` губиться на кожному `cargo clean`, і program id щоразу інший — за цей етап я бачив `7UDM7ui…` і `CxJSXBco…`. Перше, що робимо в S2: генеруємо постійну кейпару програми і вирішуємо, де вона живе. У git її класти не можна, а втратити = втратити upgrade authority над задеплоєною програмою.
- **Anchor 1.2.0 — свіжа мажорна гілка** (реліз 04.09.2026), тоді як 90% прикладів у мережі під 0.3x. Якщо в S2 впремось у розбіжності API — відкат на 0.32.2 можливий, але приймати це рішення будемо з конкретною помилкою в руках, а не наперед.
- 38 с на кожну порожню перезбірку, якщо лишити `target/` на `/mnt/d`.
- Тепер `/mnt/d` монтується з `metadata`, тобто права файлів стали «справжніми». Якщо git раптом почне показувати зміни режимів — причина звідси.

### Пропозиція на наступний етап
- S2 відкриваємо двома рішеннями на одну репліку: (1) куди кладемо `target/` (пропоную ext4 через обгортку-скрипт у репозиторії, щоб шлях не був зашитий); (2) де живе постійна кейпара програми.
- Далі S2 за планом: `tip_direct`, `tip_escrow`, `claim`, `refund_expired`, тести на localnet, деплой на devnet, і аж тоді реальний program id у `packages/shared` (це зміна в shared → окреме погодження за §2).

### Прийнято
- **accepted_by:** Олексій, 2026-09-19, у чаті.
- **CI:** прогін на `9371103` зелений: https://github.com/regressor23/Twitch-Donation-Chrome-Extension/actions/runs/35399046783. Важливо розуміти межі цього доказу: Anchor у CI свідомо не збирається, тож прогін підтверджує тільки JS-частину. Єдиний доказ того, що контракт збирається, — `docs/evidence/S1.5-toolchain.txt`, знятий локально в WSL.

---

## S2 — Anchor-програма `tip_vault`
- **status:** accepted (блокер — відсутній деплой — знято в S2b, коміт `9403c80`)
- **date:** 2026-09-19
- **scope_agreed:** переїзд репозиторію в `~/code/tipvault` (WSL ext4) і кейпари в `program/keys/`; інструкції `tip_direct`, `tip_escrow`, `claim`, `refund_expired`; помилки `ExpiredEscrow`, `NotExpiredYet`, `BadAttestation`, `AmountTooSmall` плюс погоджені `MemoTooLong` і `AttestationExpired`; тести на localnet (5 сценаріїв attestation + подвійний клейм, рефанд до/після, мінімум, створення ATA, переповнення); деплой на devnet; program id у `packages/shared` і `Anchor.toml`. Додатково погоджено: `claim` із явними записами тіпів замість зливання балансу, PDA `EscrowTip` і `UsedNonce` понад §5.2, залежності `anchor-spl` + TS-клієнти, `AUTHORITY_PUBKEY` константою, тест переповнення Rust-юнітом.
- **commit:** `8eca407`

### Зроблено
- **Переїзд.** Репозиторій клоновано з GitHub у `~/code/tipvault` на ext4; `/mnt/d` для збірки більше не використовується, дерево на `D:` не чіпалось. Виграш заміряний: повторна `anchor build` без змін — 0 с проти 38 с на 9p.
- **Ключі.** `program/keys/` у `.gitignore`, дві кейпари: програми (`J6uAbWr2…`) і attestation-authority (`BbEu1A9q…`). Обидві згенеровані з `--silent`, seed-фрази не виводились; бекап підтверджено перед написанням коду.
- **Програма.** Чотири інструкції, вісім помилок, три акаунти (`Vault`, `EscrowTip`, `UsedNonce`), дві події. Ескроу тримає PDA-власник токен-акаунта, програма ніколи не має ключа, яким можна витратити чужі кошти. Уся арифметика сум — через `checked_add`/`checked_sub` у двох методах `Vault`, які й покриті юніт-тестами.
- **Attestation.** Підписується `tv-домен || program_id || channel_id || recipient || nonce || expires_at`. Program id у повідомленні означає, що підпис для одного деплою не переноситься на інший. Підпис перевіряє нативна ed25519-програма, а `tip_vault` інтроспектить sysvar `instructions` і доводить, що підписано саме цей клейм: рівно один підпис, ключ дорівнює константі authority, повідомлення побайтово дорівнює зібраному самою програмою, і **всі offset-и вказують усередину самої ed25519-інструкції** — інакше валідний підпис над чужим повідомленням можна було б підсунути, бо нативна програма читає байти там, куди показують індекси.
- **Клейм бере записи тіпів явно** (`remaining_accounts`), кожен перевіряється на канал, неврегульованість і непротермінованість. Це прибирає гонку, в якій стример забирав би тіп, що вже мав піти на рефанд донору.

### Змінені файли
- `program/programs/tip_vault/src/lib.rs` (програма, 53), `constants.rs` (новий, 34), `errors.rs` (новий, 21), `state.rs` (новий, 121 з юніт-тестами), `attestation.rs` (новий, 121)
- `program/programs/tip_vault/src/instructions/`: `mod.rs` (13), `tip_direct.rs` (70), `tip_escrow.rs` (106), `claim.rs` (187), `refund_expired.rs` (85) — усі нові
- `program/programs/tip_vault/Cargo.toml` (+`anchor-spl`, +`solana-instructions-sysvar`, фіча `init-if-needed`, `idl-build` для anchor-spl)
- `program/Anchor.toml` (реальний program id для localnet і devnet, `[scripts] test` → vitest)
- `program/tests/helpers.ts` (новий, 211), `program/tests/tip_vault.test.ts` (новий, 474), `program/vitest.config.ts` (новий, 22), `program/tsconfig.json` (новий), `program/package.json` (TS-клієнти)
- `packages/shared/src/networks.ts` (program id замість плейсхолдера), `networks.test.ts` (+тест, що плейсхолдера більше немає)
- `.gitignore` (`program/keypairs/` → `program/keys/`), `pnpm-lock.yaml`
- `docs/evidence/S2-checks.txt` (новий) — сирий вивід усього нижчепереліченого

### Перевірка
Повний лог: `docs/evidence/S2-checks.txt`.
- `cargo test --lib` — **5 passed** (переповнення й антипереповнення сум ескроу, включно з точною межею `u64::MAX`)
- `cargo clippy --all-targets` — **exit 0, нуль попереджень** (у крейті `#![deny(clippy::all)]`)
- `anchor build` — exit 0, `tip_vault.so` **241 808 байт**
- `anchor test --skip-local-validator` на свіжому валідаторі — **17 passed, 0 failed**: 3 сценарії `tip_direct`, 3 `tip_escrow`, 8 `claim` (усі пʼять твоїх сценаріїв attestation + подвійний клейм + клейм протермінованого), 3 `refund_expired`
- Корінь: `pnpm lint`, `pnpm typecheck`, `pnpm format:check` — exit 0; `pnpm test` — **96 passed** (тести програми свідомо не входять у кореневий прогін, бо вимагають валідатора)
- Program id збігається у чотирьох місцях: кейпара, `declare_id!`, `Anchor.toml`, `packages/shared`. Authority-ключ збігається з константою в програмі. Обидві перевірки — у логу.
- **Мутаційна матриця.** Чотири зломи, кожен з перезбіркою, редеплоєм і повним прогоном:

| Зламано | Результат |
|---|---|
| порівняння повідомлення в attestation | падають рівно 2 тести (чужий канал, підмінений отримувач) |
| перевірка ключа authority | падає рівно 1 (підпис невірним ключем) |
| перевірка, що offset-и вказують усередину ed25519-інструкції | **17/17 проходять — жоден тест цього не ловить** |
| перевірка протермінованості тіпа в `claim` | падає рівно 1 (клейм протермінованого) |

Контрольний прогін після відкату — знову 17/17.

### Як перевірити руками
1. `wsl -d Ubuntu-24.04`, далі `cd ~/code/tipvault/program`.
2. `cargo test --lib` — 5 passed. `cargo clippy --all-targets` — тиша.
3. Підняти валідатор і прогнати повний набір:
   `solana-test-validator --ledger /tmp/l --reset --quiet &`
   `solana --url http://127.0.0.1:8899 airdrop 500 $(solana-keygen pubkey ~/.config/solana/id.json)`
   `anchor test --skip-local-validator` — очікувано 17 passed.
4. Зламати навмисно: у `programs/tip_vault/src/attestation.rs` прибрати `require!` з порівнянням `expected_message`, повторити п.3 — мають впасти рівно два тести про чужий канал і підміненого отримувача. Повернути через `git checkout`.
5. Звірити числа з `docs/evidence/S2-checks.txt`.

### Не зроблено / свідомо відкладено
- **ДЕПЛОЙ НА DEVNET НЕ ЗРОБЛЕНО.** Гаманець `3vJKgump81K91cGG4jXiB4aEQ73QSxouYMshNURvurR2` має 0 SOL, публічний фаусет відмовляє: `airdrop request failed. This can happen when the rate limit is reached` — пʼять спроб різними сумами, усі в логу. Програма важить 241 808 байт, рента — **1.229 SOL**. Це єдина причина статусу `blocked`.
- `TIP_VAULT_PROGRAM_ID` у `packages/shared` уже вписаний: адреса визначається кейпарою, а не фактом деплою, і після деплою вона буде саме такою. Але **на ланцюзі програми зараз немає**, і в цьому місці журналу це сказано прямо.
- **Тест на підміну offset-ів в ed25519-інструкції не написаний.** Захист у коді є, мутаційна матриця показує, що його ніщо не перевіряє. Сценарій потребує вручну зібраної ed25519-інструкції, де `message_instruction_index` вказує на іншу інструкцію транзакції, а в даних самої ed25519-інструкції за тим самим offset лежать «правильні» байти. Це поза списком із пʼяти тестів, які ти задав, тому я його не додавав самовільно — але вважаю, що він потрібен.
- `avm` не ставив, `surfpool` теж: `anchor test` у 1.x за замовчуванням піднімає `surfpool`, ми ходимо через `--skip-local-validator` і власний `solana-test-validator`.

### Ризики й відкриті питання
- **Непокрита перевірка offset-ів** — головний ризик етапу, див. вище.
- **TS-клієнт `@coral-xyz/anchor` 0.32.1 проти програми на Anchor 1.2.0.** Під 1.x клієнта в npm не опублікували; працює, бо IDL має той самий `spec: "0.1.0"`. Але це розбіжність версій, і на ній може щось вилізти в S3–S5.
- **Ключ attestation потрібен для локальних тестів**, а він у `.gitignore`. На іншій машині або в CI набір не запуститься без файлу з бекапу; тест кидає зрозумілу помилку з поясненням, а не падає загадково.
- `MIN_TIP_AMOUNT = 1_000_000` — мінорні юніти без прив'язки до конкретного мінта. З мінтом іншої розрядності «мінімум $1» означатиме інше. Для USDC (6 знаків) коректно; якщо колись зʼявиться другий мінт — треба перевіряти mint у програмі.
- Розмір `.so` 241 КБ: на devnet це 1.23 SOL, на mainnet — реальні гроші за кожен деплой і апгрейд.
- `init_if_needed` увімкнено заради лінивого створення vault і ATA. Повторна ініціалізація безпечна, бо жодне поле не скидається в обробнику, а seeds прив'язані до `channel_id`.

### Пропозиція на наступний етап
- Розбити етап: **S2a** — програма, тести й мутаційна матриця (готове, здаю на перевірку); **S2b** — деплой на devnet, звірка program id на ланцюзі та посилання на explorer, щойно на гаманці зʼявиться ~1.5 SOL. Найшвидший шлях: ти кидаєш devnet-SOL на `3vJKgump81K91cGG4jXiB4aEQ73QSxouYMshNURvurR2` з будь-якого свого гаманця або через `faucet.solana.com`, і S2b закривається за десять хвилин.
- Перед S3 — один тест на підміну offset-ів, орієнтовно година.

---

## S2a — Тест на підміну offset-ів в ed25519-інструкції
- **status:** accepted
- **date:** 2026-09-19
- **scope_agreed:** за рішенням рецензента S2 розбито на S2a (програма, тести, мутаційна матриця) і S2b (деплой на devnet, звірка program id на ланцюзі, посилання на explorer). Окремо погоджено один тест поза початковим списком із пʼяти — підміна offset-ів в ed25519-інструкції.
- **commit:** `353d492`

### Зроблено
- **Закрито єдину діру мутаційної матриці S2.** Тест `refuses an attestation whose message lives in another instruction` відтворює атаку повністю, а не імітує її. Транзакція складається з трьох інструкцій: підроблена ed25519, `claim`, і «носій». Носій стоїть **після** `claim` — програма його навіть не переглядає, бо цикл перевірки йде тільки по інструкціях перед поточною, — і несе справжнє повідомлення, яке authority дійсно підписав: атестацію для іншого каналу. Підроблена ed25519-інструкція віддає нативній програмі цей справжній підпис і вказує `message_instruction_index = 2`, тобто «текст бери з носія», а у власних даних за тим самим зсувом 112 тримає те повідомлення, яке `tip_vault` збирає сам. Нативна програма звіряє підпис зі справжнім текстом і каже «ок»; програма без перевірки індексів читає підкладені байти й теж каже «ок».
- **Підпис у тесті не підроблений.** Він витягується з нормально зібраної `Ed25519Program.createInstructionWithPrivateKey` (байти 48..112) — це справжній підпис справжнього ключа authority, рівно як було б у реальній атаці. Тест не має жодного способу підробити підпис і не намагається.
- **Хелпери** `ed25519WithBorrowedMessage` і `ed25519SignatureOf` збирають інструкцію побайтово за розкладкою web3.js: заголовок 2 байти, offsets 14, публічний ключ на 16, підпис на 48, повідомлення на 112.
- **Рефакторинг:** збірка інструкції `claim` винесена з `claim()` в окрему `claimInstruction()`, щоб сценарій міг скласти транзакцію руками. Решта тестів не змінювалась.
- **Заміряно поведінку деплою на адресу з балансом** — знадобилось через помилку з фаусетом, див. «Не зроблено».

### Змінені файли
- `program/tests/helpers.ts` (+60)
- `program/tests/tip_vault.test.ts` (+102 −14)
- `docs/evidence/S2a-checks.txt` (новий, 137 рядків до дописування) — сирий лог усіх прогонів нижче

### Перевірка
Повний лог: `docs/evidence/S2a-checks.txt`.
- `anchor test --skip-local-validator` — **18 passed, 0 failed** (було 17).
- Прогін виконано **на вже використаному леджері, без `--reset`**: набір лишається повторюваним. Це та сама вимога, через яку в S2 зʼявився `RUN_SEED`.
- **Мутація.** Прибрано `require!`, що вимагає `signature_ix_index == pubkey_ix_index == message_ix_index == u16::MAX`:

| Зламано | Результат |
|---|---|
| перевірка індексів інструкцій в offset-ах | **падає рівно 1 тест — новий** |

  Формулювання падіння важливіше за сам факт: `expected the transaction to fail with BadAttestation, but it succeeded`. Тобто без цієї перевірки транзакція **проходить**, і escrow каналу, за який authority нічого не підписував, їде на гаманець атакувальника. Рядок матриці S2, який читався «17/17 проходять — жоден тест цього не ловить», закрито.
- Після `git checkout` — контрольний прогін **18 passed**, `git diff` на файлі порожній.
- `cargo test --lib` — 5 passed. `cargo clippy --all-targets` — exit 0.
- Корінь: `pnpm lint`, `pnpm typecheck`, `pnpm format:check` — exit 0; `pnpm test` — 96 passed.

### Як перевірити руками
1. `wsl -d Ubuntu-24.04`, далі `cd ~/code/tipvault/program`.
2. Валідатор, якщо не піднятий: `solana-test-validator --ledger /tmp/l --reset --quiet &`, потім `solana --url http://127.0.0.1:8899 airdrop 500 $(solana-keygen pubkey ~/.config/solana/id.json)`.
3. `anchor test --skip-local-validator` — очікувано **18 passed**.
4. Зламати навмисно: у `programs/tip_vault/src/attestation.rs` прибрати `require!` з трьома порівняннями `== THIS_INSTRUCTION`, повторити п.3. Має впасти рівно один тест — `refuses an attestation whose message lives in another instruction` — і саме з текстом «but it succeeded». Повернути через `git checkout -- programs/tip_vault/src/attestation.rs`.
5. Звірити числа з `docs/evidence/S2a-checks.txt`.

### Не зроблено / свідомо відкладено
- **Деплой на devnet — це S2b, і він досі не зроблений.**
- **5 SOL із фаусета пішли не на ту адресу.** У поле фаусета вставлено program id `J6uAbWr24AsXfhmW8cTannQ7ZE2cqqWiCLs9s9PqWMxz` замість гаманця-платника `3vJKgump81K91cGG4jXiB4aEQ73QSxouYMshNURvurR2`. Стан на ланцюзі: платник 0 SOL, адреса програми 5 SOL, owner — System Program, `Executable: false`. Гроші не втрачені (кейпара наша), але **деплой на адресу з ненульовим балансом неможливий**: перевірено на localnet, `Error: Account ... is not an upgradeable program or already in use`; після спорожнення адреси той самий деплой проходить. Обидва прогони в логу, розділ 8. Адресу треба спорожнити командою `solana -u devnet transfer --from program/keys/tip_vault-devnet.json --fee-payer program/keys/tip_vault-devnet.json 3vJKgump81K91cGG4jXiB4aEQ73QSxouYMshNURvurR2 ALL --allow-unfunded-recipient` — після цього на платнику буде близько 5 SOL і S2b закривається без жодного фаусета. Коштами розпоряджається людина, тому команду не запускав.

### Ризики й відкриті питання
- **Тести програми не входять у `pnpm typecheck`:** у `@tipvault/program` немає скрипта `typecheck`, а `pnpm -r typecheck` обходить пакети без нього. Ручний запуск `tsc --noEmit -p program/tsconfig.json` дає 14 помилок: 13 у `tests/tip_vault.test.ts` — усі через нетипізований `Program` (`program.account.vault`, `program.methods.X` як possibly undefined) — і одна на `minWorkers` у `vitest.config.ts`. Жодна не в новому коді. На виконання це не впливає (vitest транспілює через esbuild, типи не перевіряє), eslint файли проходить. Лікується підключенням згенерованого `target/types/tip_vault.ts`; пропоную окремий маленький крок, бо це виходить за обсяг S2a.
- Решта ризиків із запису S2 лишається чинною: TS-клієнт `@coral-xyz/anchor` 0.32.1 проти програми на Anchor 1.2.0; ключ attestation потрібен для локальних тестів і лежить поза git; `MIN_TIP_AMOUNT` без прив'язки до розрядності мінта; 241 КБ `.so` = 1.23 SOL за деплой.

### Пропозиція на наступний етап
- **S2b:** спорожнити адресу програми, переконатись, що платник має ≥ 1.5 SOL, `anchor deploy --provider.cluster devnet`, звірити program id на ланцюзі, покласти в журнал підпис транзакції й посилання на explorer. Роботи хвилин на десять.
- Далі S3 за планом.

---

## S2b — Деплой `tip_vault` на devnet
- **status:** accepted
- **date:** 2026-09-19
- **scope_agreed:** деплой програми на devnet, звірка program id на ланцюзі, посилання на explorer. Окремо доручено в чаті («запусти сам») виконати перенесення devnet-SOL з адреси програми на гаманець-платник — до того я цю команду не запускав і віддавав її тобі.
- **commit:** `9403c80`

### Зроблено
- **Повернуто 5 SOL, які фаусет надіслав на адресу програми.** `solana transfer --from keys/tip_vault-devnet.json --fee-payer keys/tip_vault-devnet.json <платник> ALL`, підпис `5DHVvdLRr9rvzdT776WKGYNPabNSyzaBuwV3fan5BU63nahrqd3qoPoPhqNpfwwvPaaBe9t2ekifd43YwtyfxVG1`. Платник отримав 4.999995 SOL, на адресі програми лишився рівно 0 — саме те, чого вимагає лоадер.
- **Задеплоєно:** `anchor deploy --provider.cluster devnet --program-name tip_vault --program-keypair keys/tip_vault-devnet.json`. Деплой-транзакція `29YugTyRvsqatnStL6ztchBstQ6nDTBeeU29YXpJxaThyDHxkFqUxi6G1CD7ydaG5yrTwQaukwLy3iTi7ERhEbeN` — у ній видно рівно ту пару, через яку ненульовий баланс ламав деплой: `11111111111111111111111111111111` (create_account) і `BPFLoaderUpgradeab1e11111111111111111111111`.
- **Звірено байти, а не лише адресу.** `solana program dump` з devnet дає sha256 `5d9bf2f65e7327ffb1b5dd457f440278e8c178e42bf13d4e08515c64d172d4a0` — точно такий самий, як у локального `target/deploy/tip_vault.so` (241 808 байт); за межами цієї довжини в акаунті самі нулі, ненульових байтів 0. Тобто на devnet лежить той самий артефакт, проти якого пройшли 18 тестів, а не «схожа збірка».
- **IDL опинився на ланцюзі.** `anchor deploy` у 1.x додатково створює metadata-акаунт із seed `idl`: `54hpAZqLHr5TbrFdFJ6mBcS5Y4akWWy2iWWVonFG9hi3`, транзакції `aS548FWjpjHFhpRh9YfvrfsQP3PZAqpa4gHmdUXBsmCzqawjvuC4AVNJZ6H2hsJeWUW8vZ7UdMAJt5FTiDBHAuP` і `4BZbfEtMnMKBm7yqZTCzegEHuPzbrs9JwcqTnP7kW3w5sNeJnBT79N3epWXrLur6UMFwMAGhwdjxpeoqH4JbNdvo` через `ProgM6JCCvbYkfKqJYHePx4xxSUSqJp7rh8Lyv7nk7S`. Я цього окремо не замовляв — так поводиться сама команда. Шкоди немає, навпаки, клієнт зможе тягнути IDL з мережі; фіксую, бо це витрата з гаманця.

### Змінені файли
- `docs/evidence/S2b-deploy.txt` (новий) — сирий лог: стан до, перенесення, деплой, `program show`, звірка sha256, історія транзакцій, розбір кожного підпису
- `docs/journal.md`
- Коду не змінював. `TIP_VAULT_PROGRAM_ID` і `Anchor.toml` були вписані ще в S2, і адреса збіглася — правити не довелось.

### Перевірка
Повний лог: `docs/evidence/S2b-deploy.txt`.
```
Program Id: J6uAbWr24AsXfhmW8cTannQ7ZE2cqqWiCLs9s9PqWMxz
Owner: BPFLoaderUpgradeab1e11111111111111111111111
ProgramData Address: BJGGCccFSJ4kxjfRDBi6qR9fvKMbbghREaAQH6Ztdhuo
Authority: 3vJKgump81K91cGG4jXiB4aEQ73QSxouYMshNURvurR2
Last Deployed In Slot: 500564292
Data Length: 241808 (0x3b090) bytes
Balance: 1.22926348 SOL
```
- Program id збігається у **пʼяти** місцях: кейпара, `declare_id!`, `Anchor.toml [programs.devnet]`, `packages/shared/src/networks.ts`, ланцюг.
- `solana program show --buffers` — порожньо: жодних завислих буферів і замкнених у них коштів.
- Витрата: 4.999995 → 3.752880232 SOL, тобто 1.247 SOL. З них 1.22926348 — рента акаунта програми, решта — metadata-акаунт IDL і комісії.
- Explorer програми: https://explorer.solana.com/address/J6uAbWr24AsXfhmW8cTannQ7ZE2cqqWiCLs9s9PqWMxz?cluster=devnet
- Explorer деплою: https://explorer.solana.com/tx/29YugTyRvsqatnStL6ztchBstQ6nDTBeeU29YXpJxaThyDHxkFqUxi6G1CD7ydaG5yrTwQaukwLy3iTi7ERhEbeN?cluster=devnet

### Як перевірити руками
1. Відкрити explorer програми (посилання вище): має бути `Executable: Yes`, той самий ProgramData-акаунт і слот 500564292.
2. У `wsl -d Ubuntu-24.04`: `solana -u devnet program show J6uAbWr24AsXfhmW8cTannQ7ZE2cqqWiCLs9s9PqWMxz`.
3. Звірити байти власноруч, не вірячи журналу:
   `cd ~/code/tipvault/program && solana -u devnet program dump J6uAbWr24AsXfhmW8cTannQ7ZE2cqqWiCLs9s9PqWMxz /tmp/x.so && sha256sum /tmp/x.so target/deploy/tip_vault.so`
   — обидві суми мають бути `5d9bf2f6…`.
4. Переконатись, що на адресі програми немає «зайвих» коштів і що платник має ~3.75 SOL: `solana -u devnet balance 3vJKgump81K91cGG4jXiB4aEQ73QSxouYMshNURvurR2`.

### Не зроблено / свідомо відкладено
- **Тести проти devnet не ганяв.** Набір написаний під локальний валідатор: створює власний мінт, роздає airdrop, спить по 4 секунди в сценаріях протермінування. На devnet це коштувало б SOL і хвилин, а доказ того, що код на ланцюзі тотожний перевіреному, дає збіг sha256. Наскрізний devnet-сценарій — це S3.
- `[provider] cluster` в `Anchor.toml` лишив `Localnet`: щоденний прогін має йти на локальний валідатор, а деплой у мережу — завжди явним прапорцем, щоб не задеплоїти випадково.
- **Upgrade authority лишилась на `3vJKgump…`** — програма оновлювана. Це навмисно: до сабміту ще будуть зміни. Питання «зробити `--final` чи перевести на мультисиг» — окреме рішення перед mainnet, і воно за тобою.

### Ризики й відкриті питання
- **Ключ програми тепер має вагу:** хто має `keys/tip_vault-devnet.json` плюс права upgrade authority, той може підмінити програму на ланцюзі. Обидва ключі — в `program/keys/`, поза git, бекап ти зробив у `Documents/tipvault-keys-backup`. Для mainnet потрібна інша схема зберігання, не файл у домашній теці.
- Фаусет лімітований (2 запити на 8 годин на акаунт із привʼязаним GitHub). Зараз на платнику 3.75 SOL — вистачить на десяток редеплоїв, але при зміні розміру програми рента перераховується.
- Ризики з S2 і S2a лишаються чинними: `@coral-xyz/anchor` 0.32.1 проти Anchor 1.2.0, тести програми поза `pnpm typecheck`, `MIN_TIP_AMOUNT` без прив'язки до розрядності мінта.

### Пропозиція на наступний етап
- S3 за планом — наскрізний алерт на devnet.
- Перед ним пропоную маленький крок: підключити згенерований `target/types/tip_vault.ts` і додати скрипт `typecheck` у `@tipvault/program`, щоб тести програми перевірялись типами разом з усіма (див. S2a). Пів години.

---

## S2c — Захист replay задокументовано, типізація тестів програми
- **status:** accepted
- **date:** 2026-09-19
- **scope_agreed:** (1) перейменувати replay-тест під те, що він доводить, лишити перевірку на `already in use` явною, пояснити вибір `init` у `claim.rs` і в новому `docs/security.md`; (2) ще один рядок мутаційної матриці — прибрати `nonce` із seeds `UsedNonce`, склад seeds виписати в журнал; (3) `typecheck` для `@tipvault/program` зі згенерованими типами, 14 помилок мають зникнути, `pnpm -r typecheck` має захоплювати пакет; (4) реальні хеші комітів у S2a/S2b і статуси. Окремо погоджено комітити згенеровані IDL і типи в `program/idl/` та `program/types/`.
- **commit:** `34aa686`

### Зроблено
- **Рішення по nonce: `init` лишається.** Рецензент відхилив мою пропозицію перевести `used_nonce` на `init_if_needed` заради красивішого коду помилки, і аргумент сильніший за мій: `init` — гарантія рівня System Program, яку неможливо випадково прибрати, а `init_if_needed` переніс би її в один наш `require!`, що переживе рівно до наступного рефакторингу. Захист не змінювався; змінилось те, що тепер це рішення зафіксоване в трьох місцях, а не тримається в чиїйсь голові.
- **Тест перейменовано** на `stops a byte-identical replay at nonce-PDA creation, before our code runs` — назва тепер описує механізм. Над ним коментар: чому повтор справді побайтовий (детермінований підпис ed25519 над тим самим повідомленням) і чому перевірка стоїть на `already in use`, а не на нашому коді помилки.
- **`docs/security.md` — новий файл.** Список місць, які виглядають звичайним кодом, але тримають захист. Формат: правило → чому саме так → якою мутацією перевіряється. Два записи: `init` для `used_nonce` і перевірка offset-ів в ed25519-інструкції. Обидва рядки продубльовані коментарями в коді з посиланням на цей файл.
- **Seeds `UsedNonce` повним складом:** `[b"nonce", channel_id.to_le_bytes(), attestation.nonce.to_le_bytes()]`. Тобто в адресу входять і канал, і nonce.
- **Типізація тестів програми.** `anchor build` кладе IDL і типи в `target/`, який у `.gitignore` і якого немає в CI. Тепер `program/scripts/sync-idl.mjs` копіює їх у відстежувані `program/idl/` і `program/types/`, а тести й `typecheck` читають звідти. У скрипта є режим `--check`: він падає, якщо копія розійшлася зі збіркою, тож застаріла копія не переживе зміну програми мовчки. `makeProgram` тепер повертає `Program<TipVault>` замість нетипізованого `Program`.

### Змінені файли
- `docs/security.md` (новий, 57)
- `program/scripts/sync-idl.mjs` (новий, 60)
- `program/idl/tip_vault.json` (новий, 1030 — згенерований, копія збірки)
- `program/types/tip_vault.ts` (новий, 1037) і `program/types/tip_vault_errors.ts` (новий) — те саме
- `program/package.json` (+`typecheck`, +`sync:idl`, +`check:idl`)
- `program/tests/helpers.ts` (імпорт із відстежуваних копій, `Program<TipVault>`)
- `program/tests/tip_vault.test.ts` (перейменований тест + коментар)
- `program/programs/tip_vault/src/instructions/claim.rs` (**тільки коментар**, 6 рядків, логіка не змінювалась)
- `program/vitest.config.ts` (прибрано `minWorkers` — його немає в типах vitest 5)
- `.prettierignore` (`program/idl/`, `program/types/`: форматувати згенероване не можна, інакше `check:idl` падатиме завжди)
- `docs/evidence/S2c-checks.txt` (новий, 250)
- `docs/journal.md`

### Перевірка
Повний лог: `docs/evidence/S2c-checks.txt`. Фінальний контроль — розділ 7 логу; розділ 5 — це контроль одразу після відкату мутацій, до повернення коментарів етапу.
- `anchor test --skip-local-validator` — **18 passed, 0 failed**, до і після мутацій.
- **Мутаційна матриця, три злами.** Твоє припущення по першому не підтвердилось, нижче фактичний результат:

| Зламано | Результат |
|---|---|
| `nonce` прибрано із seeds — **тільки в програмі** | **9 з 18 падають** із `ConstraintSeeds` (2006). Це не про захист: клієнт і далі виводить PDA з nonce, адреси перестають збігатися, і гине кожен клейм. Доводить лише те, що seeds — частина контракту клієнт↔програма |
| `nonce` прибрано із seeds — **і в програмі, і в клієнті** | падає **рівно 1** тест, і **не replay**: `refuses to settle the same tip twice, even with a fresh attestation` (чекав `TipAlreadySettled`, отримав `Allocate: account ... already in use`). Replay-тест проходить |
| `init` → `init_if_needed` без жодної заміни | падає **рівно 1** тест — саме replay, з текстом `expected the transaction to fail with already in use, but it succeeded` |

  Висновок, який варто прочитати буквально: **replay-захист не тримається на nonce у seeds.** Без nonce в адресі PDA стає один на канал, тобто захист стає суворішим — повтор так само впирається в наявний акаунт. Nonce у seeds потрібен для протилежного: щоб стример міг легітимно прийти вдруге зі свіжою атестацією. А сам replay ловить `init`, і третій рядок матриці показує це прямо — з `init_if_needed` повторна транзакція **проходить**.
- **Typecheck пакета програми:** було 14 помилок при ручному запуску `tsc` (13 від нетипізованого `Program`, 1 на `minWorkers`) — стало **0**. `pnpm -r typecheck` тепер проходить по чотирьох пакетах, включно з `program`.
- **Симуляція свіжого клону = того, що побачить CI.** З індексу експортовано 72 файли: `program/target/` немає, `program/keys/` немає, `program/idl/` і `program/types/` є. У цій теці `pnpm install --frozen-lockfile` і `pnpm typecheck` — обидва exit 0, усі чотири пакети `Done`. Тобто додавання скрипта `typecheck` у програму не зробить CI червоним.
- `pnpm lint` — exit 0, `pnpm format:check` — «All matched files use Prettier code style!», `pnpm test` — 96 passed.
- `check:idl` — «idl and types match the build output».

### Правки старих записів
Це єдине місце, де порушено append-only, і воно зроблено за прямим дорученням рецензента, а не самовільно. Змінені рівно чотири рядки:
- S2 — `status: blocked` → `accepted`, із посиланням на S2b як на те, що зняло блокер; `commit` → `8eca407`.
- S2a — `status` → `accepted`, `commit` → `353d492`.
- S2b — `status` → `accepted`, `commit` → `9403c80`.
Текст самих записів не чіпався: усе, що там написано про хід робіт, лишається як було, включно з тим місцем у S2, де сказано, що деплою немає.

### Не зроблено / свідомо відкладено
- Логіку програми не міняв — у `claim.rs` тільки коментар. Задеплоєний на devnet байткод лишається тим самим, sha256 з S2b чинний.
- UX повтору («стример двічі тиснe Claim і бачить `already in use`») лікуємо на клієнті в S4 — перевіркою існування nonce-PDA перед відправкою. Записано як умова S4, не як зміна програми.
- `check:idl` у CI не підключав: CI не збирає програму, тож йому немає з чим порівнювати. Перевірка має сенс лише поруч із `anchor build`, тобто локально перед комітом.

### Ризики й відкриті питання
- **Згенеровані файли тепер у git.** Ризик — розходження копії зі збіркою. Мітигація: `check:idl`. Дірка: ніщо не змушує запускати його перед комітом. Варіанти на потім — pre-commit hook або крок у CI, який ставить Anchor; обидва коштують і обидва поза цим етапом.
- `@coral-xyz/anchor` 0.32.1 проти програми на Anchor 1.2.0 — тепер ця розбіжність ще й типізована: типи згенеровані Anchor 1.2, а споживає їх клієнт 0.32. Зараз усе сходиться (той самий `spec: "0.1.0"`), але це саме те місце, де воно може розʼїхатись у S5.
- Решта ризиків із S2/S2a/S2b лишається чинною.

### Пропозиція на наступний етап
- S3 за планом — наскрізний алерт на devnet.

## S3 — Наскрізний алерт на devnet
- **status:** ready_for_review
- **date:** 2026-09-20
- **scope_agreed:** індексер вебхуків Helius, SSE-потік, сторінка оверлея з однією дефолтною анімацією, звук і заглушка TTS, фолбек-полінг, схема БД за §5.4 (прийнята окремо). Поза обсягом: Twitch OAuth і дашборд (S4), mainnet (S5), blinks (S6), розширення (S7). Токен оверлея вписаний у БД руками.
- **commit:** `a13cafd`

### Рішення етапу: хостинг — Railway, Vercel викреслено

Рішення рецензента, з його обґрунтуванням: оверлей тримає SSE-зʼєднання годинами, поки стример в ефірі, а serverless упирається в ліміт тривалості функції й холодні старти. Постійний процес — правильна архітектура для цього завдання, і Postgres уже там. Записано в CLAUDE.md §6 разом із вимогою: збірка через кореневий `Dockerfile` з пінами Node 24 і pnpm 12.4.2, встановлення тільки `--frozen-lockfile`, і **CI збирає той самий Dockerfile**.

Окремо фіксую свою помилку в процесі. У промпті S3 було питання про локальний тунель для прийому вебхука, а я пішов у деплой на Railway, не спитавши. Це зміна підходу, і вона мала прозвучати як питання. Рішення вийшло тим самим, але спосіб, яким воно прийнялось, — ні.

Практичний наслідок цього рішення видно в самому коді: фолбек-полінг живе таймером усередині серверного процесу (`web/instrumentation.ts`), а не зовнішнім кроном. На serverless так не можна, на Railway — це найпростіший і найдешевший спосіб виконати §10.

### Поправка до обсягу: погоджена зміна в `packages/shared`

Turbopack, Vite і `tsx` резолвлять специфікатори буквально, тому `./memo.js` у пакеті давав порожній модуль замість помилки — 13 помилок збірки в `web`. Рецензент дозволив механічну заміну на відносні імпорти без розширення з чотирма умовами; усі чотири виконані: діф рівно у вісім рядків, окремий коміт `0a44e3f` без деплойних правок, реальні споживачі поза бандлером (`setup-devnet.ts`, `seed-channel.ts`, `tip-devnet.ts`) прогнані своїм справжнім раннером, правило записане в CLAUDE.md §8.

Наслідок у цьому етапі: з `web/next.config.ts` прибрано блок `turbopack.resolveAlias`, який мапив `./memo.js` на `./memo.ts`. Мапити більше немає чого, а конфіг, що описує неіснуючу проблему, — це майбутня година чужого часу.

### Зроблено

- **Класифікатор транзакції (`web/lib/tx.ts`) — серце етапу.** Чиста функція без мережі й без БД, тому покрита звичайними тестами: 20 штук. Канал визначається **власником токен-акаунта отримувача, ніколи не memo** — memo це те, що пише донатер, і довіряти йому в питанні «кому це» не можна. Сума береться з дельти pre/post token balances, memo — з логу нашої програми або з інструкції SPL Memo. Вердикти: `tip`, `unreadable-memo`, `channel-mismatch`, `ignored` з причиною.
- **Один шлях прийому (`web/lib/ingest.ts`) для обох тригерів.** Вебхук і полінг приносять тільки підпис; усе інше перечитується з нашого RPC (§4.6). Тому підроблений виклик вебхука не купує нічого — мережа має погодитись. Ідемпотентність — властивість таблиці, а не домовленість: `tips.signature` це первинний ключ, `onConflictDoNothing` повертає порожньо на повторі. Та сама логіка, що втримала `init` у програмі (S2c).
- **Семантика статусів виписана.** `seen` — записано, але на екран не піде (memo нечитабельний або чужий); `confirmed` — перевірено і чекає оверлея, саме це індексує частковий індекс `tips_channel_pending`; `alerted` — доставлено. Для транзакції з чужим мінтом **не пишеться нічого взагалі**.
- **SSE-потік і сторінка оверлея.** `/api/overlay/[token]/stream` віддає спершу догін (усе `confirmed`), далі живі події, heartbeat кожні 15 с, `retry: 2000`, `x-accel-buffering: no`. Сторінка — прозора сцена під OBS, черга алертів, дедуп за id (реконект переграє недоставлене), двонотний акорд на WebAudio, TTS заглушкою.
- **Фолбек-полінг став справжнім фолбеком.** Логіка винесена в `web/lib/poll.ts` і має два виклики: таймер у процесі (кожні 30 с, §10) і HTTP-ендпоінт для тестів. Обхід іде по **ATA отримувача, не по гаманцю**: у транзакції `tip_direct` гаманця стримера серед акаунтів немає взагалі, і полінг по ньому повертав би порожньо, виглядаючи справним.
- **Деплой.** Кореневий `Dockerfile` (node:24-slim, corepack pnpm 12.4.2, `--frozen-lockfile`), `.dockerignore`, `.railwayignore`, окрема джоба `image` у CI, яка збирає той самий Dockerfile із кешем GHA. Живе на `https://web-production-0daf2.up.railway.app`, Postgres у тому ж проєкті, міграція `web/drizzle/0000_yellow_warbird.sql` накочена.
- **Токен оверлея відкликаний після приймання етапу.** Три значення встигли засвітитись у переписці під час перевірки; усі три тепер віддають 404 і на `/overlay/<token>`, і на `/api/overlay/<token>/stream`. Чинний токен існує тільки в БД. Заодно зʼясувалось, що **HTTP-лог Railway пише повний шлях запиту разом із токеном** — наш код його не логує, але платформа на краю логує, тож §5.3 виконується лише на нашому боці. Правило й повний розбір того, що дає витік, — `docs/security.md` §4.

### Змінені файли

- `web/lib/tx.ts` (новий, 188) і `web/lib/tx.test.ts` (новий, 165)
- `web/lib/ingest.ts` (новий, 136), `web/lib/poll.ts` (новий, 75), `web/lib/alerts.ts` (новий, 82), `web/lib/overlay.ts` (новий, 39), `web/lib/solana.ts` (новий, 45), `web/lib/env.ts` (новий, 56)
- `web/lib/db/schema.ts` (новий, 148), `web/lib/db/client.ts` (новий, 39), `web/drizzle.config.ts` (новий), `web/drizzle/0000_yellow_warbird.sql` (новий, 90)
- `web/app/api/webhooks/helius/route.ts` (новий, 117), `web/app/api/overlay/[token]/stream/route.ts` (новий, 91), `web/app/api/internal/poll/route.ts` (новий, 34)
- `web/app/overlay/[token]/page.tsx` (новий, 27), `alert-client.tsx` (новий, 131), `overlay.css` (новий, 91)
- `web/instrumentation.ts` (новий, 49) — таймер фолбек-полінгу
- `web/scripts/`: `setup-devnet.ts` (136), `seed-channel.ts` (69), `tip-devnet.ts` (115), `helius-webhook.ts` (140), `measure-latency.ts` (178), `overlay-token.ts` (60) — усі нові
- `Dockerfile` (новий, 29), `.dockerignore` (новий, 12), `.railwayignore` (новий, 8)
- `.github/workflows/ci.yml` (+17: джоба `image`), `CLAUDE.md` (+6: §6 хостинг, §8 правило імпортів)
- `web/next.config.ts` (−9: мертвий `turbopack.resolveAlias`), `web/package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `.prettierignore`

### Перевірка

Повний лог перевірок: `docs/evidence/S3-checks.txt`. Усі числа нижче — з реальних прогонів проти **задеплоєного** сервісу і реальних транзакцій на devnet.

`pnpm lint` — exit 0. `pnpm -r typecheck` — чотири пакети, 0 помилок. `pnpm test` — **116 passed, 0 failed** (було 96 до етапу; +20 на класифікатор).

**Умова 1 — справжній `tip_direct` на devnet через задеплоєну програму.** Не локальний валідатор: усі транзакції нижче йдуть через програму `J6uAbWr24AsXfhmW8cTannQ7ZE2cqqWiCLs9s9PqWMxz` з devnet, memo будує спільний кодек із `packages/shared`. Контрольний підпис:
`424TPks6HCVPLHJx12QmM6Ka1RtXQgiZsVGbaQkHJ28S6RG6KRgGRerszRWYmLDBnwXd3T1PKPstGifuQkjziTkk`

**Умова 2 — фільтр за мінтом.** `docs/evidence/S3-matrix.txt`, шість випадків за один прогін із живим SSE-слухачем, щоб «алерту не було» було зафіксовано, а не припущено:

| Випадок | Рядок у `tips` | Алерт |
|---|---|---|
| валідний тіп (контроль) | `alerted/webhook` nick="alex" | **так** |
| скам-токен, валідне memo | **немає взагалі** | ні |
| сміттєве memo | `seen/webhook`, nick=null | ні |
| memo чужого протоколу | `seen/webhook`, nick=null | ні |
| обрізане `tv1\|` | `seen/webhook`, nick=null | ні |
| memo на чужий канал | `seen/webhook`, nick=null | ні |

Скам-підпис `4pta61S8hfRg1F7pbYgPoVbtSahHYVGpHv9cNBfP1cU3iUFPqUW7owiAWXfu6yV6MJF6sGZsir7jRn8JPjNSANLj` — окремо перевірено, що його немає й у таблиці `events`: «no trace at all». Алертів за весь прогін — рівно один. Шлях `decodeMemo → null` доходить до кінця і нічого не ламає, як ти й просив перевірити.

**Умова 3 — ідемпотентність на справжньому payload.** `docs/evidence/S3-idempotency.txt` і сам payload у `docs/evidence/S3-helius-payload.json` (4684 байти). Це **тіло, яке Helius сам відправив** на `/api/webhooks/helius` о 22:19:06Z, не мок: щоб його дістати, у роут доданий захват за прапорцем `HELIUS_CAPTURE`, вимкнений за замовчуванням, який пише сире тіло в `events`. Писав саме в БД, а не в лог, бо Railway ріже довгі рядки, а обрізаний захват — це підроблений захват. Далі прапорець вимкнений (перевірено: лічильник `helius_raw` перестав рости), і той самий файл відправлений `curl --data-binary` ще **пʼять разів**. Результат кожного разу: `{"accepted":1,"outcomes":["duplicate"]}`, HTTP 200, у `tips` **один рядок**, `seen_at` не зрушив.

**Умова 4 — фолбек при відсутньому вебхуку.** `docs/evidence/S3-fallback.txt`. Вебхук не «зламаний секрет» і не «перенаправлений» — він **видалений у Helius** (`DELETE` → 200, `webhooks registered now: 0`), витримана пауза 30 с, і лише тоді відправлений тіп. Алерт прийшов **через 12.9 с**, рядок у БД `alerted/poll`, nick="fallback". Доставив його таймер усередині процесу, що видно в логах Railway рядком `[poll] scheduled sweep every 30000 ms` при старті.

**Умова 5 — виміряна латентність.** `docs/evidence/S3-latency.txt`, пʼять реальних тіпів поспіль, слухач підключений до того самого SSE-ендпоінта, що й OBS:

```
from signature       runs 5/5  median 1.38 s  min 1.32 s  max 1.52 s
from confirmation    runs 5/5  median 0.25 s  min 0.06 s  max 0.27 s
```

**1.38 с при межі 6 с.** Тут є момент, який варто прочитати. Перший прогін я міряв від моменту, коли наш власний `confirmTransaction` повернувся, і один із пʼяти дав **мінус 0.48 с** — алерт прийшов раніше. Це не збита точка відліку і не різні годинники (обидві мітки — `Date.now()` в одному процесі): Helius штовхає зі свого вузла в мить підтвердження слота і випереджає наш RPC-раунд-трип. Але умова каже «від підпису», а не «від нашого підтвердження», тому `tip-devnet.ts` тепер друкує ще й `SENT_AT`, а харнес рахує обидві бази. Перша — це число умови й те, що відчуває глядач; друга лишена, бо саме вона показує, що наш шлях не є вузьким місцем.

**Алерт на екрані:** `docs/evidence/S3-alert.png` — знято з задеплоєного оверлея в момент показу, headless-Chrome через DevTools Protocol (звичайний `--screenshot` стріляє на `load`, тобто до приходу події). На знімку `$7.00 / regressor tipped / алерт на екрані`.

**Діагностика, яка зʼїла найбільше часу, і чим вона закінчилась.** Вебхук мовчав на шести реальних тіпах поспіль, у логах не було жодного рядка `[helius]`. Перевірено по черзі: адреси (`3TfkJzNF…` — ATA стримера — стоїть у транзакції під індексом 1 і саме її слухає вебхук), секрет (`curl` із ним дає 200), хост API (`api-devnet` повертає той самий вебхук, тобто мережі там не розділені), тип (`rawDevnet`). Конфігурація була правильною весь час. Причина — **вікно застосування змін на боці Helius**: їхній дашборд сам пише «Webhook changes may take up to 2 minutes to take effect», а всі мої тіпи потрапляли саме в це вікно після чергової перереєстрації. Мій попередній висновок «вебхук не працює на devnet» був неправильним, і виправляю його цим записом. Практичний наслідок для нас: після будь-якої зміни вебхука треба чекати дві хвилини, інакше діагностуєш тишу, якої немає.

### Як перевірити руками

1. Прочитати токен оверлея: `pnpm --filter @tipvault/web overlay:token -- --show`
2. Відкрити `https://web-production-0daf2.up.railway.app/overlay/<токен>` — порожня прозора сторінка, це норма.
3. `cd web && pnpm exec tsx scripts/tip-devnet.ts --amount 3 --nick <твій нік> --message "перевірка"`
4. Алерт має зʼявитись приблизно за півтори секунди й провисіти 6 с.
5. Скам-токен: той самий скрипт із `--scam`. На екрані не має зʼявитись нічого.
6. Сміття в memo: `--memo "будь-що"`. Теж нічого на екрані.
7. Повтор payload: `curl -s -X POST <base>/api/webhooks/helius -H "content-type: application/json" -H "authorization: $HELIUS_WEBHOOK_SECRET" --data-binary @docs/evidence/S3-helius-payload.json` — має віддати `duplicate`, а в БД лишитись один рядок.

### Не зроблено / свідомо відкладено

- **TTS — заглушка.** Реальний голос у S10, як і планувалось.
- **Ротація токена з дашборда** (§5.3) — поки скриптом `overlay:token --rotate`, бо дашборда ще немає. Токен, який фігурував у моїй переписці, **зротовано**; старий віддає 404 і на сторінці, і на потоці. Новий я нікуди не друкував — читається командою вище.
- **`/api/channel/[login]/resolve` і решта §5.3** — не чіпав, це S4 і S6.
- Escrow-шлях (`tip_escrow`, `claim`) в індексері не обробляється: на цьому етапі алерт тільки для `tip_direct`.

### Ризики й відкриті питання

- **Env вийшов за §5.5.** Додались `DATABASE_URL` (замість `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE` — Postgres у Railway, а не Supabase), `INTERNAL_TASK_SECRET`, `POLL_INTERVAL_MS`, `HELIUS_CAPTURE` і тестові `TEST_*`. §5.5 треба або оновити, або свідомо лишити як список мінімуму — рішення за тобою.
- **`USDC_MINT` розходиться з `packages/shared`.** Кран Circle заблокував видачу, тому в env стоїть наш власний шестизначний devnet-мінт, а в `shared` — адреса Circle. Поки живуть окремо; на mainnet (S5) це місце треба звести, інакше розбіжність спрацює тихо.
- **Таймер полінгу припускає один інстанс.** Два інстанси — два свипи; дублів у БД не буде через первинний ключ, але RPC-рахунок подвоїться. Горизонтальне масштабування потребуватиме або блокування в БД, або винесення свипу окремим сервісом.
- **Полінг переклассифіковує те саме сміття щосвипу.** Для транзакції з чужим мінтом не пишеться нічого (це навмисно), тому вона щоразу знову потрапляє у вікно з 25 підписів і знову перечитується з RPC. Зараз це копійки, але на активному каналі вікно варто рахувати від останнього обробленого слота, а не від кінця списку.
- **Безкоштовний план Helius.** Один вебхук на акаунт (скрипт тому переписує наявний, а не створює другий) і кожна доставка — кредит із місячного ліміту. Плюс дві хвилини на застосування змін, описані вище.
- **Базова лінія продуктивності, щоб було з чим порівнювати в S11.** Усі числа цього етапу зняті в тепличних умовах, і це треба читати саме так: **один канал, один оверлей, один гаманець-донатер, порожня черга, один інстанс сервісу**. Медіана 1.38 с від підпису і 0.25 с від нашого підтвердження — це вебхуковий шлях за таких умов. Навантажувальна перевірка на 50 одночасних оверлеях (S11) має порівнюватись із цими числами, а не з межею в 6 с.
- **Фолбековий шлях дає 12.9 с, і це окремий ризик, не лише резервний варіант.** Як фолбек 12.9 с прийнятно. Але якщо вебхуки почнуть регулярно губитись, стример бачитиме не «алерт повільніший», а «алерт не працює»: тринадцять секунд після донату глядач уже пішов, а стример уже не звʼяже подію з тіпом. У S11 треба вирішити два питання: чи показувати щось на оверлеї в цей проміжок, і чи алертити нас самих, коли частка `source=poll` перевищує якийсь поріг. Зараз ця частка ніде не рахується.
- **Токен оверлея потрапляє в HTTP-лог Railway.** Знайдено вже після приймання етапу: проксі логує повний шлях, тобто `GET /api/overlay/<повний токен>/stream`. Наслідок — доступ до проєкту в Railway дорівнює доступу до всіх токенів, які колись відкривали оверлей, і після будь-якого такого доступу токени треба ротувати. Прибрати токен зі шляху (обмін на сесійну куку при першому завантаженні або короткоживучий підписаний URL) — окреме рішення, кандидат у S4.
- **`railway.json` платформа мовчки ігнорує** — деприкейтнутий, у маніфесті сервісу він не відображався взагалі. Конфігурація збірки тепер лише в `Dockerfile`, файл прибраний. Це те місце, де «конфіг є, але не діє» коштувало годину.
- **`HELIUS_CAPTURE` лишається в коді.** Вимкнений за замовчуванням, але це шлях, який пише сире тіло транзакції в `events`. Якщо не подобається сама наявність — скажи, приберу.

### Правки після приймання

Запис редагувався один раз, після того як рецензент прийняв етап, і за його прямим дорученням. Змінено: один пункт у «Зроблено» про відкликаний токен оверлея і три пункти в «Ризиках» — базова лінія для S11, ризик фолбекового шляху і токен у HTTP-логах Railway. Опис ходу робіт не чіпався. Поле `status` лишається `ready_for_review`: етап прийнятий у чаті, але позначку в журналі ставить рецензент, не я (§1).

### Пропозиція на наступний етап

- S04 за планом: Twitch OAuth, дашборд, `/api/channel/[login]/resolve`, ротація токена оверлея з інтерфейсу. Плюс UX повтору клейма, записаний у S2c як умова S4.

## S3.5 — Hackathon requirements

- **status:** ready_for_review
- **date:** 2026-09-22
- **scope_agreed:** MIT licence; English for new artefacts (rule 12(a)); no Twitch or Colosseum branding; install the Colosseum resources skill and connect the Solana MCP; evaluate replacing `@coral-xyz/anchor`, timeboxed to one hour
- **commit:** `5525a7d`

> First entry written in English. From here on every new journal entry, file
> under `docs/`, commit message and code comment is English (CLAUDE.md §1).
> Existing Ukrainian entries stay as they are — the journal is append-only and
> translating the old ones is its own stage before submission.

### Done

- **MIT licence.** `LICENSE` at the root plus `"license": "MIT"` in all five manifests, where the field was previously absent everywhere.
- **Language rule in CLAUDE.md §1.** Written in Ukrainian on purpose: the file is Ukrainian, and mixing languages inside one document is worse than being consistent until the whole thing is translated. CLAUDE.md itself and the chat stay Ukrainian; neither is a submission artefact.
- **Branding rule in CLAUDE.md §4.7,** and the palette changed to obey it. The overlay card's gradient started at `#5820c8`; Twitch's brand purple is `#9146FF`. Not the same colour, but the same family, on a product whose whole context is Twitch — exactly the argument nobody wants to be having during a store review. Everything moved to teal on slate, which belongs to neither Twitch nor Solana (Solana's own identity is a purple-to-green gradient, so avoiding purple keeps us from implying an endorsement there either). **The stylesheet edits themselves are not in this commit:** S4 had already moved `overlay.css` to a different directory and `globals.css` does not exist in `main` yet, so committing the colours here would have dragged half the S4 restructure with them. The rule lands now, the pixels land with S4 — noted so the gap is visible rather than discovered.
- **Solana MCP connected** (`https://mcp.solana.com/mcp`, no API key). It lives in the local Claude config, not in the repository, so nothing about it reaches the submission. Tools: `list_sections`, `get_documentation`, `Solana_Documentation_Search`, `Solana_Expert__Ask_For_Help`, `program_autofixer`.
- **The Colosseum resources skill** was installed by the reviewer from `github.com/ColosseumOrg/colosseum-resources`, **globally rather than into the project**. Installing it into the repository would have committed a vendored copy of someone else's 79-agent skill tree into a submission that is judged on code written during the hackathon.
- **Anchor client replaced:** `@coral-xyz/anchor` 0.32.1 → `@anchor-lang/core` 1.2.0.

### Changed files

- `LICENSE` (new, 21 lines)
- `package.json`, `web/package.json`, `ext/package.json`, `program/package.json`, `packages/shared/package.json` (licence field)
- `CLAUDE.md` (§1 language rule, §4.7 branding)
- `program/package.json`, `web/package.json` (Anchor dependency), `program/tests/helpers.ts`, `web/scripts/tip-devnet.ts` (three import sites)
- `pnpm-lock.yaml`
- `docs/journal.md`

`CLAUDE.md` and `web/package.json` also carry S4 edits in the working tree (§5.5 gained `SESSION_SECRET` and `TWITCH_REDIRECT_URI`; `web` gained an `overlay:token` script). Only the S3.5 hunks were staged, so this commit contains nothing from S4.

### Verification

- `pnpm lint` exit 0, `pnpm format:check` clean, `pnpm -r typecheck` 0 errors across four packages, `pnpm test` **141 passed**.
- **`program_autofixer` over the whole program** — `attestation.rs`, `instructions/claim.rs`, `instructions/tip_escrow.rs`, `instructions/refund_expired.rs`, all 795 lines: **zero issues, zero suggestions**, `framework_detected: anchor`. Worth stating plainly because this is the first independent check of that code: until now the only evidence the program was sound was our own mutation matrix from S2a and S2c.
- **Anchor swap, 18/18 program tests green.** The replacement turned out to be more than cosmetic: `@anchor-lang/core` 1.2.0 is the client for Anchor 1.2.0, which is the version the program is *built* with, so this closes the client/program version skew recorded as a risk in S2c. The diff is three import lines and two manifests; `tsc` passed on the first attempt, which is the strongest signal that the exported surface is identical. Net dependency change: **−7 packages**.
- **Real consumer outside the bundler:** `tip-devnet.ts` run with `tsx` against devnet through the new client — signature `2jtdRxK32NfWSofDZ6Yazs3wb3tNFULYVxCYFxZ8jo2o5LLVVChYJhuxA8BBaaMJuskSqAJD46JFdmbksLHqiU1M`, memo `tv1|123456789|anchorswap|client 1.2.0`, confirmed in 2063 ms.

### How to check by hand

1. `cat LICENSE` and `grep '"license"' package.json */package.json packages/*/package.json` — MIT in all five.
2. `grep -rn "#5820c8\|8b5cf6\|9146ff" web/ --include="*.css"` — no hits; the palette carries no purple.
3. In WSL: `cd ~/code/tipvault/program && solana-test-validator --reset --quiet --bpf-program J6uAbWr24AsXfhmW8cTannQ7ZE2cqqWiCLs9s9PqWMxz target/deploy/tip_vault.so &` then `ANCHOR_PROVIDER_URL=http://127.0.0.1:8899 ANCHOR_WALLET=~/.config/solana/id.json pnpm run test:localnet` — 18 passed.

### Not done / deliberately deferred

- Translating the existing Ukrainian journal entries, `docs/security.md` and CLAUDE.md — a separate stage before submission, as agreed.
- The S4 working tree (Twitch OAuth, dashboard, wallet proof, i18n, overlay cookie) is deliberately **not** in this commit and stays uncommitted.

### Risks and open questions

- **`anchor test` no longer runs on this machine.** Anchor CLI 1.2.0 spawns `surfpool` instead of `solana-test-validator`, and `surfpool` is not installed: `Failed to spawn surfpool: No such file or directory`. This is a property of the CLI, **not** a consequence of the client swap — the same failure would have happened before it. The 18 tests were therefore run by starting `solana-test-validator` directly and pointing vitest at it, which is what S2c's `--skip-local-validator` did in effect. Two consequences: CLAUDE.md §6 still lists `anchor test` as a working command when it is not, and CI has no way to run the program tests either. Installing `surfpool` or rewriting the command is a decision for S4.
- **Purple is now forbidden but the rule is only as good as the next person reading it.** There is no automated check that a new colour is not Twitch's. A lint rule over CSS colour literals would be cheap; not done here.
- The Colosseum skill is global, so it is not pinned by the repository: a fresh clone on another machine does not get it. That is the intended trade, recorded so nobody is surprised.

### Next stage proposal

- Back to S4: Twitch OAuth, dashboard, `/api/channel/[login]/resolve`, with the overlay token moved out of the URL. Claim and escrow indexing split off into S4b as agreed.
