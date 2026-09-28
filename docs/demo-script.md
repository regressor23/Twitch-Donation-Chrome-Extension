# Demo script

How to record TipVault in one take. Written for the weekly hackathon update
(about three minutes) and structured so the final submission demo reuses the
same shots with two more scenes at the end.

Recording is done in OBS itself: the overlay is already a Browser Source in the
scene, so what gets captured is exactly what a viewer sees. Settings → Output →
Recording, format `mkv` (it survives a crash; `mp4` does not), then **Start
Recording** in the main window.

Narration says **tip**, never *donation*, and never calls this an official
Twitch product (CLAUDE.md §4.7). Twitch's own consent screen appears in Scene 1
— that is their page and their branding, which is fine. Nothing we drew may
carry their marks or their purple.

---

## Before you press record

- [ ] OBS: Browser Source added, **Shutdown source when not visible** unchecked
      — the overlay holds an SSE connection and OBS closes the page without it.
- [ ] Browser: signed out of TipVault, so Scene 1 starts from the sign-in page.
- [ ] Terminal: open at the repository root, large font, the tip command typed
      but **not** run.
- [ ] A second browser tab on `explorer.solana.com`, empty, for Scene 5.
- [ ] Donor wallet has test-mint tokens and some devnet SOL.
- [ ] Decide which alert path you are demonstrating — see **Pacing** below.

### Never in frame

| What | Why |
|---|---|
| The **Reveal** button on the overlay card | the link is a bearer credential: whoever reads it can send an arbitrary alert to the stream and swallow real ones (docs/security.md §4) |
| The Browser Source **Properties** dialog | its URL field shows the same token in full |
| `web/.env.local`, or any terminal that has printed it | Twitch client secret, database URL, session key |
| The Twitch **New Secret** page | same |

If a token does reach the recording: rotate it from the dashboard, re-add the
Browser Source with the new link, and re-shoot that scene. The old link 404s
immediately, so the footage becomes harmless — but only after the rotation.

---

## Shot list

### Scene 0 — cold open · 0:00–0:10

On screen: the OBS scene, overlay empty and transparent over whatever is
behind it.

> "TipVault is USDC tips for Twitch streamers on Solana. The money goes
> straight to the streamer's own wallet — we never hold it — and the alert on
> stream fires from the confirmed transaction, not from the browser."

### Scene 1 — sign in · 0:10–0:35

On screen: the site, click **Увійти через Twitch**, then Twitch's consent
screen. **Rest the cursor on the permissions area.** It is empty.

> "Signing in asks Twitch for no scopes at all. We never read chat,
> subscriptions or email. The only thing we need is the numeric channel id,
> because that is what the tip memo carries."

Land on `/dashboard`.

### Scene 2 — connect a payout wallet · 0:35–1:10

Click **Підключити гаманець**, approve the connection, then **stop on the
wallet's signing dialog and let the viewer read it**. It names the channel, the
wallet and the time, and says signing sends no transaction.

> "The payout wallet is proved with a signature, not typed into a field. The
> address is sealed into the challenge on the server, so what was signed and
> what gets saved cannot drift apart. This is also the moment the channel is
> created — before a wallet is proven there is nothing to tip."

Approve. The card shows the address and a green **Підтверджено**.

### Scene 3 — the overlay link · 1:10–1:25

Click **Копіювати**. Do not reveal. Point at the OBS source already in the
scene.

> "The overlay link goes into OBS as a browser source. It stays hidden here on
> purpose — this page is often open on a monitor that is on stream — and it is
> one click to replace if it ever leaks."

### Scene 4 — a real tip · 1:25–2:05

Cut to the terminal. Run the command from **Commands** below. Read the output
aloud as it lands: the mint, the amount in minor units, the memo, the
signature, `confirmed in … ms`.

> "This is a real `tip_direct` on devnet, through the deployed program. The
> amount is in minor units — there is no floating point anywhere near the
> money. The memo carries the channel, the nickname and the message."

