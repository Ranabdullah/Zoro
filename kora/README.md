# Existing-host compatibility only

The application source is **[Zoro, in /zoro](../zoro/)**. New installations use Cloudflare root `zoro`.

This tiny forwarding build keeps older Cloudflare projects working while their saved root setting is updated. It contains no application code or wallet data. Existing hosts can keep their current settings temporarily, or change root to `zoro` and keep build `npm ci && npm run build`, output `dist`.
