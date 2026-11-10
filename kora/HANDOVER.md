# Kora setup and handover

## The agreed setup

You maintain the source in your GitHub repository. Cloudflare serves the app. A single Supabase project handles Google login, private records and receipt photos. He opens the same HTTPS link on his phone or PC and uses the same Google account. He does **not** need a Supabase developer account to use Kora.

Start with hosting and Supabase in your accounts if you prefer. A later transfer to accounts he owns is an administrative task; changing his Google login is not a backend transfer. This version has no user-facing backend settings, and no automatic project/data migration.

## 1. Put the source on GitHub

Create a private repository and add the contents of the `kora` folder, including its `.gitignore`. If you upload the entire parent workspace instead, the project will be under `kora/` and Cloudflare's root directory must be `kora`.

Do not upload `node_modules`, `.openai`, `.env` files, actual receipts, exports, user emails or personal test records. Generated `dist/config.js`, `dist/cloud.js` and `dist/fonts` are ignored; the build creates them. Keep `package-lock.json` committed.

## 2. Create the backend once

1. Create a new Supabase project in your account. Choose a suitable region and a strong database password; retain it in your password manager.
2. In SQL Editor, run `supabase/schema.sql` **once on a new project**. It creates the private vault, invitation allowlist, controlled save function, and private receipt bucket.
3. Open `supabase/invite.sql`, replace the example with his actual Google email and run that statement privately. Do not commit the real email. Add your test email separately if you need a test account; each user receives separate records.
4. In Supabase API settings, obtain the project URL (`https://PROJECT.supabase.co`) and **publishable** key (`sb_publishable_...`). These two values configure the browser. They are not privileged secrets. The build refuses service-role/secret keys.
5. Never put the database password, Supabase service-role/secret key, or Google client secret in the source, browser configuration, GitHub or a chat.

Access is enforced in the database, not by hiding buttons. Only verified, invited users can read or save their own vault and their own receipt folder. An uninvited Google account may create an authentication identity, but cannot access app records. There are no anonymous table read/write grants. Receipt buckets must remain private.

## 3. Enable Google sign-in

