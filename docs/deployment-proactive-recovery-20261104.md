# Proactive V2 recovery production deployment — 2026-11-04

## Release

- Owner authorized production deployment in this session.
- Runtime source: `ee9ee13` (includes `2c7399d` proactive recovery and merge of
  `origin/main` capability guards). Published to main and the working branch.
- Image: `magicbox-web-proactive-recovery:ee9ee13`.
- Image ID: `sha256:03d35983e06d016f72effcef75d8ecd2fec35e368134e21626c4b570863247d8`.
- Immutable source directory: `/opt/magicbox/releases/web-proactive-recovery-ee9ee13`.
- Archive SHA-256: `233aff7950aab03e20ab6448284b6f313c16c4ec4f4ed412589fcedfdf839fdf`;
  local and remote matched before extraction.
- Only `magicbox-web` was recreated. API, Connect, Caddy, validator and manual
  retained their original container IDs.

Selecting and confirming PCB V2 now exposes “Borrar todo y grabar desde cero con
V2.3.24” without requiring a normal-update failure. Explicit erase confirmation,
backup choice, validated recovery package, chip/flash checks and region hash
verification remain. V3 full recovery is not offered. Firmware bytes unchanged.

## Validation

- 49 test files / 209 tests passed; TypeScript and focused ESLint passed.
- Linux Docker production build completed, including Next compilation/typecheck.
- Candidate HTTP check: cable route 200, 16 referenced JS chunks fetched, proactive
  CTA and erase confirmation found in served JavaScript.
- All 12 firmware/recovery assets matched source SHA-256, including the recovery
  manifest. Withdrawn V2.3.18 remains 404.
- Same checks passed against `https://admin.magicbox.education` after activation,
  using the public HTTPS hostname from the production host. The workstation's
  egress proxy denied CONNECT (403), so this is not an independent external-client
  check. No browser interaction or physical flash was performed in this session.
- API `/health` returned 200/healthy. Web running with zero restarts.
- Evidence and gzip-verified off-host rollback:
  `/Users/macbook/dev/magicbox-release-backups/proactive-recovery-20261104/`.

## Compose activation

Keep the original project and all original configuration layers:

```sh
cd /opt/magicbox/deploy/aws-bridge
docker compose -p magicbox-bridge \
  -f docker-compose.ec2.yml \
  -f docker-compose.connect.yml \
  -f docker-compose.web-capability.yml \
  -f docker-compose.api-access-integrity.yml \
  -f docker-compose.web-proactive-ee9ee13.yml \
  up -d --no-deps --no-build web
```

The last override sets only web's source context and image. Existing config and
web.env were backed up privately under `backups/web-proactive-20261104T190103Z/`.

## Rollback

Previous image ID:
`sha256:01c4c6ee9b56f1913b190d71bc77ba6cdee4529048ee292aa9e908fed10814b2`.
Preserved tag: `magicbox-web-firmware-recovery:rollback-pre-proactive-20261104`.
The unchanged original `docker-compose.web-capability.yml` still selects
`magicbox-web-firmware-recovery:c5817b8`, the same previous image.

To revert, run the activation command without the final
`-f docker-compose.web-proactive-ee9ee13.yml` layer. Recheck route/assets/API and
web image ID. Do not rebuild or restart other services for rollback.
