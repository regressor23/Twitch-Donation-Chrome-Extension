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
