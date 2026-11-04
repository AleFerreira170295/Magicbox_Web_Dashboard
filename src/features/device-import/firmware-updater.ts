import { ESPLoader, Transport, type IEspLoaderTerminal } from "esptool-js";
import { resolveApiBaseUrl } from "@/lib/api/fetcher";

import { APP0_ADDRESS, OTA_SELECTOR_ADDRESS, inspectEsp32Application, validateCablePartitionTable, validateInstalledDeviceForNormalUpdate } from "./firmware-image";
const OTA_SELECTOR_URL = "/firmware/esp32/boot_app0.bin";
const MINIMUM_CABLE_FIRMWARE_VERSION = "V2.3.23";

export interface FirmwareReleaseInput {
  downloadUrl: string;
  sha256?: string | null;
  sizeBytes?: number | null;
  version?: string | null;
}

export interface ResolvedCableFirmwareRelease extends FirmwareReleaseInput {
  source: "published" | "bundled";
  hardwareTarget: CableHardwareTarget;
  md5: string;
}

export type CableHardwareTarget = "v2" | "v3";

export interface CableRecoveryRegion {
  name: "bootloader" | "partitions" | "otadata" | "application" | "initial-littlefs";
  address: number;
  downloadUrl: string;
  sizeBytes: number;
  sha256: string;
  md5: string;
}

export interface CableRecoveryRelease {
  hardwareTarget: CableHardwareTarget;
  version: string;
  flashSizeBytes: number;
  sourceCommit: string;
  regions: CableRecoveryRegion[];
}

const V2_RECOVERY_BASE = "/firmware/esp32/recovery/v2.3.24";
const V2_RECOVERY_RELEASE: CableRecoveryRelease = {
  hardwareTarget: "v2",
  version: "V2.3.24",
  flashSizeBytes: 4 * 1024 * 1024,
  sourceCommit: "5f2b2218dcd4da0cb04551de8a9614dc0ac6fd4a",
  regions: [
    { name: "bootloader", address: 0x1000, downloadUrl: V2_RECOVERY_BASE + "/bootloader.bin", sizeBytes: 23_552, sha256: "a227e3ab93f15f1155efb3144810cc06ff7a259e9bc9b4542417afcc6c238214", md5: "234577789e6bd2dfd21ba02a85c76f0e" },
    { name: "partitions", address: 0x8000, downloadUrl: V2_RECOVERY_BASE + "/partitions-littlefs.bin", sizeBytes: 4_096, sha256: "39579c5f2c51bf9b587a23618bbcf732a5aaf0a346ce9f50b28a44289af884af", md5: "a787542e1a4ce308d98a03e17203574c" },
    { name: "otadata", address: OTA_SELECTOR_ADDRESS, downloadUrl: V2_RECOVERY_BASE + "/boot_app0.bin", sizeBytes: 8_192, sha256: "f94c5d786a7a8fab06ac5d10e33bf37711a6697636dc037559ea19cc410a17f0", md5: "e6327541e2dc394ca2c3b3280ac0f39f" },
    { name: "application", address: APP0_ADDRESS, downloadUrl: V2_RECOVERY_BASE + "/magicbox-v2-V2.3.24-app.bin", sizeBytes: 1_358_368, sha256: "7f134519c761e299b50176248feeac4d818bb3be262318f11d087c104a874b0a", md5: "a7d262ef06226499e3ba9fcd216413a0" },
    { name: "initial-littlefs", address: 0x3d0000, downloadUrl: V2_RECOVERY_BASE + "/initial-littlefs.bin", sizeBytes: 131_072, sha256: "2bc8f92e586f7ad11afbfcfde69cbca9d47f45225c18f1524b04908990020b4d", md5: "cafed2a73fdbf7894e8b68251dca7d9d" },
  ],
};

export function resolveCableRecoveryRelease(target: CableHardwareTarget) {
  return target === "v2" ? V2_RECOVERY_RELEASE : null;
}

