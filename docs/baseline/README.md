# Reconstruction Baseline

Captured: 2026-07-11, Asia/Jakarta.

## Runtime observed

- Node.js: `v26.4.0`
- npm: `12.0.0`
- Project package: `bjb-webapp@0.0.0`
- Bundle target: Node.js 14
- README recommendation: Node.js 16+

Use Node.js 18 or 20 LTS during reconstruction unless compatibility tests require another version. Current Node.js 26 is newer than dependencies and not the compatibility baseline.

## Preserved evidence

- `dist/client`: deployable frontend artifact.
- `dist/server/server.bundle.js`: readable Webpack backend bundle.
- `bjb.sql`: PostgreSQL schema and stored functions.
- Root build scripts and configuration.

Verify artifacts from repository root:

```bash
sha256sum -c docs/baseline/SHA256SUMS
```

## Environment finding

Legacy `.env` contains `JWT_SECRET_KEY`, but bundled server reads `JWT_SECRET`. Without `JWT_SECRET`, bundle falls back to `YOUR_secret_key`. Reconstruction must preserve observed behavior for parity tests, then remove fallback during security hardening.

No environment values or secrets are recorded in baseline documentation.

