# Zoro handover

App: https://zoro-personal-wallet.pages.dev/ . Source: https://github.com/Ranabdullah/Zoro . Main source folder: `zoro/`.

Start with **[the complete setup tutorial](../docs/SETUP.md)**. It covers copying/downloading/forking into another GitHub account, installing a new Supabase project, verified email and TOTP, Cloudflare builds/callbacks, and migrating existing records using a full Excel backup.

Use **[GitHub transfer instructions](../docs/GITHUB-TRANSFER.md)** if the owner wants the existing repository itself rather than a fork. Developer service accounts and database records do not transfer with a repository.

Use **[the advanced setup guide](../docs/ADVANCED-SETUP.md)** for Google/SMS, password recovery, one-time authenticator recovery, local PIN/biometric screen locks, new-browser approval/location notices, Microsoft OneDrive reports and encrypted scheduled backups.

Use **[the owner checklist](../docs/HANDOVER-CHECKLIST.md)** to demonstrate signup, empty real wallets, tutorials, two-user privacy, PC/phone sync, receipt photos, reports and a verified restore before handover. Passwords stay with the owner; setup can be guided through their signed-in computer or named collaborator access.

## Daily use

The shared app opens a fictional sample. Create an account, confirm your email and enroll an authenticator to start an empty real wallet. It saves to the configured backend automatically. Record spending or income against the account used; attach photos and notes when needed. Use Settings → Help for the optional tutorial.

Reports downloads Excel/PDF snapshots by date, account or expenses with receipts. Settings → Data management downloads a full private Excel backup, restores it or merges a Zoro transaction report. [Data guide](DATA-GUIDE.md).

## Existing deployments

The main folder is now `zoro/`. Update Cloudflare root to `zoro` when convenient; keep command `npm ci && npm run build`, output `dist`. A tiny legacy-path forwarding build preserves previously configured hosts during the transition. Historical database identifiers are unchanged to preserve saved wallets.

Install incremental migrations only once, in documented order, on existing backends. The full setup.sql is for a new empty project. New provider features still need their external configuration and live validation; consult [release status](RELEASE-STATUS.md). Do not claim every provider flow is active just because the source is public.
