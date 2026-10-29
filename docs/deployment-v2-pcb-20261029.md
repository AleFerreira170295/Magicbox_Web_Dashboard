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

## Remaining physical gate

No attached device was reset or flashed: its PCB identity was not confirmed.
V2 physical boot, PWM audio, LEDs, RFID, full game, BLE, USB stored-game preservation,
battery and sleep remain unverified. Inspect and back up an affected V2 before
repair; never erase/format to work around the previous incompatible write.
See `firmware-v2-pcb-audit-20261029.md` for the electrical and behavioral comparison.
