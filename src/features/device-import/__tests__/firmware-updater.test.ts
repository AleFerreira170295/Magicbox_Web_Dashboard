import { describe, expect, it } from "vitest";
import { resolveCableFirmwareRelease, settleWithin, sha256Hex, validateFirmwareImage } from "@/features/device-import/firmware-updater";

describe("firmware updater validation", () => {
  it("bounds serial cleanup waits", async () => {
    await expect(settleWithin(Promise.resolve(), 20)).resolves.toBe(true);
    await expect(settleWithin(new Promise(() => undefined), 5)).resolves.toBe(false);
    await expect(settleWithin(Promise.reject(new Error("closed")), 20)).resolves.toBe(false);
  });

  it("validates published size and SHA-256", async () => {
    const firmware = new TextEncoder().encode("magicbox-firmware");
    const hash = await sha256Hex(firmware);

    await expect(validateFirmwareImage(firmware, {
      downloadUrl: "/firmware.bin",
      sizeBytes: firmware.byteLength,
      sha256: hash,
    })).resolves.toBeUndefined();
  });

  it("uses only a published release new enough for cable import", () => {
    expect(resolveCableFirmwareRelease({
      downloadUrl: "/published.bin",
      sha256: "a".repeat(64),
      sizeBytes: 123,
      version: "V2.3.23",
    })).toMatchObject({ downloadUrl: "/published.bin", source: "published" });

    expect(resolveCableFirmwareRelease({
      downloadUrl: "/old.bin",
      sha256: "b".repeat(64),
      version: "V2.3.20",
    })).toMatchObject({ version: "V2.3.22", source: "bundled" });
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
