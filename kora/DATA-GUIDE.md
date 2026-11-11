# Zoro reports and data controls

Open **Reports** to download an Excel workbook or PDF for the selected date range. Reports include date-first transactions, currency totals and spending charts. Currencies stay separate; receipt counts and notes are included, but receipt photos are not embedded in reports.

Open **Settings → Backup, import or remove data** for these options:

- **Full Excel backup:** saves accounts, entries, debts and receipt images in a Zoro restore workbook. Keep this file private: it is not encrypted and does not include your password or authentication settings.
- **Restore Zoro backup:** replaces the current wallet with a Zoro full backup. Download a backup of the current wallet first when prompted.
- **Import Zoro transaction report:** merges transactions from the app's Excel reports. Existing entry references are skipped. Missing account names and currencies create accounts with a zero opening balance; review those balances afterwards. Arbitrary third-party Excel layouts are not supported.
- **Remove data:** remove one record using its delete button, or choose a whole section or all wallet data here. Removing an account also removes its transactions; receipt images remain available with their transaction link cleared. Removing transactions also clears their receipt links.
- **Delete account:** signed-in users can permanently remove their own receipt files, wallet and sign-in account. Wallet deletion alone keeps the sign-in account. Both actions offer a backup and require typing DELETE.

Excel imports are limited to 25 MB. Review the preview counts and replacement warning before confirming. Import a full backup to restore receipt photos; transaction reports restore only transaction data. Photos use the app's JPEG format.

## Backend setup for another installation

After the existing schema, access-hardening, session-security and public-registration migrations, apply `supabase/delete-account.sql` in the chosen Supabase project. It grants authenticated users an MFA-protected function that deletes only their own identity. Receipt files must first be removed through the authenticated Storage API. The current hosted project has this migration installed.

Cloud provider retention and backups may retain deleted data according to the provider's policies; these controls remove it from the active app and account.
