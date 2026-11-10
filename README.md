# Kora personal wallet

Private personal-finance app source. The application lives in [`kora/`](kora/).

- [Run locally and features](kora/README.md)
- [Supabase, Google login and Cloudflare setup](kora/HANDOVER.md)
- [Private database schema](kora/supabase/schema.sql)

## Local preview

```sh
cd kora
npm ci
npm run build
npm start
```

Open http://127.0.0.1:4173. This is sample-only until Supabase is configured.

## Deployment

Keep this repository private. Set the host's root directory to `kora`, build command to `npm run build`, and output directory to `dist`. Supply the public Supabase configuration through build variables, never a service-role key. See the handover guide for Google login, invitations and database/storage policies.

After one-time setup, **Actions → Publish Kora → Run workflow** deploys a tested build to Cloudflare Pages. Creating a private repository does not itself make app records private: the Supabase policies enforce that boundary.