Follow [Supabase's Google sign-in instructions](https://supabase.com/docs/guides/auth/social-sign-in/auth-google).

1. Create a Google OAuth web client and configure its consent screen.
2. Set its authorized redirect URI to the callback URL shown in Supabase's Google provider settings, normally `https://PROJECT.supabase.co/auth/v1/callback`.
3. Enter the Google client ID and secret **in Supabase's provider settings only** and enable Google.
4. Configure consent-screen test users if the Google application is in testing mode. His email must be included while that mode applies.
5. In Supabase Auth URL Configuration, set the final HTTPS app origin as the Site URL and add the exact app callback URL ending `/` to the allowed redirects. For local development, separately allow `http://127.0.0.1:4173/`.

Kora uses the SDK's PKCE flow and sessionStorage. Sessions survive refreshes in the current tab, but closing the tab/browser may require signing in again. Passwords are not stored by Kora. Google users use Google's own account protection; enable two-step verification on the Google account. A short visible backend PIN is not used as an authentication mechanism.

The email/password fallback is for already-provisioned, confirmed users. There is no public email signup or password-reset screen in this version. Use Google for the simple primary experience; do not give him an administrator's password. SMS/phone login is not implemented.

## 4. Host with Cloudflare Pages when ready

Nothing has been published for you. When you decide to deploy:

1. Connect Cloudflare Pages to your private GitHub repository.
2. Select no framework preset. Use root directory `kora` only if that folder is inside the repository; otherwise leave the root blank.
3. Build command: `npm run build`. Output directory: `dist`. Use Node.js 22 or newer.
4. Add build environment variables:
   - `SUPABASE_URL`: your project URL.
   - `SUPABASE_PUBLISHABLE_KEY`: its `sb_publishable_...` key.
5. Deploy, then set the exact HTTPS origin in Supabase's Auth URL Configuration as described above. Rebuild after changing the two frontend environment variables.
6. Verify `_headers` is applied, including CSP, no-store and anti-framing headers. If using another host, explicitly reproduce those headers; GitHub Pages does not apply this Cloudflare `_headers` file.

Do not connect untrusted pull-request previews to the production backend. A preview uses a separate test project or no backend. Keep deployment changes reviewed, since the deployed frontend is trusted with the signed-in user's session.

Reference: [Cloudflare Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/).

## 5. Verify before real use

- Open on PC, sign in with an invited Google account, add an account with €100 and record a €12.34 expense. The balance must be €87.66.
- Sign in with the same account on the phone. Check the balance and receipt photo. Updates refresh when the tab becomes visible or within 30 seconds; Settings also has Refresh.
- Add a second account using NGN/KES/GHS/etc. Its expense must affect only that account. Check the original amount, euro estimate and source rate date.
- Sign in with a separate invited test identity. It must start empty and must not access the first user's vault or receipt paths, even via direct API requests.
- Test with no login and an uninvited login. Database writes and receipt reads/uploads must be denied. Inspect this directly in a dedicated staging project; UI hiding is not enough.
- Open two devices, edit at the same time, and check that a stale save produces a conflict instead of silently replacing newer records. The form retains its inputs and allows a reviewed retry.
- Upload a harmless test receipt. Confirm the bucket is private and the public storage URL cannot retrieve it. Photos are re-encoded to remove original image metadata; receipt text itself can still contain sensitive details.
- Disconnect the internet and try saving. It must show a failure, not a success. Restore the connection and retry.
- Sign out and ensure the account data disappears. Check mobile layout and the phone camera/file picker on the actual phone.
- Review Supabase Security Advisor, auth rate limiting and backup settings. Confirm a restore process before depending on the app for your only financial records.

These live checks have not been run because no project or account credentials were provided.

## One-click updates after the first setup

The repository includes **Actions → Publish Kora → Run workflow**. This runs tests, builds the configured app, then uploads it to Cloudflare Pages. It runs only from `main`; it does not publish pull requests or unconfigured sample mode.

Configure the following once in the GitHub repository's `production` environment:

| Setting                    | Store as                                                        |
| -------------------------- | --------------------------------------------------------------- |
| `SUPABASE_URL`             | Variable                                                        |
| `SUPABASE_PUBLISHABLE_KEY` | Variable (public key, not privileged)                           |
| `CLOUDFLARE_ACCOUNT_ID`    | Variable                                                        |
| `CF_PAGES_PROJECT`         | Variable (existing Pages project name)                          |
| `CLOUDFLARE_API_TOKEN`     | Secret (restricted to Pages deployment in the intended account) |

Use either this manual workflow or Cloudflare's automatic Git builds as your primary publishing route. The first setup still needs provider sign-in, an approved Supabase project, its database schema, invited email, and Google OAuth configuration. There is no honest one-click way to skip the account owner approving those connections.

Keep the parent repository structure when uploading: `.github/` at the top, app code under `kora/`. The workflows use `kora` as their working directory.

## Wallet controls

Tap a stacked card or the matching account row to open its details. The view shows only that account's activity and attached receipts. **Edit card** changes its name, provider, account type, optional last four digits, colour and pattern. It leaves the currency and starting balance unchanged. Every appearance change is saved with the same private records when online. Last four digits remain hidden until explicitly revealed inside the account view.

## Privacy boundaries, plainly stated

- Supabase's publishable key is intentionally readable in the browser; its security depends on access policies. Privileged keys must never be there. [Supabase key guidance](https://supabase.com/docs/guides/getting-started/api-keys).
- This is access-controlled storage, **not end-to-end encryption**. Supabase project owners/admins can access records. If he must be private from you, he should own the backend, and stronger end-to-end encryption would be a separate feature.
- Hosting, authentication and rate services necessarily receive network connections and may process IP addresses. No web app can guarantee zero IP exposure to its infrastructure. This app has no analytics, third-party fonts or ads.
- Exchange requests contain currency codes only, not balances, receipts or account names. The browser fetches the latest available [Frankfurter reference rates](https://frankfurter.dev/); the service sees the network request. Figures are estimates, not bank/payment offers. No API key is required for that feed.
- Session tokens live in sessionStorage, accessible to trusted app JavaScript. CSP and local dependencies reduce exposure, but cannot make malicious deployed code or a compromised device safe. This version does not use a server-side HttpOnly-cookie session architecture.
- Only nicknames, provider labels and optional last four digits are needed. Never add full card numbers, CVVs, PINs, online-banking passwords or account credentials to notes or photos.
- The records download is plaintext and excludes online receipt photo binaries. Keep it private; use a proper Supabase database/storage backup for a complete backup. An export/import migration tool is not included.
- The vault has a 2 MB JSON record limit; receipt images are separately capped at 2 MB each after resizing. It is a small personal app, not an unlimited accounting system.

## His daily instructions

1. Open your Kora link and choose **Continue with Google**.
2. Add each account once: a name, provider, currency and current balance. Ireland is EUR; your other accounts keep their own currencies.
3. After shopping, choose **Add expense**, enter the shop and amount, and select the account used. A photo or note is optional.
4. Use **Accounts → Add money received** for income. Recording an entry does not move actual money.
5. Open the same link and sign in with the same Google account on your other device.

Only give him the app link and these daily instructions. Developer accounts and backend settings stay out of his everyday flow.
