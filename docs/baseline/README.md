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

These files were copied out of the old deployment by hand, not produced by this
repository's build. `npm run build` writes to `build/`, so treat this folder as a
frozen snapshot: never regenerate it, never serve it.

- `dist/client`: the old web bundle, kept as the reading reference for
  `docs/reconstruction/client-*.md` (they cite byte offsets in it).
- `dist/server/server.bundle.js`: the old server bundle; the parity suite runs
  it as the legacy side of its differential tests.
- `bjb.sql`: the old PostgreSQL dump. It is no longer in the repository; the
  numbered migrations in `database/migrations/` are now the source of truth.
- Root build scripts and configuration.

Verify artifacts from repository root:

```bash
sha256sum -c docs/baseline/SHA256SUMS
```

## Environment finding

Legacy `.env` contains `JWT_SECRET_KEY`, but bundled server reads `JWT_SECRET`. Without `JWT_SECRET`, bundle falls back to `YOUR_secret_key`. Reconstruction must preserve observed behavior for parity tests, then remove fallback during security hardening.

No environment values or secrets are recorded in baseline documentation.

