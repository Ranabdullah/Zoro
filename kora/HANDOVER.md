# Zoro handover

Primary app: https://zoro-personal-wallet.pages.dev/ . Cloudflare project zoro-personal-wallet builds automatically from the private repository. Supabase Site URL and exact redirect include this new address. The previous kora-personal-wallet.pages.dev deployment remains available; both use the same managed backend.

## Daily use

Open the app link and explore the fictional sample wallet. Choose Create an account, confirm your email and set up an authenticator. A real wallet starts empty and connects automatically to the managed cloud. Public confirmation email delivery requires the app owner to configure a verified SMTP sender.

Add each account once with its currency and current balance. Record expenses against the account used and attach receipt photos. Use Money in for salary and other income sources. Sign into the same account on PC and phone; records refresh on returning to the page, within 30 seconds, or through Settings -> Refresh.

Tutorials are optional, accessible from the empty-wallet prompt and Settings -> Help. Reports offers Excel/PDF snapshots filtered by dates, account or expenses with receipts. DATA-GUIDE.md explains full backup/restore and deletion. Keep downloaded backups private: they are unencrypted.

## Optional user-owned Supabase

1. Under Settings -> Cloud connection settings, expand Use a Supabase project I own. Ordinary users can simply keep using the managed backend.
2. Create a dedicated, empty Supabase project. Protect the owner account with MFA; keep its database password private.
3. Download Zoro-Backend-Setup.sql from the app and run it once in the project's SQL Editor. It combines schema, access-hardening, session-security, public-registration, delete-account and backend-links migrations. Use a new project, not a populated database.
4. Enable email registration, Confirm email, TOTP and minimum 12-character passwords. Configure custom SMTP directly in Supabase. Set the app's exact HTTPS origin as Site URL and its trailing-slash URL as an allowed redirect.
5. Download a full Excel backup before switching. Enter only the project URL and sb_publishable_ key in the app. Never enter database passwords, service-role/secret keys or SMTP credentials.
6. Continue to the destination project's separate sign-in. Register there if needed, confirm email and complete MFA. Only then is the project choice remembered against the central Zoro ID.
7. Restore the full backup in the destination wallet. Records stay in the old project until explicitly removed. Verify the new copy before deletion.
8. Another device signs into Zoro first, which selects the remembered project, then authenticates separately to that project. Return to Zoro cloud clears the remembered choice without deleting the destination records.

There is no one-tap creation of Supabase accounts, billing or projects. Only hosted Supabase projects with this schema are supported; arbitrary backends need adapters. Public project URL/key are connection settings, not privileged secrets.

Deleting a wallet account in a user-owned project deletes that project's sign-in and wallet, and disconnects it. The central Zoro identity and any previous managed-cloud records remain. Return to managed Zoro cloud to delete those separately.

## Deployment

Private repository: https://github.com/Ranabdullah/kora-personal-wallet

Cloudflare Git builds: main branch, root kora, command npm ci && npm run build, output dist, Node.js 22+. Public build variables: SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY. Privileged credentials must stay out of source and chat. Root .github contains CI and Publish Zoro. Generated config, bundles, setup.sql, local test files and environment files are ignored.

Existing managed project: puakjcsnyhibxgdhurwm. Internal kora_* names preserve existing records. backend-links.sql was installed on 12 November 2026. New projects use the app's complete setup SQL. Update Supabase Site URL/allowed redirects when changing the public address. Existing per-tab sessions do not transfer across origins; sign in again at the new address.

## Privacy and limits

Database and private Storage policies require confirmed email, MFA and an owner session. Project admins can read project data: this is access-controlled storage, not end-to-end encryption. Users needing separation from the developer should own their backend.

Infrastructure receives network connections and may process IP addresses. There are no analytics, ads or remote fonts. Exchange requests contain currency codes only. Browser auth tokens use per-tab sessionStorage; sessions are not bound to physical devices.

Use nicknames and optional last four digits. Never add full card numbers, CVVs, bank PINs, passwords or credentials. Card and receipt images are JPEG-reencoded without original file metadata. The vault JSON limit is 2 MB; card designs count toward it. Receipt images are separate and capped at 2 MB each. Excel import accepts up to 25 MB. Provider retention/backups may outlast deletion from active app storage.

Online saving/sync is not an independent backup. Download full Excel backups regularly, especially before import, migration or deletion. Managed database backup retention depends on the Supabase plan; do not claim a guaranteed scheduled backup without configuring and testing it. Keep a verified backup before using this as the sole record of finances.