const VERIFIED_V3_CABLE_FIRMWARE: ResolvedCableFirmwareRelease = {
  downloadUrl: "/firmware/esp32/magicbox-v3-V2.3.23.bin",
  sha256: "74f36265d6d26dd1f0230622a5792747285e0ef4fab06033cff8c5fd11cfa27f",
  sizeBytes: 1_349_920,
  version: MINIMUM_CABLE_FIRMWARE_VERSION,
  source: "bundled",
  hardwareTarget: "v3",
  md5: "42b1e108d128e48ba8eddade02d5f123",
};

const VERIFIED_V2_CABLE_FIRMWARE: ResolvedCableFirmwareRelease = {
  downloadUrl: "/firmware/esp32/magicbox-v2-V2.3.24.bin",
  sha256: "7f134519c761e299b50176248feeac4d818bb3be262318f11d087c104a874b0a",
  sizeBytes: 1_358_368,
  version: "V2.3.24",
  source: "bundled",
  hardwareTarget: "v2",
  md5: "a7d262ef06226499e3ba9fcd216413a0",
};

function versionParts(value?: string | null) {
  return (value?.match(/\d+/g) || []).map(Number);
}

function isAtLeastVersion(value: string | null | undefined, minimum: string) {
  const current = versionParts(value);
  const required = versionParts(minimum);
  if (current.length === 0) return false;
  for (let index = 0; index < Math.max(current.length, required.length); index += 1) {
    const difference = (current[index] || 0) - (required[index] || 0);
    if (difference !== 0) return difference > 0;
  }
  return true;
}

function doesDownloadUrlMatchTarget(downloadUrl: string, target: CableHardwareTarget) {
  const lower = downloadUrl.toLowerCase();
  if (target === "v2") return lower.includes("magicbox-v2") || lower.includes("-v2-") || lower.includes("/v2");
  return lower.includes("magicbox-v3") || lower.includes("-v3-") || lower.includes("/v3");
}

export function resolveCableFirmwareRelease(release?: FirmwareReleaseInput | null): ResolvedCableFirmwareRelease {
  return resolveCableFirmwareReleaseForTarget(release, "v3")!;
}

export function resolveCableFirmwareReleaseForTarget(
  release: FirmwareReleaseInput | null | undefined,
  target: CableHardwareTarget,
): ResolvedCableFirmwareRelease | null {
  const isPublishedValid = Boolean(
    release?.downloadUrl
    && release.sha256
    && isAtLeastVersion(release.version, target === "v2" ? "V2.3.24" : MINIMUM_CABLE_FIRMWARE_VERSION),
  );

  const trusted = target === "v3" ? VERIFIED_V3_CABLE_FIRMWARE : VERIFIED_V2_CABLE_FIRMWARE;
  const matchesTrustedFingerprint = release?.sha256?.toLowerCase() === trusted.sha256?.toLowerCase()
    && release?.sizeBytes === trusted.sizeBytes
    && release?.version === trusted.version;
  if (isPublishedValid && matchesTrustedFingerprint && release && doesDownloadUrlMatchTarget(release.downloadUrl, target)) {
    return { ...release, source: "published", hardwareTarget: target, md5: trusted.md5 };
  }

  return trusted;
}

interface FlashFirmwareOptions {
  release: ResolvedCableFirmwareRelease;
  onProgress?: (progress: number, message: string) => void;
  onLog?: (message: string) => void;
}

interface RecoverFirmwareOptions {
  release: CableRecoveryRelease;
  onProgress?: (progress: number, message: string) => void;
  onLog?: (message: string) => void;
  onBackupReady?: (backup: Uint8Array, filename: string) => void;
  skipBackup?: boolean;
  confirmEraseWithoutBackup?: (cause: unknown) => boolean | Promise<boolean>;
}

export interface FirmwareRecoveryResult extends FirmwareFlashResult {
  backupCreated: boolean;
}

type EsptoolSerialPort = ConstructorParameters<typeof Transport>[0];

