# V2 PCB correction deployment — 2026-10-29

## Active production

- Runtime change: dashboard commit `9463b33`, layered onto the preserved
  `/opt/magicbox/releases/web-feedback-20261029` snapshot. Test-only follow-up:
  `7ec05e4`. Existing unpublished remote changes retained.
- Firmware source: `56ff79e`, branch `fix/v2-pcb-cable-v2.3.23` in
  `Magicbox_Firmware`; source checkout `/Users/macbook/dev/Magicbox_Firmware_V2_PCB`.
- Release: `/opt/magicbox/releases/web-v2-pcb-20261029`.
- Compose directory: `/opt/magicbox/deploy/aws-bridge`.
- Compose pair: `docker-compose.ec2.yml` + `docker-compose.web-v2-pcb.yml`.
- Running web image:
  `sha256:23a39faee79357151fe8f5c1d117d10972cb19d5c73f7f9215e77dd6aa207144`.
- Only `magicbox-web` recreated; API, proxy and other containers unchanged.

```sh
cd /opt/magicbox/deploy/aws-bridge
docker compose -f docker-compose.ec2.yml -f docker-compose.web-v2-pcb.yml build web
docker compose -f docker-compose.ec2.yml -f docker-compose.web-v2-pcb.yml up -d --no-deps web
```

## Verification

- Firmware: 5 source-contract tests; actual ESP32 compile; 1,357,291 program bytes,
  45,888 global RAM; esptool confirms app-only, ESP32, DIO 40 MHz and internal hash.
- Dashboard: 47 files / 192 tests passed; final UI test update 11/11; tsc passed.
- Global lint: zero errors, one preexisting account-profile img warning.
- Linux Next production build and TypeScript passed.
- Public `/syncs/cable`: HTTP 200; 16 referenced chunks downloaded successfully.
  New V2 URL, PCB marker and partition/internal-hash gates present; old URL absent.
- `/firmware/esp32/magicbox-v2-V2.3.23.bin`: HTTP 200, 1,357,536 bytes,
  SHA-256 `c96db95668f653a02451a7b932944210e13eab067cd87d2daad204b00a730327`.
- Wrong `/firmware/esp32/magicbox-v2-V2.3.18.bin`: HTTP 404.
- V3 V2.3.22 asset and boot_app0 hashes unchanged and checked publicly.
- Server: 40 GB free after build; no pruning necessary.
- Evidence: local `dev/magicbox-release-backups/v2-pcb-20261029-public-verification.json`.

## Rollback without re-exposing the incompatible image

Do NOT deploy the raw historical image without quarantining its mislabelled V2
asset. It contains the known incompatible 4 MB V3 merged image.

A derived rollback image keeps the previous frontend but moves that asset out
of `public`: `magicbox-bridge-web:rollback-pre-v2-pcb-safe-20261029`.
Its Dockerfile is `FROM magicbox-bridge-web:rollback-pre-v2-pcb-20261029`, followed
by creating `/quarantined-firmware` and moving the wrong asset there.
Both original and safe rollback images are saved as gzip archives off-host in
`/Users/macbook/dev/magicbox-release-backups/`; gzip integrity checked.
The old frontend's V2 button will fail to download, intentionally, rather than
write incompatible bytes. V3 remains available.

For rollback, create a separate override (do not overwrite current config):

```yaml
services:
  web:
    image: magicbox-bridge-web:rollback-pre-v2-pcb-safe-20261029
```

Then run the base compose plus that override using `up -d --no-deps --no-build web`.
Check the image ID, public route, V3 hash and that the old V2 asset is NOT downloadable.

## Physical acceptance and production promotion — 2026-10-29

An operator-confirmed PCB V2 was backed up, recovered and verified over USB.
The operator subsequently reported “El firmware funciona perfecto” and authorized
production publication. This is operator acceptance, not an itemized report of
all RFID/BLE/battery scenarios. Browser flashing was not physically exercised.
See `RECOVERY_V2_FLASH.md` and `firmware-v2-pcb-audit-20261029.md`.

The accepted application is byte-identical to the already deployed V2.3.23 asset.
No firmware rebuild, device rewrite, API deployment or V3 change is required.
Promotion retains the active image and compose configuration above, synchronizes
release documentation and verifies public assets again. The safe rollback remains
unchanged. Historical “physical pending” statements above are superseded here.

## Promotion results

- Firmware stable branch `legacy/v2.3.10-old-hardware`: `435d4c7`; immutable tag
  `old-hardware-v2.3.23`. V3 main and latest release unchanged.
- Official release: https://github.com/AleFerreira170295/Magicbox_Firmware/releases/tag/old-hardware-v2.3.23
  Release links to production binaries with SHA-256 values; GitHub attachment
  uploads were blocked by the session egress proxy (HTTP CONNECT 403).
- Dashboard main promoted by fast-forward, including runtime corrections and
  acceptance docs (`48e603b`); subsequent documentation-only verification update.
- Re-ran 5 firmware contract tests and 192 dashboard tests: all passed.
- Running production image unchanged; exact V2, V3 and boot_app0 hashes verified
  inside `magicbox-web`. `/syncs/cable` and V2 download returned HTTP 200,
  withdrawn V2.3.18 download returned 404 via container-local HTTP.
- Fresh external HTTP verification from this session was blocked by its proxy
  (CONNECT 403); do not describe the internal check as a new public network check.
- Updated deployment, audit and recovery docs synchronized to the active release
  directory. No restart necessary for documentation-only promotion.

## Web updater hardening — 2026-10-30

The normal updater now enforces the invariants in firmware-web-safety.md: exact
release fingerprints, installed bootloader/app preflight, exact partition layout,
and two-phase app/selector writes with device-side MD5 verification. Damaged
boxes are classified as recovery-required and remain blocked from web flashing.
This changes the dashboard only; V2 and V3 firmware binaries remain byte-identical.
