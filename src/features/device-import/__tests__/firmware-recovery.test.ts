import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  main: vi.fn(),
  readFlashId: vi.fn(),
  readFlash: vi.fn(),
  eraseFlash: vi.fn(),
  writeFlash: vi.fn(),
  flashMd5sum: vi.fn(),
  disconnect: vi.fn(),
  setDTR: vi.fn(),
  setRTS: vi.fn(),
  requestPort: vi.fn(),
}));

vi.mock("esptool-js", () => ({
  Transport: class {
    disconnect = mock.disconnect;
    setDTR = mock.setDTR;
    setRTS = mock.setRTS;
  },
  ESPLoader: class {
    main = mock.main;
    readFlashId = mock.readFlashId;
    readFlash = mock.readFlash;
    eraseFlash = mock.eraseFlash;
    writeFlash = mock.writeFlash;
    flashMd5sum = mock.flashMd5sum;
  },
}));

import { recoverMagicBoxFirmware, resolveCableRecoveryRelease } from "../firmware-updater";

const ROOT = resolve(process.cwd(), "public");
const MD5_BY_ADDRESS = new Map([
  [0x1000, "234577789e6bd2dfd21ba02a85c76f0e"],
  [0x8000, "a787542e1a4ce308d98a03e17203574c"],
  [0xe000, "e6327541e2dc394ca2c3b3280ac0f39f"],
  [0x10000, "a7d262ef06226499e3ba9fcd216413a0"],
  [0x3d0000, "cafed2a73fdbf7894e8b68251dca7d9d"],
]);

function installFetch() {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input), "https://admin.magicbox.education");
    const data = readFileSync(resolve(ROOT, url.pathname.replace(/^\//, "")));
    return new Response(data, { status: 200 });
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(navigator, "serial", { configurable: true, value: { requestPort: mock.requestPort } });
  mock.requestPort.mockResolvedValue({});
  mock.main.mockResolvedValue("ESP32");
  mock.readFlashId.mockResolvedValue(0x1640ef);
  mock.readFlash.mockResolvedValue(new Uint8Array(4 * 1024 * 1024));
  mock.eraseFlash.mockResolvedValue(0);
  mock.writeFlash.mockResolvedValue(undefined);
  mock.flashMd5sum.mockImplementation(async (address: number) => MD5_BY_ADDRESS.get(address));
  mock.disconnect.mockResolvedValue(undefined);
  mock.setDTR.mockResolvedValue(undefined);
  mock.setRTS.mockResolvedValue(undefined);
  installFetch();
});

describe("full flash recovery", () => {
  it("backs up, erases, verifies every region, and activates the selector last", async () => {
    const release = resolveCableRecoveryRelease("v2")!;
    const onBackupReady = vi.fn();
    const result = await recoverMagicBoxFirmware({ release, onBackupReady });

    expect(result).toEqual({ requiresReconnect: false, backupCreated: true });
    expect(onBackupReady).toHaveBeenCalledWith(expect.any(Uint8Array), expect.stringContaining("before-recovery"));
    expect(onBackupReady.mock.calls[0][0]).toHaveLength(4 * 1024 * 1024);
    expect(mock.eraseFlash).toHaveBeenCalledOnce();
    expect(mock.eraseFlash.mock.invocationCallOrder[0]).toBeLessThan(mock.writeFlash.mock.invocationCallOrder[0]);
    expect(mock.writeFlash).toHaveBeenCalledTimes(2);
    expect(mock.writeFlash.mock.calls[0][0].fileArray.map((entry: { address: number }) => entry.address)).toEqual([
      0x10000,
      0x3d0000,
      0x1000,
      0x8000,
    ]);
    expect(mock.writeFlash.mock.calls[1][0].fileArray.map((entry: { address: number }) => entry.address)).toEqual([0xe000]);
    expect(mock.writeFlash.mock.calls.every(([options]) => options.eraseAll === false)).toBe(true);
    expect(mock.flashMd5sum.mock.calls.map(([address]) => address)).toEqual([0x10000, 0x3d0000, 0x1000, 0x8000, 0xe000]);
  });

  it("can intentionally skip backup for an empty board", async () => {
    const result = await recoverMagicBoxFirmware({
      release: resolveCableRecoveryRelease("v2")!,
      skipBackup: true,
    });
    expect(result.backupCreated).toBe(false);
    expect(mock.readFlash).not.toHaveBeenCalled();
    expect(mock.eraseFlash).toHaveBeenCalledOnce();
  });

  it("does not erase when the backup fails and the operator declines", async () => {
    mock.readFlash.mockRejectedValueOnce(new Error("read failed"));
    await expect(recoverMagicBoxFirmware({
      release: resolveCableRecoveryRelease("v2")!,
      confirmEraseWithoutBackup: () => false,
    })).rejects.toThrow("no fue borrada");
    expect(mock.eraseFlash).not.toHaveBeenCalled();
  });

  it("can continue without a backup only after explicit confirmation", async () => {
    mock.readFlash.mockRejectedValueOnce(new Error("read failed"));
    const result = await recoverMagicBoxFirmware({
      release: resolveCableRecoveryRelease("v2")!,
      confirmEraseWithoutBackup: () => true,
    });
    expect(result.backupCreated).toBe(false);
    expect(mock.eraseFlash).toHaveBeenCalledOnce();
  });

  it("rejects non-4MB flash before backup or erase", async () => {
    mock.readFlashId.mockResolvedValueOnce(0x1540ef);
    await expect(recoverMagicBoxFirmware({ release: resolveCableRecoveryRelease("v2")! })).rejects.toThrow("4 MB");
    expect(mock.readFlash).not.toHaveBeenCalled();
    expect(mock.eraseFlash).not.toHaveBeenCalled();
  });

  it("does not expose an unverified V3 recovery package", () => {
    expect(resolveCableRecoveryRelease("v3")).toBeNull();
  });
});