interface SerialNavigator {
  serial?: {
    requestPort(options?: { filters?: Array<{ usbVendorId?: number; usbProductId?: number }> }): Promise<EsptoolSerialPort>;
  };
}

function resolveDownloadUrl(value: string) {
  if (value.startsWith("/firmware/")) return new URL(value, window.location.origin).toString();
  return new URL(value, resolveApiBaseUrl()).toString();
}

export async function sha256Hex(data: Uint8Array) {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function validateFirmwareImage(data: Uint8Array, release: FirmwareReleaseInput, target?: CableHardwareTarget) {
  if (data.byteLength === 0) throw new Error("El binario de firmware está vacío.");
  if (release.sizeBytes && data.byteLength !== release.sizeBytes) {
    throw new Error(`El firmware descargado mide ${data.byteLength} bytes; se esperaban ${release.sizeBytes}.`);
  }
  if (release.sha256) {
    const actualHash = await sha256Hex(data);
    if (actualHash.toLowerCase() !== release.sha256.toLowerCase()) {
      throw new Error("El hash SHA-256 del firmware no coincide con la release publicada.");
    }
  }
  const { checksumEnd } = inspectEsp32Application(data);
  const internalHash = await sha256Hex(data.subarray(0, checksumEnd));
  const embeddedHash = Array.from(data.subarray(checksumEnd), (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (internalHash !== embeddedHash) throw new Error("El hash interno de la aplicación ESP32 no coincide.");
  const text = new TextDecoder().decode(data);
  if (target === "v2" && !text.includes("MAGICBOX_HW_V2_PWM32")) {
    throw new Error("La aplicación no acredita compatibilidad con la PCB V2 y su buzzer PWM. No se escribió nada.");
  }
  if (target === "v3" && text.includes("MAGICBOX_HW_V2_PWM32")) {
    throw new Error("No se puede cargar firmware de PCB V2 en una MagicBox V3.");
  }
}

async function downloadBinary(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`No se pudo descargar el firmware (${response.status}).`);
  return new Uint8Array(await response.arrayBuffer());
}

export async function settleWithin(operation: Promise<unknown>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const result = await Promise.race([
    operation.then(() => true, () => false),
    new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    }),
  ]);
  if (timer) clearTimeout(timer);
  return result;
}

interface ResetControlLines {
  setDTR(state: boolean): Promise<void>;
  setRTS(state: boolean): Promise<void>;
}

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function resetMagicBoxToApplication(control: ResetControlLines) {
  // Keep IO0 high (DTR false) and pulse EN low through RTS. Merely releasing
  // RTS, as esptool-js' hard_reset does, can leave this CP210x/PICO-D4 board
  // running the flasher stub until the cable is physically reconnected.
  await control.setDTR(false);
  await control.setRTS(true);
  await sleep(120);
  await control.setRTS(false);
  await sleep(120);
  await control.setDTR(false);
}

export interface FirmwareFlashResult {
  requiresReconnect: boolean;
}


