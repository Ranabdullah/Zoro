# Zoro

Live app: https://zoro-personal-wallet.pages.dev/

A personal finance app for Ireland and accounts back home. The product is Zoro; the source directory and existing database names retain kora for compatibility.

Run locally with Node.js 22+: npm ci, npm run build, npm start. Open http://127.0.0.1:4173/. Without backend configuration, fictional preview records stay in memory and reset on reload.

Included: responsive wallet cards, optional tutorials, empty real wallets, verified email/password and TOTP, manual accounts/income/expenses/receipts/debts, exchange estimates, card colours/patterns/uploads, Excel/PDF reports and receipt filters, full Excel backups/imports, deletion controls and session review.

Normal sign-in automatically connects to the managed backend. Settings also offers guided connection to a user-owned Supabase project. Its separate sign-in is required; passwords are never copied. The project choice is stored against the Zoro ID after authenticated verification. A full backup/restore explicitly copies records to the new wallet.

Private GitHub and Cloudflare automatic builds are configured. See HANDOVER.md for setup, DATA-GUIDE.md for backups and RELEASE-STATUS.md for limitations. Public signup still needs a verified SMTP sender. This app does not move money, link banks or provide a continuous live Excel connection.

Tests cover calculations, report round trips, receipt filters, card contrast, safe backend configuration and PostgreSQL access policies. Local fixtures and live sample UI checks do not replace real account, mail delivery or physical-device testing.
