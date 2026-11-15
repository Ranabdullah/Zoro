# Advanced Zoro setup

This guide completes the provider-dependent parts of the source. **A button or passing unit test does not prove that a service is live.** Complete the basic [SETUP.md](SETUP.md) first, then configure only the integrations you want. Keep all secrets out of the repository, screenshots and chat.

## Upgrade an existing installation

Back up the database, receipts and a per-wallet full Excel export. The new source requires these incremental migrations, in order, after the previous six migrations:

1. `zoro/supabase/phone-auth.sql`
2. `zoro/supabase/device-approval.sql`
3. `zoro/supabase/recovery-codes.sql`

New empty projects use the complete `zoro/supabase/setup.sql` instead. Do not run the base schema again on a populated project. Deploy the matching frontend after the migrations. The existing hosted demo is not proof these migrations have been installed in your own project.

## Password recovery and email delivery

1. Configure a verified SMTP sender in Supabase. Its default mailer is not a general public registration service.
2. Keep the production Site URL as `https://YOUR-APP.pages.dev/`.
3. Add these redirects to Supabase URL Configuration:

```text
https://YOUR-APP.pages.dev/
https://YOUR-APP.pages.dev/?reset=password
```

4. If using the shared frontend with a different user-owned backend, recovery links include that project's public URL/key. In that destination project, allow `https://YOUR-APP.pages.dev/**` to cover its query-bearing callbacks. This wildcard stays on your exact trusted HTTPS hostname; do not allow arbitrary hosts. Its URL/key are public configuration, never a service-role secret.
5. In Zoro, select Forgot password, request an email and open the link in the same browser that requested it (PKCE). Verify the authenticator, choose a new password and sign in again.
6. Test invalid, expired and previously used links. A query parameter alone does not authorize a password reset: the SDK must report a real recovery event.

No one needs the client's mailbox password. The owner supplies an app email sender; users control their own login credentials.

## Google sign-in

1. Create a Google Cloud OAuth client for a web application under the owner's Google Cloud project. Configure the consent screen and allowed users as appropriate for the launch status.
2. Copy **Supabase's displayed Google callback URL** (normally `https://PROJECT.supabase.co/auth/v1/callback`) into the OAuth client's authorized redirect URIs.
3. Enter the Google client ID and secret directly in Supabase → Authentication → Providers → Google and enable the provider. The Google secret stays in Supabase, not Cloudflare frontend variables.
4. In Cloudflare build variables set `ENABLE_GOOGLE_AUTH=true` and redeploy. The Continue with Google button is hidden otherwise.
5. Sign in with Google and then enroll/verify Zoro's TOTP. Social sign-in does not bypass wallet MFA.
6. Test PC and phone with a real configured Google project. A user-owned secondary backend continues to use its separate project login; deploy it as the primary backend for its own configured social providers.

## Phone-number sign-in

1. Enable the Phone provider in Supabase and configure a supported SMS sender. Enter SMS provider secrets there. Set sensible rate limits and review provider costs/anti-abuse controls before opening public SMS signups.
2. Apply `phone-auth.sql` so a **confirmed phone**, not an unverified number, is accepted for first-factor identity. Wallet access still requires TOTP and a valid/approved session.
3. Set `ENABLE_PHONE_AUTH=true` in Cloudflare and redeploy. Otherwise the SMS button stays hidden.
4. Use international E.164 format, such as `+353...`, request the SMS code, verify it and complete TOTP.
5. Test wrong/expired codes, rate limits and that a phone-only login without MFA cannot read or save records.

## PIN, fingerprint, Face ID and Windows Hello

Open Settings → PIN and device screen lock after signing in:

- Set a 6–12 digit local PIN. Zoro stores a salted PBKDF2 verifier, not the PIN itself, and throttles repeated UI attempts.
- Or enable the platform authenticator through WebAuthn. The device chooses Touch ID, Face ID, Windows Hello or another available verification method. Zoro checks the returned origin, challenge, user-verification flags and signature. It never receives biometric templates.
- The local lock hides the wallet on backgrounding or five minutes idle. Sign out is available if you forget the local PIN. Remove/change lock settings from an unlocked authenticated session.

This is a **local screen privacy control**, not a replacement for server-side sign-in. Clearing browser storage or modifying a compromised browser can bypass a local screen lock. Platform passkeys may sync between devices, so do not describe them as guaranteed hardware binding. HTTPS and browser/platform support are required; unsupported browsers can use a PIN. Test on the owner's physical devices.