export async function recoverMagicBoxFirmware({
  release,
  onProgress,
  onLog,
  onBackupReady,
  skipBackup = false,
  confirmEraseWithoutBackup,
}: RecoverFirmwareOptions): Promise<FirmwareRecoveryResult> {
  const serial = (navigator as Navigator & SerialNavigator).serial;
  if (!serial) throw new Error("Web Serial no está disponible en este navegador.");
  if (!window.isSecureContext) throw new Error("La recuperación requiere HTTPS o localhost.");
  if (release.hardwareTarget !== "v2") {
    throw new Error("Todavía no existe un paquete de recuperación físicamente validado para este modelo.");
  }

  onProgress?.(1, "Descargando y validando paquete de recuperación…");
  const downloaded = new Map<CableRecoveryRegion["name"], Uint8Array>();
  for (const [index, region] of release.regions.entries()) {
    const data = await downloadBinary(new URL(region.downloadUrl, window.location.origin).toString());
    if (data.byteLength !== region.sizeBytes) {
      throw new Error("El archivo " + region.name + " no tiene el tamaño verificado.");
    }
    const actualSha = await sha256Hex(data);
    if (actualSha !== region.sha256) {
      throw new Error("El archivo " + region.name + " no coincide con el SHA-256 publicado.");
    }
    downloaded.set(region.name, data);
    onProgress?.(2 + Math.round(((index + 1) / release.regions.length) * 8), "Validando " + region.name + "…");
  }

  const application = downloaded.get("application");
  const bootloader = downloaded.get("bootloader");
  const partitions = downloaded.get("partitions");
  if (!application || !bootloader || !partitions) {
    throw new Error("El paquete de recuperación está incompleto.");
  }
  const applicationRegion = release.regions.find((region) => region.name === "application")!;
  await validateFirmwareImage(application, applicationRegion, release.hardwareTarget);
  validateCablePartitionTable(partitions.subarray(0, 0xc00), application.byteLength);

  onProgress?.(11, "Seleccioná el puerto USB de la MagicBox a recuperar.");
  const port = await serial.requestPort();
  const transport = new Transport(port, false);
  const terminal: IEspLoaderTerminal = {
    clean() {},
    write(data) { onLog?.(data); },
    writeLine(data) { onLog?.(data); },
  };
  const loader = new ESPLoader({ transport, baudrate: 115200, terminal, debugLogging: false });
  let requiresReconnect = false;
  let backupCreated = false;
  try {
    // Recovery also starts from running legacy firmware or a blank board.
    // Use esptool's bootloader reset instead of assuming download mode.
    const chip = await loader.main();
    if (!/^ESP32(?:[- ](?:D0WD|D2WD|D0WDR2|PICO|U4WDH)|$)/i.test(chip)) throw new Error("Chip incompatible: se esperaba ESP32 y se detectó " + chip + ".");
    const flashId = await loader.readFlashId();
    const capacityId = (flashId >>> 16) & 0xff;
    if (capacityId !== 0x16) {
      throw new Error("La recuperación validada requiere una flash física de 4 MB.");
    }

    if (skipBackup) {
      onLog?.("El operador confirmó omitir el respaldo completo antes del borrado.");
      onProgress?.(25, "Respaldo omitido por confirmación explícita.");
    } else {
      onProgress?.(13, "Respaldando los 4 MB actuales antes de borrar…");
      try {
        const backup = await loader.readFlash(0, release.flashSizeBytes, (_packet, progress, total) => {
          const ratio = total > 0 ? progress / total : 0;
          onProgress?.(13 + Math.min(12, Math.round(ratio * 12)), "Respaldando memoria actual…");
        });
        const stamp = new Date().toISOString().replace(/[:.]/g, "-");
        onBackupReady?.(backup, "magicbox-" + release.hardwareTarget + "-before-recovery-" + stamp + ".bin");
        backupCreated = true;
      } catch (cause) {
        const accepted = await confirmEraseWithoutBackup?.(cause);
        if (!accepted) {
          throw new Error("No se pudo crear el respaldo completo; la placa no fue borrada.");
        }
        onLog?.("El operador confirmó continuar sin respaldo porque la lectura completa falló.");
      }
    }

    onProgress?.(27, "Borrando completamente la memoria flash…");
    await loader.eraseFlash();

    const selector = release.regions.find((region) => region.name === "otadata");
    const staged = release.regions.filter((region) => region.name !== "otadata");
    const writeOrder = ["application", "initial-littlefs", "bootloader", "partitions"];
    staged.sort((left, right) => writeOrder.indexOf(left.name) - writeOrder.indexOf(right.name));
    onProgress?.(31, "Escribiendo bootloader, particiones, firmware y filesystem…");
    await loader.writeFlash({
      fileArray: staged.map((region) => ({ data: downloaded.get(region.name)!, address: region.address })),
      flashMode: "keep",
      flashFreq: "keep",
      flashSize: "keep",
      eraseAll: false,
      compress: true,
      reportProgress(_fileIndex, written, total) {
        const ratio = total > 0 ? written / total : 0;
        onProgress?.(31 + Math.min(45, Math.round(ratio * 45)), "Escribiendo recuperación completa…");
      },
    });

    for (const [index, region] of staged.entries()) {
      onProgress?.(78 + index * 3, "Verificando " + region.name + " en la placa…");
      const actualMd5 = (await loader.flashMd5sum(region.address, region.sizeBytes)).toLowerCase();
      if (actualMd5 !== region.md5) {
        throw new Error("La verificación MD5 de " + region.name + " falló; el selector no fue activado.");
      }
    }

    if (!selector) throw new Error("El paquete no contiene selector OTA.");
    onProgress?.(91, "Activando firmware recuperado…");
    await loader.writeFlash({
      fileArray: [{ data: downloaded.get("otadata")!, address: selector.address }],
      flashMode: "keep",
      flashFreq: "keep",
      flashSize: "keep",
      eraseAll: false,
      compress: true,
      reportProgress() { onProgress?.(94, "Activando selector OTA…"); },
    });
    const selectorMd5 = (await loader.flashMd5sum(selector.address, selector.sizeBytes)).toLowerCase();
    if (selectorMd5 !== selector.md5) throw new Error("La verificación MD5 del selector OTA falló.");

    onProgress?.(97, "Reiniciando MagicBox recuperada…");
    const resetCompleted = await settleWithin(resetMagicBoxToApplication(transport), 2_500);
    if (!resetCompleted) requiresReconnect = true;
  } finally {
    // main() opens the serial port before syncing/detecting the chip. Even a
    // failed handshake must cancel the reader and close the port for a retry.
    const disconnected = await settleWithin(transport.disconnect(), 2_500);
    if (!disconnected) {
      requiresReconnect = true;
      onLog?.("El puerto quedó pendiente de liberación; desconectá y reconectá el cable antes de continuar.");
    }
  }
  onProgress?.(100, "MagicBox " + release.hardwareTarget.toUpperCase() + " recuperada con " + release.version + ".");
  return { requiresReconnect, backupCreated };
}

