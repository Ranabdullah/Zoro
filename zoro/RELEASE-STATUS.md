# Zoro release status — 15 November 2026

Source version: **0.3.0**. App: https://zoro-personal-wallet.pages.dev/ . Repository: https://github.com/Ranabdullah/Zoro . Source folder: `zoro/`. Existing Cloudflare projects can use the small legacy-path forwarding build until their saved root setting is changed to `zoro`.

## Implemented in source

- Public sample wallet, skippable/replayable guided tutorial and empty real wallets.
- Owner-scoped Supabase saving, private receipt storage, compare-and-swap saves and PC/phone refresh behavior.
- Manual regional accounts, currency names/symbols, euro reference estimates, income sources, expenses, receipts, debts and card images.
- Branded Excel/PDF reports and receipt filters, full Excel backup/import, record/section/wallet/account deletion with backup offers.
- Email/password/TOTP login, current-password change, recovery email/reset UI and one-time MFA recovery codes with a server-side recovery function.
- Optional Google and SMS sign-in behind provider configuration flags.
- Local PIN/device-authenticator screen locks, optional server-enforced unfamiliar-browser approval, revocation and approximate location notices inside an open app.
- Optional one-way OneDrive Excel workbook updates, backup reminders and an opt-in encrypted daily owner-snapshot workflow with decrypt/restore tools.
- Guided user-owned Supabase choice remembered with the central Zoro ID; independent self-hosting/fork/transfer documentation and combined SQL for new projects.

## Owner setup and live verification still required

These are not completed by publishing source, and must not be advertised as already running:

- A verified SMTP sender, successful public registration/confirmation and actual recovery-email delivery.
- Google OAuth and SMS provider accounts, credentials/consent, anti-abuse limits and live sign-in testing if enabled.
- Installing the new phone-auth/device-approval/recovery-codes migrations in each existing backend and deploying the recover-account Edge Function with exact allowed origins. The combined setup includes them for new empty projects.
- Microsoft app registration/consent and a real OneDrive update test if the integration is enabled.
- Encrypted-backup key generation, private key custody, service-side backup secret configuration, enabled schedule and an actual owner restore drill. Default workflow is disabled until explicitly configured. GitHub scheduling/retention is not an uptime/backup guarantee.
- Real two-user isolation, cross-device operation, lost-authenticator recovery and migration tests in the owner's configured services.
- Physical iPhone/Android checks: camera/file picker, biometric prompt, background lock, browser approval, scroll/keyboard layout and network failure behavior. Browser-size previews and DOM simulations do not establish physical-device readiness.

## Deliberate boundaries

- The device lock is a local screen control. Browser approval relies on verified auth/MFA plus a browser token; platform credentials may sync. **Guaranteed physical hardware binding is not claimed.**
- Location is approximate and may reflect a VPN. Notifications appear inside an open approved app; closed-phone push notifications are not implemented.
- Online Excel is a one-way generated report while an authorized browser is connected. Workbook edits are not imported automatically, and closed-app server synchronization is not claimed.
- A Supabase account/project cannot be provisioned without the owner's authorization and provider setup. The app supports the Supabase auth/data contract; arbitrary backends need a defined provider-specific adapter.
- Data is access-controlled, not end-to-end encrypted. Project admins can read it; infrastructure may process IP addresses. No independent security audit or guaranteed recovery is claimed.

## Evidence

Automated checks exercise ledger math, report/filter/import round trips, card contrast and image validation, local PIN/P-256 signature handling, ciphertext tamper rejection, public/empty-wallet DOM flows, and database policies for MFA, session revocation, owner-only records, browser approval, recovery-code limits and confirmed phone identities. The complete downloadable setup SQL is executed in a local PostgreSQL fixture.

Earlier live sample checks exercised report/backup downloads and sample restore, salary recording, card image upload/removal and a 390px account-details view. The new provider integrations and physical hardware flows require the live checks above. Read the setup guides before enabling them.
