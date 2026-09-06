# Changelog

All notable changes to this application are documented in this file.

## Unreleased (main)

- Consolidated POS printing, client-review polish and `remove-unsent-line` command into `main`; inventory command boundary included. Verified: 285 unit tests, oxlint 0, `tsgo --noEmit` clean.
- Removed stale worktrees/branches (`codex/inventory-live-pilot`, `fix/inventory-client-handoff-ux`, `polish/client-review-v1`, `feature/physical-printing-v1`, `integration/pilot-review*`; superseded baseline tagged `archive/pilot-review-final`).
- Standalone POS gateway: `pos:deploy:build` uses inner-repo Docker context; `.env.example` documents `TWENTY_APP_ACCESS_TOKEN` and `FRONT_AUTO_BASE_URL`.
- Aligned `.nvmrc` to 24.16.0 (matches upstream Twenty checkout).

## 0.1.0

- Initial application scaffolded with [`create-twenty-app`](https://www.npmjs.com/package/create-twenty-app)
