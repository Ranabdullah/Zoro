# Security and privacy

Do not post passwords, tokens, real receipts, account balances or private records in issues or pull requests. For a vulnerability, use GitHub's **Security → Report a vulnerability** on this repository. Include a minimal reproduction with fictional data.

Public code does not grant access to wallets. Supabase row-level security and private Storage policies enforce access for a verified owner with TOTP and a valid session. Keep those policies enabled. Only the Supabase project URL and `sb_publishable_...` key belong in a frontend build; these public values are not administrator credentials.

Never commit Supabase secret/service-role keys, database passwords, SMTP credentials, Cloudflare tokens, `.env` files or exported wallets. If one is accidentally published, revoke it immediately; deleting the latest file does not remove Git history or copies.

Project administrators can read data in their project. Zoro is not end-to-end encrypted, independently security-audited, a payment service or a bank connection. Session tokens are held in the current tab's sessionStorage. Infrastructure can process IP addresses. Read [current limitations](zoro/RELEASE-STATUS.md) before using real records.

Downloaded Excel backups are unencrypted and can include receipt images. Store them privately. Deletion from the app does not promise removal from provider backups or retention systems. Online saving is separate from backup; confirm your provider's retention and test restoring an independent backup.

Use a separate staging Supabase project for untrusted changes and PR previews. Do not point an unreviewed build at a production backend. Dependency and SQL tests reduce risk but do not establish complete security or live operational readiness.