## Approve a new browser from an existing phone or PC

1. Install `device-approval.sql`. In an authenticated browser open Settings → New-browser approval.
2. Turn on Require approval for unfamiliar browsers. The current verified browser is registered first. Keep it available; do not clear its browser storage before preparing recovery codes.
3. On another browser/device, complete first-factor login and TOTP. It will wait for approval without access to the wallet.
4. On the approved phone/PC, keep Zoro open. An in-app notice appears when a pending request is detected. Open the approval list, check the browser label and approximate location, then approve or reject it.
5. The new browser selects Check approval. Requests expire after 15 minutes; start a new sign-in if expired.
6. Revoke another browser in that same list. Server policies deny its subsequent wallet/receipt requests. Already downloaded copies cannot be recalled.

Cloudflare's `functions/api/location.js` supplies an approximate city/region/country for the caller. It does not return/store the raw IP. VPNs and network routing can make the location wrong. Browser labels and reported locations are informational, not proof of identity. Notices appear **inside an open app**, not as push notifications to a closed phone. The trust token is browser-specific and requires normal auth/MFA; it is not a physical hardware guarantee.

## One-time authenticator recovery codes

Recovery-code generation requires an approved MFA session. Codes are hashed in the database and displayed only when generated. Store them privately; never in GitHub. Regeneration invalidates the old set.

### Deploy the recovery service

The owner installs the Supabase CLI from its official instructions, signs into their own Supabase account and links their project. From the `zoro` directory:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set APP_ORIGINS=https://YOUR-APP.pages.dev
supabase functions deploy recover-account --no-verify-jwt
```

For multiple exact app origins, supply a comma-separated APP_ORIGINS value. Do not add arbitrary origins. Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` **inside the Edge Function runtime**. They must not be placed in browser code. Verify those runtime values are available in your project.

The gateway JWT check is disabled for compatibility with current signing keys; the function itself calls Supabase `getUser` to verify the supplied access token on **every request**. It also requires a confirmed identity, exact allowed origin and valid one-time code. Do not remove these checks.

### Use and test recovery

1. In Settings → Authenticator recovery codes, generate and privately store the codes.
2. In a test account, sign out, sign in with the first factor and select Lost your authenticator.
3. Enter one code. The service consumes it, removes old factors and browser approvals, invalidates remaining recovery codes and revokes sessions.
4. Sign in again and enroll a new authenticator. Generate new recovery codes.
5. Verify a reused code, another user's code and five failed attempts are denied. Five failures trigger a one-hour server-side wait.

A partial provider error can consume a code before all factor-reset steps complete. Follow the error and have the project owner review it; do not weaken MFA or grant account access based only on an email request. Without saved recovery codes, use an identity-verified owner recovery procedure. This is security-sensitive: test it in staging first.

## Online Excel workbook in OneDrive

Downloaded Excel/PDF reports always work without Microsoft setup. The optional connection adds a **one-way report update** to a private workbook in the user's OneDrive. It does not read manual Excel edits back into Zoro and excludes receipt photo binaries.

1. Register an application in the owner's Microsoft Entra account. Support the intended organizational/personal Microsoft account types.
2. Add a **Single-page application (SPA)** redirect URI:

```text
https://YOUR-APP.pages.dev/excel-callback.html
```

3. Add delegated Microsoft Graph `Files.ReadWrite` permission. This permits file writes in the signed-in account; the user must consent. No client secret belongs in a SPA.
4. Set Cloudflare build variable `MICROSOFT_CLIENT_ID` to the public Application (client) ID, then redeploy.
5. In Zoro Settings → Excel online, choose Connect Microsoft and send my report. Sign into **your** Microsoft account and consent. Zoro creates a uniquely named workbook, avoiding an existing report filename.
6. Update manually, or enable Update after changes while this browser is connected. Changes are sent after a short debounce. App database saves remain independent: Microsoft failure never pretends the wallet save failed or loses the recorded entry.
7. Disconnect to stop updates. Sign-out/account switching also disconnects the workbook. If access expires, reconnect interactively; background sync will not open unexpected login popups.

The workbook is not publicly shared by Zoro, but Microsoft tenant policies and existing sharing settings still apply. Check them. Multiple browser sessions can maintain different generated workbook files; choose one active sync browser if you need one canonical report. This is not a bidirectional accounting integration or a closed-app server sync.

Official references: [MSAL initialization](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/initialization), [Graph workbook file upload](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content).

## Encrypted scheduled owner backups

