# Zoro

Source and development live here, in `zoro/`. Start with the root [README](../README.md).

- [Complete installation tutorial](../docs/SETUP.md)
- [Advanced services, security and backups](../docs/ADVANCED-SETUP.md)
- [GitHub copy/transfer](../docs/GITHUB-TRANSFER.md)
- [Daily records and data management](DATA-GUIDE.md)
- [Release readiness and limitations](RELEASE-STATUS.md)

Run `npm ci`, `npm run setup:check`, `npm test`, `npm run build`, then `npm start` with Node.js 22+. Open http://127.0.0.1:4173/. Without public backend configuration the sample stays in memory and resets on reload.

The Cloudflare build uses root `zoro`, command `npm ci && npm run build`, output `dist`. Provider secrets never belong in the frontend. See the complete guides for exact configuration and owner acceptance checks.
