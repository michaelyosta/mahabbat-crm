# Distribution Decision

Status: **NOT DISTRIBUTED** — decided 2026-08-18 (PRE-POS hardening).

## Summary

The Mahabbat app is not published to any npm registry, marketplace, or public
host. The only `yarn twenty app:*` releasable artifact is produced on demand
against the disposable local dev server. **No production distribution exists
and none is wired up by this repository.**

## Distribution channels

| Channel | Status | CDN/registry target |
| --- | --- | --- |
| `packages/twenty-apps` marketplace claim | Not claimed | n/a |
| npm `app:publish` | Gated (never run) | n/a |
| Self-hosted `:3000` (local production-like container) | Internal only | localhost |
| Disposable `:2020` dev container | Development only | localhost |
| SaaS / hosted Twenty | Not configured | n/a |

## Security posture

- `cd.yml` deploys only on `workflow_dispatch` to the exact `target_url`
  supplied by the operator; it is gated by the `production` GitHub Environment
  (required reviewers + environment-scoped `TWENTY_DEPLOY_API_KEY`).
- `publish.yml` refuses to publish unless the requested version exactly matches
  `package.json` version (gate verified in-workflow before `app:publish`).
- No secrets, real customer data, or POS/iiko access are ever committed.
- Live CD verification is impossible by design: there is no external target and
  no API key in this repository.

## Change ownership

Revisiting this decision (e.g. enabling a marketplace claim or an external
host) is out of scope for the PRE-POS hardening phase and requires explicit
product sign-off before any workflow wiring.