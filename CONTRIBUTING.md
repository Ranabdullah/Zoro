# Contributing to Zoro

Fork the repository and create a branch for your change. Use fictional records and a separate test backend. The `zoro/` directory and `kora_*` SQL names remain for compatibility with existing deployments; the product and public repository are Zoro.

```sh
cd kora
npm ci
npm test
npm run build
npm start
```

Before a pull request, explain the user-visible change, your validation and any setup/migration changes. Include desktop and phone screenshots for layout changes. Update [the setup guide](docs/SETUP.md) when deployment changes, [the data guide](zoro/DATA-GUIDE.md) when export/import changes and [release status](zoro/RELEASE-STATUS.md) when a feature is actually verified.

Edit individual SQL migrations, then regenerate the combined setup with `npm run setup` and run tests. The combined SQL is for new empty projects; document incremental migrations for existing projects. Do not rerun the base schema on a live wallet.

Keep dependencies' notices and licenses. Contributions are supplied under this repository's MIT license. See [SECURITY.md](SECURITY.md) for private vulnerability reporting.
