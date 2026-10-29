import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  main: vi.fn(), readFlash: vi.fn(), writeFlash: vi.fn(), disconnect: vi.fn(),
  setDTR: vi.fn(), setRTS: vi.fn(), requestPort: vi.fn(), fetch: vi.fn(),
}));
vi.mock("esptool-js", () => ({
  Transport: class { disconnect = mock.disconnect; setDTR = mock.setDTR; setRTS = mock.setRTS; },
  ESPLoader: class { main = mock.main; readFlash = mock.readFlash; writeFlash = mock.writeFlash; },
}));
import { flashMagicBoxFirmware, resolveCableFirmwareReleaseForTarget } from "../firmware-updater";

function layout() {
  const bytes = new Uint8Array(0xc00).fill(255), view = new DataView(bytes.buffer);
  [[1,2,0x9000,0x5000],[1,0,0xe000,0x2000],[0,16,0x10000,0x1e0000],[0,17,0x1f0000,0x1e0000],[1,131,0x3d0000,0x20000]].forEach(([type,subtype,offset,size],i) => {
    view.setUint16(i*32,0x50aa,true); bytes[i*32+2]=type; bytes[i*32+3]=subtype;
    view.setUint32(i*32+4,offset,true); view.setUint32(i*32+8,size,true);
  });
  return bytes;
}
beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(window,"isSecureContext",{ configurable:true,value:true });
  Object.defineProperty(navigator,"serial",{ configurable:true,value:{requestPort:mock.requestPort} });
  vi.stubGlobal("fetch", mock.fetch);
  mock.fetch.mockImplementation(async (url: string) => {
    const pathname = new URL(url, "https://test.local").pathname;
    const bytes = new Uint8Array(readFileSync(resolve(`public${pathname}`)));
    return { ok:true, arrayBuffer:async () => bytes.buffer };
  });
  mock.main.mockResolvedValue("ESP32-PICO-D4 (revision 1)");
  mock.readFlash.mockResolvedValue(layout());
  mock.requestPort.mockResolvedValue({});
  mock.writeFlash.mockResolvedValue(undefined);
  mock.disconnect.mockResolvedValue(undefined);
});

describe("flashing safety before mutation", () => {
  it("writes only app0 and OTA selector after inspecting device partitions", async () => {
    await flashMagicBoxFirmware({release:resolveCableFirmwareReleaseForTarget(null,"v2")!});
    expect(mock.readFlash).toHaveBeenCalledWith(0x8000,0xc00);
    expect(mock.readFlash.mock.invocationCallOrder[0]).toBeLessThan(mock.writeFlash.mock.invocationCallOrder[0]);
    const options = mock.writeFlash.mock.calls[0][0];
    expect(options.eraseAll).toBe(false);
    expect(options.fileArray.map((f: {address:number}) => f.address)).toEqual([0x10000,0xe000]);
    expect(options.fileArray[0].data.length).toBeLessThan(0x1e0000);
  });
  it("never writes on an incompatible partition table, and resets/releases the port", async () => {
    mock.readFlash.mockResolvedValue(new Uint8Array(0xc00));
    await expect(flashMagicBoxFirmware({release:resolveCableFirmwareReleaseForTarget(null,"v2")!})).rejects.toThrow("particiones");
    expect(mock.writeFlash).not.toHaveBeenCalled();
    expect(mock.setRTS).toHaveBeenCalledWith(true);
    expect(mock.setRTS).toHaveBeenCalledWith(false);
    expect(mock.disconnect).toHaveBeenCalledTimes(1);
  });
  it("does not open a port for a relabelled V3 application", async () => {
    const release = {...resolveCableFirmwareReleaseForTarget(null,"v3")!, hardwareTarget:"v2" as const};
    await expect(flashMagicBoxFirmware({release})).rejects.toThrow("PCB V2");
    expect(mock.requestPort).not.toHaveBeenCalled();
    expect(mock.writeFlash).not.toHaveBeenCalled();
  });
  it("rejects other ESP32 families before writing", async () => {
    mock.main.mockResolvedValue("ESP32-S3");
    await expect(flashMagicBoxFirmware({release:resolveCableFirmwareReleaseForTarget(null,"v2")!})).rejects.toThrow("ESP32");
    expect(mock.writeFlash).not.toHaveBeenCalled();
  });
});
