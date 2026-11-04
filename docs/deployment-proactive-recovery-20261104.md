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

## Recovery port hotfix — 2026-11-04

The operator reported `SerialPort: The port is already open` on recovery. Review
found recovery skipped transport cleanup when `main()` failed after opening the
port, used `no_reset` despite starting from running/blank boards, and compared
chip descriptions to the literal `ESP32` instead of accepting classic PICO/D0WD
models. Runtime hotfix `f3217ea` fixes these and clarifies pre-erase failures.

- Regression uses actual ESPLoader.main/connect and Transport with a fake serial
  device and failed hardware sync. Restoring the old conditional cleanup makes
  it fail with the port still open; fixed code closes/unlocks it on both retries.
- 67 import/firmware tests, TypeScript, focused lint and Linux build passed.
- New image `magicbox-web-recovery-port:f3217ea`, ID
  `sha256:5da10848ba463e80d9a308e5c345567e47f2e80edcecf9a0c0c1962fb4c4d8b6`.
- Source `/opt/magicbox/releases/web-recovery-port-f3217ea`, archive SHA-256
  `50876d07f4031b6fa32e0a1ff074c30ddcbbc2cde0828443a34785049527b28c`
  matched before extraction.
- Active Compose adds `docker-compose.web-port-f3217ea.yml` after all five
  layers in the previous activation command. Only web recreated; other
  container IDs unchanged. Web zero restarts and API healthy.
- Candidate and public-hostname HTTPS-from-server checks passed: cable200,
  16 JS chunks including both new error messages, all 12 firmware/manifest
  hashes exact, withdrawn V2.3.18=404. No physical browser flashing performed.
- Backup config under `backups/web-port-f3217ea/`. Gzip-verified off-host image
  and evidence `/Users/macbook/dev/magicbox-release-backups/recovery-port-f3217ea/`.
- Immediate rollback: omit only `docker-compose.web-port-f3217ea.yml` and run
  the original five-layer activation above, selecting the prior `ee9ee13` image.

For a port already retained by the previous JS session: disconnect USB, close
that tab (and other serial users), reopen the cable page and reconnect. The open
error occurs before erase; it does not establish any earlier attempt's state.
