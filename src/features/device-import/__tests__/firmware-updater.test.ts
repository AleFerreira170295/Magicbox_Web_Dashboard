import { describe, expect, it } from "vitest";
import { sha256Hex, validateFirmwareImage } from "@/features/device-import/firmware-updater";

describe("firmware updater validation", () => {
  it("validates published size and SHA-256", async () => {
    const firmware = new TextEncoder().encode("magicbox-firmware");
    const hash = await sha256Hex(firmware);

    await expect(validateFirmwareImage(firmware, {
      downloadUrl: "/firmware.bin",
      sizeBytes: firmware.byteLength,
      sha256: hash,
    })).resolves.toBeUndefined();
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