export async function flashMagicBoxFirmware({ release, onProgress, onLog }: FlashFirmwareOptions) {
  const serial = (navigator as Navigator & SerialNavigator).serial;
  if (!serial) throw new Error("Web Serial no está disponible en este navegador.");
  if (!window.isSecureContext) throw new Error("La actualización requiere HTTPS o localhost.");
  if (!release.downloadUrl) throw new Error("No hay una release de firmware publicada.");
  if (release.hardwareTarget !== "v2" && release.hardwareTarget !== "v3") {
    throw new Error("Falta confirmar el modelo de PCB antes de actualizar.");
  }

  onProgress?.(2, "Descargando firmware publicado…");
  const [firmware, otaSelector] = await Promise.all([
    downloadBinary(resolveDownloadUrl(release.downloadUrl)),
    downloadBinary(OTA_SELECTOR_URL),
  ]);
  await validateFirmwareImage(firmware, release, release.hardwareTarget);
  if (otaSelector.byteLength !== 8192 || await sha256Hex(otaSelector) !== "f94c5d786a7a8fab06ac5d10e33bf37711a6697636dc037559ea19cc410a17f0") {
    throw new Error("El selector de arranque OTA no es válido; no se escribió nada.");
  }

  onProgress?.(8, "Seleccioná el puerto USB de la MagicBox…");
  const port = await serial.requestPort();
  const transport = new Transport(port, false);
  const terminal: IEspLoaderTerminal = {
    clean() {},
    write(data) { onLog?.(data); },
    writeLine(data) { onLog?.(data); },
  };
  const loader = new ESPLoader({ transport, baudrate: 115200, terminal, debugLogging: false });

  let requiresReconnect = false;
  try {
    onProgress?.(12, "Entrando al cargador seguro del ESP32…");
    const chip = await loader.main();
    if (!/^ESP32(?:[- ](?:D0WD|D2WD|D0WDR2|PICO|U4WDH)|$)/i.test(chip)) {
      throw new Error(`El puerto seleccionado no corresponde a una MagicBox ESP32 (${chip}).`);
    }

    onProgress?.(15, "Verificando arranque, aplicación y particiones antes de escribir…");
    // esptool uses one serial stream: keep preflight reads strictly sequential.
    const bootloaderHeader = await loader.readFlash(0x1000, 64);
    const partitionTable = await loader.readFlash(0x8000, 0xc00);
    const currentAppHeader = await loader.readFlash(APP0_ADDRESS, 64);
    validateInstalledDeviceForNormalUpdate({ bootloaderHeader, partitionTable, currentAppHeader, incomingImageSize: firmware.byteLength });
    const totalBytes = firmware.byteLength + otaSelector.byteLength;
    onProgress?.(18, "Dispositivo detectado: " + chip + ". Escribiendo aplicación…");
    await loader.writeFlash({
      // La aplicación se escribe y verifica antes de tocar el selector OTA.
      fileArray: [{ data: firmware, address: APP0_ADDRESS }],
      flashMode: "keep",
      flashFreq: "keep",
      flashSize: "keep",
      eraseAll: false,
      compress: true,
      reportProgress(_fileIndex, written, total) {
        const normalizedWritten = total > 0 ? Math.min(firmware.byteLength, (written / total) * firmware.byteLength) : written;
        onProgress?.(Math.min(88, 18 + Math.round((normalizedWritten / totalBytes) * 70)), "Escribiendo aplicación…");
      },
    });
    onProgress?.(89, "Verificando aplicación escrita…");
    const appMd5 = (await loader.flashMd5sum(APP0_ADDRESS, firmware.byteLength)).toLowerCase();
    if (appMd5 !== release.md5) throw new Error("La verificación MD5 de la aplicación escrita falló. El selector de arranque no fue modificado.");

    onProgress?.(91, "Activando aplicación verificada…");
    await loader.writeFlash({
      fileArray: [{ data: otaSelector, address: OTA_SELECTOR_ADDRESS }],
      flashMode: "keep",
      flashFreq: "keep",
      flashSize: "keep",
      eraseAll: false,
      compress: true,
      reportProgress(_fileIndex, written, total) {
        const percent = total > 0 ? Math.round((written / total) * 3) : 0;
        onProgress?.(91 + Math.min(3, percent), "Activando aplicación verificada…");
      },
    });
    const selectorMd5 = (await loader.flashMd5sum(OTA_SELECTOR_ADDRESS, otaSelector.byteLength)).toLowerCase();
    if (selectorMd5 !== "e6327541e2dc394ca2c3b3280ac0f39f") throw new Error("La verificación MD5 del selector de arranque falló.");

    onProgress?.(97, "Reiniciando MagicBox…");
    const resetCompleted = await settleWithin(resetMagicBoxToApplication(transport), 2_500);
    if (!resetCompleted) {
      requiresReconnect = true;
      onLog?.("La escritura terminó, pero el controlador serie no confirmó el reset. La MagicBox puede reiniciarse al desconectar el cable.");
    }
    onProgress?.(99, "Carga terminada. Liberando el puerto USB…");
  } catch (error) {
    // A rejected partition table must not leave an otherwise healthy device
    // running the ROM flasher stub. Preserve the original error for the UI.
    await settleWithin(resetMagicBoxToApplication(transport), 2_500);
    throw error;
  } finally {
    // Chromium/macOS can leave esptool-js' read loop locked after the ESP32
    // resets. Never keep the UI waiting forever after a completed flash.
    const disconnected = await settleWithin(transport.disconnect(), 2_000);
    if (!disconnected) {
      requiresReconnect = true;
      onLog?.("El puerto quedó pendiente de liberación; desconectá y reconectá el cable antes de continuar.");
    }
  }
  onProgress?.(100, `Firmware ${release.version || "nuevo"} cargado correctamente.`);
  return { requiresReconnect } satisfies FirmwareFlashResult;
}
