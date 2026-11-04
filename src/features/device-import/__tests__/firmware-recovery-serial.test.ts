import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ESPLoader } from "esptool-js";
import { afterEach, expect, it, vi } from "vitest";
import { recoverMagicBoxFirmware, resolveCableRecoveryRelease } from "../firmware-updater";

// Real ESPLoader.main/connect and Transport: only the hardware sync is failed.
// Mocking main entirely cannot detect a port opened before main rejects.
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "serial");
});

it("closes an opened port after failed sync so the same board can be retried", async () => {
  const port = {
    readable: null as ReadableStream<Uint8Array> | null,
    writable: null as WritableStream<Uint8Array> | null,
    open: vi.fn(async () => {
      if (port.readable) throw new DOMException("The port is already open.", "InvalidStateError");
      port.readable = new ReadableStream<Uint8Array>();
      port.writable = new WritableStream<Uint8Array>();
    }),
    close: vi.fn(async () => {
      if (port.readable?.locked || port.writable?.locked) throw new Error("Streams are locked");
      port.readable = null;
      port.writable = null;
    }),
    getInfo: () => ({ usbVendorId: 0x1a86, usbProductId: 0x7523 }),
    setSignals: vi.fn(async () => undefined),
  };
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(navigator, "serial", { configurable: true, value: { requestPort: async () => port } });
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input), "https://admin.magicbox.education");
    return new Response(readFileSync(resolve("public" + url.pathname)), { status: 200 });
  }));
  const attempt = vi.spyOn(ESPLoader.prototype, "_connectAttempt").mockImplementation(async (_mode, reset) => {
    expect(reset).not.toBeNull();
    await reset!.reset();
    throw new Error("Simulated hardware sync failure");
  });
  const erase = vi.spyOn(ESPLoader.prototype, "eraseFlash");
  const write = vi.spyOn(ESPLoader.prototype, "writeFlash");

  for (let retry = 0; retry < 2; retry++) {
    await expect(recoverMagicBoxFirmware({ release: resolveCableRecoveryRelease("v2")! }))
      .rejects.toThrow("Simulated hardware sync failure");
    expect(port.readable).toBeNull();
    expect(port.writable).toBeNull();
  }
  expect(port.open).toHaveBeenCalledTimes(2);
  expect(port.close).toHaveBeenCalledTimes(2);
  expect(attempt).toHaveBeenCalledTimes(2);
  expect(port.setSignals).toHaveBeenCalled();
  expect(erase).not.toHaveBeenCalled();
  expect(write).not.toHaveBeenCalled();
});