Cut to the OBS scene and wait. The alert appears with the nickname, `$3.00`
and the message, and holds for six seconds.

### Scene 5 — proof it was on chain · 2:05–2:30

Paste the signature into Solana Explorer. Show the SPL transfer and the memo
`tv1|…`.

> "Nothing on that overlay came from a frontend saying a payment happened. The
> alert is triggered by this confirmed transaction. If the transaction does not
> land, no alert exists to show."

Close on what is next: claim and escrow, so a viewer can tip a streamer who has
never heard of us and the streamer collects afterwards.

### Scene 6 — resilience · optional, +0:30

Worth showing once, because it is the least obvious engineering in the project.

> "Webhooks are allowed to miss. A timer inside the server sweeps every active
> channel's token account every thirty seconds, so the alert still arrives —
> measured at 12.9 seconds with the webhook deleted outright, against a 1.4
> second median on the normal path."

---

## Commands

Two forms. Both send a real transaction through the deployed program; neither
is a simulation.

**The seeded test channel** — the fast path, because its address is registered
with the Helius webhook:

```bash
pnpm --filter @tipvault/web devnet:tip -- --amount 3 --nick regressor --message "first tip on stream"
```

**Your own channel** — override the two values the script otherwise reads from
`.env.local`. `CHANNEL` is your numeric Twitch user id; `WALLET` is the payout
address shown on the dashboard. Inline values win over `.env.local`, which is
checked, not assumed:

```bash
TEST_CHANNEL_ID=<CHANNEL> TEST_STREAMER=<WALLET> pnpm --filter @tipvault/web devnet:tip -- --amount 3 --nick regressor --message "first tip on stream"
```

Run these from the repository root, inside WSL.

### Pacing

A channel is only on the fast path if its recipient address is registered with
the Helius webhook. Everything else is caught by the fallback sweep, which runs
every thirty seconds — correct, and slow on camera.

So: either register the address before recording, or record the wait honestly
and use it as Scene 6. Do not cut the wait out and keep the 1.4 second claim in
the narration.

---

## If the alert does not appear

Work down this list; each step rules out one stage.

1. **Did the transaction land?** The script prints the signature and
   `confirmed in … ms`. No signature means it never left — check the donor's
   SOL and that the recipient's token account for this mint exists.
2. **Right mint?** The deployment watches one mint. A tip in any other token is
   ignored by design — no row, no alert. That filter is deliberate (it is what
   stops a scam-token airdrop from appearing on stream), so check the mint in
   the script output against `USDC_MINT` on the server before suspecting a bug.
3. **Right channel?** The memo's channel id must match the channel whose
   overlay is open. `tv1|<channel_id>|<nick>|<message>`.
4. **Is the overlay actually connected?** Right-click the source → Interact. A
   blank transparent page is normal; a 404 means the token was rotated after
   the source was added.
5. **Below the alert threshold?** `alert_configs.min_alert` defaults to $1.

---

## Numbers you can say out loud

Every one of these is measured and has a file behind it. Do not round them up.

| Claim | Value | Source |
|---|---|---|
| Signature → alert on screen, median of 5 | **1.38 s** | `docs/evidence/S3-latency.txt` |
| Same, with the webhook deleted outright | **12.9 s** | `docs/evidence/S3-fallback.txt` |
| Alert visible on screen | 6 s | `VISIBLE_MS` in the overlay client |
| Minimum tip, enforced on chain | $1 (`AmountTooSmall`) | `program/tests/tip_vault.test.ts` |
| Program tests | 18 | `pnpm test:program` |
| Unit tests | 163 | `pnpm test` |
| Twitch scopes requested | none | the consent screen in Scene 1 |

The 1.38 s figure is one wallet, one channel and an empty queue. Under load it
will be worse, and that measurement is S11's job. If you quote it, quote it as
a baseline.
