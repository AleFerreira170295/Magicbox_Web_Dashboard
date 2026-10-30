import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ main:vi.fn(),readFlash:vi.fn(),writeFlash:vi.fn(),flashMd5sum:vi.fn(),disconnect:vi.fn(),setDTR:vi.fn(),setRTS:vi.fn(),requestPort:vi.fn(),fetch:vi.fn() }));
vi.mock("esptool-js",()=>({
  Transport:class { disconnect=mock.disconnect; setDTR=mock.setDTR; setRTS=mock.setRTS; },
  ESPLoader:class { main=mock.main; readFlash=mock.readFlash; writeFlash=mock.writeFlash; flashMd5sum=mock.flashMd5sum; },
}));
import { flashMagicBoxFirmware, resolveCableFirmwareReleaseForTarget } from "../firmware-updater";
const encoder=new TextEncoder();
function imageHeader(){const b=new Uint8Array(64);b[0]=0xe9;b[1]=1;return b;}
function layout(){
  const b=new Uint8Array(0xc00).fill(0xff),v=new DataView(b.buffer);
  const e:Array<[string,number,number,number,number]>=[["nvs",1,2,0x9000,0x5000],["otadata",1,0,0xe000,0x2000],["app0",0,16,0x10000,0x1e0000],["app1",0,17,0x1f0000,0x1e0000],["spiffs",1,131,0x3d0000,0x20000],["coredump",1,3,0x3f0000,0x10000]];
  e.forEach(([label,type,subtype,offset,size],i)=>{const p=i*32;v.setUint16(p,0x50aa,true);b[p+2]=type;b[p+3]=subtype;v.setUint32(p+4,offset,true);v.setUint32(p+8,size,true);b.set(encoder.encode(label),p+12);b[p+12+encoder.encode(label).length]=0;v.setUint32(p+28,0,true);});
  v.setUint16(e.length*32,0xebeb,true);return b;
}
beforeEach(()=>{
  vi.clearAllMocks();Object.defineProperty(window,"isSecureContext",{configurable:true,value:true});Object.defineProperty(navigator,"serial",{configurable:true,value:{requestPort:mock.requestPort}});vi.stubGlobal("fetch",mock.fetch);
  mock.fetch.mockImplementation(async(url:string)=>{const pathname=new URL(url,"https://test.local").pathname;const bytes=new Uint8Array(readFileSync(resolve("public"+pathname)));return{ok:true,arrayBuffer:async()=>bytes.buffer};});
  mock.main.mockResolvedValue("ESP32-PICO-D4 (revision 1)");mock.readFlash.mockImplementation(async(address:number)=>address===0x8000?layout():imageHeader());
  mock.flashMd5sum.mockImplementation(async(address:number)=>address===0x10000?"a7d262ef06226499e3ba9fcd216413a0":"e6327541e2dc394ca2c3b3280ac0f39f");
  mock.requestPort.mockResolvedValue({});mock.writeFlash.mockResolvedValue(undefined);mock.disconnect.mockResolvedValue(undefined);
});
describe("flashing safety before mutation",()=>{
  it("preflights the device, verifies app, then activates it",async()=>{
    await flashMagicBoxFirmware({release:resolveCableFirmwareReleaseForTarget(null,"v2")!});
    expect(mock.readFlash).toHaveBeenCalledWith(0x1000,64);expect(mock.readFlash).toHaveBeenCalledWith(0x8000,0xc00);expect(mock.readFlash).toHaveBeenCalledWith(0x10000,64);
    expect(mock.readFlash.mock.invocationCallOrder.at(-1)).toBeLessThan(mock.writeFlash.mock.invocationCallOrder[0]);expect(mock.writeFlash).toHaveBeenCalledTimes(2);
    expect(mock.writeFlash.mock.calls[0][0].fileArray.map((f:{address:number})=>f.address)).toEqual([0x10000]);expect(mock.flashMd5sum).toHaveBeenNthCalledWith(1,0x10000,1_358_368);
    expect(mock.writeFlash.mock.calls[1][0].fileArray.map((f:{address:number})=>f.address)).toEqual([0xe000]);expect(mock.flashMd5sum).toHaveBeenNthCalledWith(2,0xe000,8192);expect(mock.writeFlash.mock.calls.every(([o])=>o.eraseAll===false)).toBe(true);
  });
  it("classifies an erased table as recovery and never writes",async()=>{mock.readFlash.mockImplementation(async(address:number)=>address===0x8000?new Uint8Array(0xc00).fill(0xff):imageHeader());await expect(flashMagicBoxFirmware({release:resolveCableFirmwareReleaseForTarget(null,"v2")!})).rejects.toMatchObject({code:"PARTITION_TABLE_MISSING",recoveryRequired:true});expect(mock.writeFlash).not.toHaveBeenCalled();});
  it("classifies an erased bootloader as recovery before writing",async()=>{mock.readFlash.mockImplementation(async(address:number)=>address===0x1000?new Uint8Array(64).fill(0xff):address===0x8000?layout():imageHeader());await expect(flashMagicBoxFirmware({release:resolveCableFirmwareReleaseForTarget(null,"v2")!})).rejects.toMatchObject({code:"BOOTLOADER_MISSING"});expect(mock.writeFlash).not.toHaveBeenCalled();});
  it("does not activate an application whose device MD5 differs",async()=>{mock.flashMd5sum.mockResolvedValueOnce("00000000000000000000000000000000");await expect(flashMagicBoxFirmware({release:resolveCableFirmwareReleaseForTarget(null,"v2")!})).rejects.toThrow("selector de arranque no fue modificado");expect(mock.writeFlash).toHaveBeenCalledTimes(1);expect(mock.writeFlash.mock.calls[0][0].fileArray[0].address).toBe(0x10000);});
  it("does not open a port for a relabelled V3 application",async()=>{const release={...resolveCableFirmwareReleaseForTarget(null,"v3")!,hardwareTarget:"v2" as const};await expect(flashMagicBoxFirmware({release})).rejects.toThrow("PCB V2");expect(mock.requestPort).not.toHaveBeenCalled();});
  it("rejects other ESP32 families before writing",async()=>{mock.main.mockResolvedValue("ESP32-S3");await expect(flashMagicBoxFirmware({release:resolveCableFirmwareReleaseForTarget(null,"v2")!})).rejects.toThrow("ESP32");expect(mock.writeFlash).not.toHaveBeenCalled();});
});
