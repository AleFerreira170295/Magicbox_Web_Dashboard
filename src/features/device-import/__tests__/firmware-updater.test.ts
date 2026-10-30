import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resetMagicBoxToApplication, resolveCableFirmwareRelease, resolveCableFirmwareReleaseForTarget, settleWithin, sha256Hex, validateFirmwareImage } from "@/features/device-import/firmware-updater";

describe("firmware updater validation", () => {
  it("bounds serial cleanup waits", async () => {
    await expect(settleWithin(Promise.resolve(), 20)).resolves.toBe(true);
    await expect(settleWithin(new Promise(() => undefined), 5)).resolves.toBe(false);
    await expect(settleWithin(Promise.reject(new Error("closed")), 20)).resolves.toBe(false);
  });

  it("pulses reset while keeping the ESP32 out of download mode", async () => {
    const calls: string[] = [];
    await resetMagicBoxToApplication({
      async setDTR(state) { calls.push(`DTR:${state}`); },
      async setRTS(state) { calls.push(`RTS:${state}`); },
    });
    expect(calls).toEqual(["DTR:false", "RTS:true", "RTS:false", "DTR:false"]);
  });

  it("validates published size and SHA-256", async () => {
    const firmware = new Uint8Array(readFileSync(resolve("public/firmware/esp32/magicbox-v3-V2.3.22.bin")));
    const hash = await sha256Hex(firmware);

    await expect(validateFirmwareImage(firmware, {
      downloadUrl: "/firmware.bin",
      sizeBytes: firmware.byteLength,
      sha256: hash,
    })).resolves.toBeUndefined();
  });

  it("uses only an exact allowlisted published fingerprint", () => {
    expect(resolveCableFirmwareReleaseForTarget({
      downloadUrl: "/magicbox-v3-published.bin",
      sha256: "a".repeat(64),
      sizeBytes: 123,
      version: "V2.3.23",
    }, "v3")).toMatchObject({ downloadUrl: "/firmware/esp32/magicbox-v3-V2.3.22.bin", source: "bundled" });

    expect(resolveCableFirmwareReleaseForTarget({
      downloadUrl: "/firmware/esp32/magicbox-v2-V2.3.23.bin",
      sha256: "c96db95668f653a02451a7b932944210e13eab067cd87d2daad204b00a730327",
      sizeBytes: 1_357_536,
      version: "V2.3.23",
    }, "v2")).toMatchObject({ downloadUrl: "/firmware/esp32/magicbox-v2-V2.3.23.bin", source: "published", md5: "3542585f35333a9c40e81b21ac3e319a" });

    expect(resolveCableFirmwareReleaseForTarget({
      downloadUrl: "/firmware/esp32/magicbox-v2-V2.3.20.bin",
      sha256: "a".repeat(64),
      sizeBytes: 123,
      version: "V2.3.20",
    }, "v2")).toMatchObject({ downloadUrl: "/firmware/esp32/magicbox-v2-V2.3.23.bin", source: "bundled" });

    expect(resolveCableFirmwareRelease({
      downloadUrl: "/firmware/esp32/magicbox-v2-V2.3.23.bin",
      sha256: "c96db95668f653a02451a7b932944210e13eab067cd87d2daad204b00a730327",
      sizeBytes: 1_357_536,
      version: "V2.3.23",
    })).toMatchObject({ downloadUrl: "/firmware/esp32/magicbox-v3-V2.3.22.bin", source: "bundled" });
  });

  it("rejects an empty or altered firmware image", async () => {
    await expect(validateFirmwareImage(new Uint8Array(), { downloadUrl: "/firmware.bin" }))
      .rejects.toThrow("vacío");

    const firmware = new TextEncoder().encode("altered");
    await expect(validateFirmwareImage(firmware, {
      downloadUrl: "/firmware.bin",
      sha256: "0".repeat(64),
    })).rejects.toThrow("SHA-256");
  });
});
