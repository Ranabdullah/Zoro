# Zoro owner setup and handover checklist

Use this checklist to install Zoro under a new owner’s accounts and verify the handover. Provider charges, support arrangements and any custom work are agreed privately.

## Agree before starting

- [ ] Owner confirms their GitHub username, desired app name and whether they want a fork/copy or transfer of the existing repository.
- [ ] Agree the setup scope privately: one repository, one Supabase project, one Cloudflare deployment, email-sender configuration assistance, one existing-wallet migration if applicable, and a handover demonstration.
- [ ] Agree who pays provider/domain/email/SMS charges and any ongoing support rate. The MIT source remains freely available; payment covers your setup service.
- [ ] Explain data privacy: project administrators can access records. Decide whether the owner grants you temporary collaborator access or operates their computer while you guide them. Passwords stay private.

## Owner's accounts

- [ ] GitHub account created and protected with MFA.
- [ ] Zoro source forked/copied to their account; LICENSE retained.
- [ ] Cloudflare account ready; authorize only the needed GitHub repository.
- [ ] Dedicated empty Supabase project ready; owner retains database password.
- [ ] Verified SMTP sender/domain ready. Owner enters credentials directly in Supabase. Their personal mailbox password is not required.

## Install

- [ ] Full setup.sql run once without errors on the new empty project.
- [ ] Email registration, Confirm email and TOTP enabled; password minimum set.
- [ ] Cloudflare main/root zoro/build npm ci && npm run build/output dist/Node 22 configured.
- [ ] Public project URL and publishable key configured as build variables.
- [ ] Build succeeds and final HTTPS link opens.
- [ ] Supabase Site URL and exact redirect point to that final link.
- [ ] Sensitive service keys and exports excluded from GitHub.

## Demonstrate using fictional test data first

- [ ] Confirmation email arrives at an address outside the Supabase project team.
- [ ] Owner sets up their own authenticator; no one stores their setup secret in notes or screenshots.
- [ ] New real account starts empty; tutorial can be skipped and reopened in Help.
- [ ] EUR 100 minus EUR 12.34 shows EUR 87.66.
- [ ] Money in source and amount save to the right account.
- [ ] Receipt photo, notes, debt and custom card image save.
- [ ] A separate verified account cannot see the owner's records.
- [ ] PC and physical phone show the same current records after refreshing.
- [ ] Excel/PDF date/account/receipt filters produce the expected amounts.
- [ ] Full Excel backup downloads; restore is tested in an empty test wallet.
- [ ] Any existing wallet is backed up, restored and verified before old data/access is removed.
- [ ] Security options enabled for this deployment are exercised on the owner's real devices. Do not describe provider-dependent features as verified until tested.

## Leave the owner with

- [ ] Their app URL and GitHub URL.
- [ ] This guide, SETUP.md, DATA-GUIDE.md and current release limitations.
- [ ] Account ownership, billing and collaborators reviewed.
- [ ] A private full wallet backup and a clear backup schedule.
- [ ] Explanation that downloading a backup does not automatically upload it to GitHub. Never commit wallet exports.
- [ ] Clear support scope, end date and any outstanding configuration recorded in writing.

Do not tick a box just because its button exists. Test the actual behavior. Do not claim guaranteed security, delivery, uptime, recovery or automatic backups.
