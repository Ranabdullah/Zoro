# Kora

A personal money app for life in Ireland and accounts back home. Local, unpublished first version.

## Try it

Requires Node.js 22 or newer. Open a terminal in this folder:

```sh
npm ci
npm run build
npm start
```

Open http://127.0.0.1:4173 on this PC. Without backend configuration, this is a clearly labelled sample preview, saved in this browser only. Do not enter real financial information into the sample preview. It is not an authenticated account and does not sync to a phone.

## Included

- Responsive desktop/mobile layout with a stacked wallet and consistent card proportions.
- Cards open a private account-details dialog with that account's activity and receipt links.
- Edit card names/providers, choose a custom colour or one of eight presets, and choose four backgrounds. Text contrast adjusts automatically.
- Euro default, African currencies, any bank/provider name, mobile money and cash.
- Manual expenses and income; balances calculated in integer minor units.
- Latest available reference-rate euro estimates with rate dates, not bank conversion quotes.
- Receipt photos with optional notes; image resizing and JPEG re-encoding before storage.
- Debt reminders, activity search, hide-balances control and records download.
- Supabase Google/email sign-in implementation, invite-only data access, per-user database policies, private receipt storage and conflicting-write detection.

There is no bank linking, payment processing, OCR, SMS login or automatic statement reconciliation. Accounts are manual ledgers. Debt settlement is a reminder status; record any payment separately. The online export contains receipt metadata, not the photo files.

## Go online later

Read **HANDOVER.md**. Hosting and Supabase must be configured before login/sync work. Nothing has been deployed or pushed to GitHub. The temporary Sites registration from the initial approach was never deployed and is not needed; `.openai/` is ignored and excluded from the handover archive.

## Files

- `dist/`: maintained frontend source and static hosting directory.
- `src/cloud.js`: Supabase adapter; bundled at build time into `dist/cloud.js`.
- `scripts/build.mjs`: builds client SDK, copies local fonts, generates public backend configuration.
- `supabase/schema.sql`: one-time schema for a new Supabase project.
- `supabase/invite.sql`: template for enabling the approved email.
- `tests/`: balance, currency, card-contrast and PostgreSQL access-policy tests.
- `../.github/workflows/publish.yml`: a manual Publish workflow for repeat deployments after one-time setup.

## Verification

`npm test` passes 17 checks, including eight SQL-policy scenarios executed in local PostgreSQL (PGlite) with auth/storage fixtures. These check anonymous denial, user isolation, invitation requirements, private receipt paths, and stale-write rejection. Card text contrast is tested across 4,096 colours. Build and local HTTP response were checked. Browser visual/interaction QA remains blocked by a saved browser permission; no screenshot verification is claimed. Supabase authentication, the actual storage service and cross-device behavior still require live integration testing. This is not a security-audited production release.
