import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { inspectEsp32Application, validateCablePartitionTable } from "../firmware-image";
import { resolveCableFirmwareReleaseForTarget, sha256Hex, validateFirmwareImage } from "../firmware-updater";

function bundled(target: "v2" | "v3") {
  const release = resolveCableFirmwareReleaseForTarget(null, target)!;
  const bytes = new Uint8Array(readFileSync(resolve(`public${release.downloadUrl}`)));
  return { release, bytes };
}

function partitions() {
  const bytes = new Uint8Array(0xc00).fill(0xff); const view = new DataView(bytes.buffer); const encoder = new TextEncoder();
  const entries: Array<[string, number, number, number, number]> = [["nvs",1,2,0x9000,0x5000],["otadata",1,0,0xe000,0x2000],["app0",0,0x10,0x10000,0x1e0000],["app1",0,0x11,0x1f0000,0x1e0000],["spiffs",1,0x83,0x3d0000,0x20000],["coredump",1,3,0x3f0000,0x10000]];
  entries.forEach(([label,type,subtype,offset,size],i)=>{const pos=i*32;view.setUint16(pos,0x50aa,true);bytes[pos+2]=type;bytes[pos+3]=subtype;view.setUint32(pos+4,offset,true);view.setUint32(pos+8,size,true);bytes.set(encoder.encode(label),pos+12);bytes[pos+12+encoder.encode(label).length]=0;view.setUint32(pos+28,0,true);});
  view.setUint16(entries.length*32,0xebeb,true); return bytes;
}

describe("real bundled applications and preservation gates", () => {
  it.each(["v2", "v3"] as const)("validates real %s application, size, external and internal hashes", async (target) => {
    const { release, bytes } = bundled(target);
    await expect(validateFirmwareImage(bytes, release, target)).resolves.toBeUndefined();
    expect(bytes.length).toBeLessThan(0x1e0000);
  });

  it("rejects a full-flash/merged image even with a matching SHA-256", async () => {
    const bytes = new Uint8Array(0x400000).fill(0xff);
    bytes.set(bundled("v3").bytes, 0x10000);
    await expect(validateFirmwareImage(bytes, { downloadUrl: "/wrong-v2.bin", sha256: await sha256Hex(bytes) }, "v2"))
      .rejects.toThrow("no es una aplicación");
  });

  it("rejects V3 relabelled as V2 and V2 requested for V3", async () => {
    const v3 = bundled("v3"), v2 = bundled("v2");
    await expect(validateFirmwareImage(v3.bytes, v3.release, "v2")).rejects.toThrow("PCB V2");
    await expect(validateFirmwareImage(v2.bytes, v2.release, "v3")).rejects.toThrow("PCB V2");
  });

  it("does not route another target or an ambiguous published URL to V3", () => {
    const v2 = bundled("v2").release;
    expect(resolveCableFirmwareReleaseForTarget(v2, "v3")).toMatchObject({ source: "bundled", hardwareTarget: "v3" });
    expect(resolveCableFirmwareReleaseForTarget({ ...v2, downloadUrl: "/unknown.bin" }, "v2")).toMatchObject({ source: "bundled", hardwareTarget: "v2" });
  });

  it("rejects bootloaders, truncation, non-ESP32 chips, 80MHz and oversized images", () => {
    const original = bundled("v2").bytes;
    const bootloader = original.slice(); bootloader.fill(0, 32, 36);
    expect(() => inspectEsp32Application(bootloader)).toThrow("descriptor");
    expect(() => inspectEsp32Application(original.slice(0, 512))).toThrow("segmento");
    const wrongChip = original.slice(); wrongChip[12] = 9;
    expect(() => inspectEsp32Application(wrongChip)).toThrow("chip ESP32");
    const fast = original.slice(); fast[3] = 0x2f;
    expect(() => inspectEsp32Application(fast)).toThrow("40 MHz");
    const oversized = new Uint8Array(0x1e0001); oversized.set(original);
    expect(() => inspectEsp32Application(oversized)).toThrow("excede");
  });

  it("rejects corrupted internal hash even when the published hash matches", async () => {
    const { bytes } = bundled("v2"); bytes[bytes.length - 1] ^= 1;
    await expect(validateFirmwareImage(bytes, { downloadUrl: "/changed.bin", sha256: await sha256Hex(bytes) }, "v2"))
      .rejects.toThrow("hash interno");
  });

  it("accepts the known preservation layout and rejects missing, smaller or shifted partitions", () => {
    expect(() => validateCablePartitionTable(partitions(), bundled("v2").bytes.length)).not.toThrow();
    expect(() => validateCablePartitionTable(new Uint8Array(), 100)).toThrow("leer");
    expect(() => validateCablePartitionTable(new Uint8Array(0xc00), 100)).toThrow("compatible");
    const small = partitions(); new DataView(small.buffer).setUint32(2 * 32 + 8, 0x140000, true);
    expect(() => validateCablePartitionTable(small, 1357536)).toThrow("compatible");
    const shifted = partitions(); new DataView(shifted.buffer).setUint32(4 * 32 + 4, 0x290000, true);
    expect(() => validateCablePartitionTable(shifted, 1357536)).toThrow("compatible");
    const noMd5 = partitions(); new DataView(noMd5.buffer).setUint16(6 * 32, 0xffff, true);
    expect(() => validateCablePartitionTable(noMd5, 1357536)).toThrow("exactamente");
    const wrongLabel = partitions(); wrongLabel.set(new TextEncoder().encode("data"), 4 * 32 + 12);
    expect(() => validateCablePartitionTable(wrongLabel, 1357536)).toThrow("exactamente");
  });
});