Online saves and manual full Excel backups already exist. The optional GitHub workflow adds a separate encrypted snapshot of all vaults and receipt files in a **single configured Supabase project**. It includes a user-ID/email/phone mapping but not passwords, auth factors, provider configuration or connected secondary projects. Those need separate backups.

### Keep the private decryption key offline

On the owner's PC, create a private folder outside the repository. Generate an RSA keypair using Node (or the owner's trusted key-management tool):

```sh
node -e "const c=require('node:crypto'),f=require('node:fs');const k=c.generateKeyPairSync('rsa',{modulusLength:3072,publicKeyEncoding:{type:'spki',format:'pem'},privateKeyEncoding:{type:'pkcs8',format:'pem'}});f.writeFileSync('Zoro-backup-public.pem',k.publicKey,{flag:'wx'});f.writeFileSync('Zoro-backup-private.pem',k.privateKey,{flag:'wx',mode:384});"
```

Run this **in the private folder, not the source repository**. Restrict OS file permissions and retain an offline/password-manager backup of the private key. The public key alone cannot decrypt a backup. If the private key is lost, encrypted snapshots cannot be recovered. If it is stolen, rotate keys and assess existing archives.

### Configure the owner's GitHub

1. In the owner's repository, create an Actions environment named **backups**. Restrict it to the `main` branch and review who can merge changes.
2. Add environment variable `SUPABASE_URL` and environment variable `BACKUP_PUBLIC_KEY` containing the public PEM text.
3. Add environment **secret** `SUPABASE_SERVICE_ROLE_KEY` for that project's administrative API key. This server-side secret is used only by the backup workflow and has broad access. Keep it out of source, frontend builds and chat.
4. Add repository Actions variable `ZORO_BACKUPS_ENABLED=true` to opt in. The job is otherwise skipped. Enable Actions/scheduled workflows in forks explicitly if needed.
5. Run **Actions → Encrypted Zoro backup → Run workflow**. Check success and download the encrypted artifact. It contains RSA-OAEP-wrapped AES-256-GCM encrypted/compressed data; no plaintext wallet snapshot is uploaded as an artifact.
6. Test decryption with your offline private key before trusting the schedule. The workflow requests a daily run at 03:23 UTC with 14-day artifact retention. GitHub scheduling is best-effort and public-repository scheduled workflows can be disabled after inactivity; monitor actual runs and failures. It is not a backup SLA.

Keep the private key out of GitHub, even as a workflow secret: only the offline owner needs to decrypt. Service-role backup access and review of workflow changes are serious responsibilities. Use provider-managed backups as another layer if your plan supports them.

### Decrypt and restore

Download an encrypted artifact to the private folder. From a source checkout:

```sh
node zoro/scripts/decrypt-backup.mjs /PRIVATE/backup.json /PRIVATE/Zoro-backup-private.pem /PRIVATE/Zoro-decrypted.json
```

On Windows use full quoted Windows paths. Decryption refuses to overwrite an existing output file. The output is **plaintext private data**: never commit or share it.

For a same-project owner restore, pause user edits, back up the current destination and set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in a private local shell. First run a dry check from `zoro`:

```sh
node scripts/restore-backup.mjs /PRIVATE/Zoro-decrypted.json
```

It validates that snapshot owner UUIDs exist. Add `--apply` only after reviewing: this overwrites matching vaults/receipt paths and increments revisions. It is not a single atomic provider restore; a failure needs review before retrying. Verify data before reopening the app. Snapshot collection is also not a cross-service transaction: avoid concurrent edits and investigate any missing-photo/collection failure.

A new Supabase project has different users/auth data. Prefer each owner's **full Excel backup and restore** for ordinary migrations. The administrative restore script does not silently map identities or recreate passwords. Cross-project administrator restoration requires recreating/mapping appropriate user IDs and explicit `--allow-new-project`; obtain owner approval and test in staging.

## Services and real-device verification

SMTP, OAuth, SMS, Microsoft consent, scheduled backup secrets and actual hardware cannot be completed by adding source code alone. Complete and record the owner's live tests on their PC and phone. The bundled UI/data-policy tests are evidence of implementation behavior, not proof of these external services.

Zoro supports the Supabase data/auth contract. An arbitrary third-party backend requires a provider-specific adapter and a defined authentication/data contract; the app does not claim automatic compatibility with every service. Physical-device binding, zero infrastructure IP processing and guaranteed phone biometrics are not promises a normal browser app can make.
