# Zoro release status - 12 November 2026

Deployed to https://zoro-personal-wallet.pages.dev/ with the existing private backend and automatic Git builds. Public app, signup screen, cloud guide, setup SQL and response security headers checked at the new address. All 30 automated tests pass. The new origin is configured in Supabase's Site URL and allowed redirects.

Implemented: sample app and tour; public signup UI; empty real wallets; verified email/password/TOTP; owner-scoped saving/sync; manual accounts/income/expenses/receipts/debts; regional currency names and estimates; card customization/uploads; Excel/PDF reports and receipt filters; full Excel backup/import; data/account deletion; password change and browser sessions; optional user-owned Supabase choice remembered with the central Zoro ID.

Still pending; do not describe these as finished:

- Verified SMTP sender and successful public signup/confirmation delivery. The owner is deciding email setup. Keep email verification enabled.
- Password recovery UI and tested MFA recovery. Signed-in password change is implemented.
- PIN, Face ID/fingerprint/passkeys, physical-device binding, location alerts and approval from an already signed-in phone. TOTP and browser-session review are implemented.
- Google/phone-number auth and automatic backend provisioning. Optional Supabase ownership uses guided setup with separate project auth.
- Live user-owned-backend end-to-end testing, real PC/phone synchronization and physical iPhone/Android testing. Policy tests use local PostgreSQL fixtures; live sample flows have been exercised.
- Scheduled independent backups with verified retention/restore. Online saving is implemented; users can download full Excel backups. Provider backups depend on plan/setup.
- Continuous Excel spreadsheet synchronization. Excel/PDF reports are downloaded snapshots; Zoro Excel import is supported.

This is not a completed security audit. No password/authenticator secrets are copied between backends. Keep Confirm email, required TOTP and owner-only data policies enabled.
