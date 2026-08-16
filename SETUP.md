# Setup

Follow these steps to get your app running locally.

## Prerequisites

- Node.js (version specified in `.nvmrc`)
- Yarn 4
- Docker (to run the local Twenty server)

## Steps

1. Install dependencies:

   ```bash
   yarn install
   ```

2. Start the local Twenty server:

   ```bash
   yarn twenty docker:start
   ```

   Check the server status at any time with `yarn twenty docker:status`.

3. Start the development server and sync your app:

   ```bash
   yarn twenty dev
   ```

4. Open [http://localhost:2020](http://localhost:2020) and sign in with a
   local development account configured in your disposable Twenty instance.
   Do not commit or share its password.

## Environment variables

API-backed seed, identity smoke, aggregate import and integration tests require
credentials to be supplied only through the environment:

```text
TWENTY_API_URL=http://localhost:2020
TWENTY_API_KEY=<local disposable API key>
MAHABBAT_API_URL=http://localhost:2020
MAHABBAT_API_KEY=<local disposable API key>
```

Use the corresponding private self-hosted values only when explicitly working
against `:3000`. Never place real values in this repository or in shell history
that will be captured by CI.

## Verifying your setup

- `yarn lint` - Lint the project with oxlint
- `yarn typecheck` - Type-check the project
- `yarn test:unit` - Run unit tests
- `yarn test` - Run integration tests

## Troubleshooting

See the [troubleshooting guide](https://docs.twenty.com/developers/extend/apps/getting-started/troubleshooting) or ask on [Discord](https://discord.gg/cx5n4Jzs57).
