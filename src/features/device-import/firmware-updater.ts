import { ESPLoader, Transport, type IEspLoaderTerminal } from "esptool-js";
import { resolveApiBaseUrl } from "@/lib/api/fetcher";

import { APP0_ADDRESS, OTA_SELECTOR_ADDRESS, inspectEsp32Application, validateCablePartitionTable } from "./firmware-image";
const OTA_SELECTOR_URL = "/firmware/esp32/boot_app0.bin";
const MINIMUM_CABLE_FIRMWARE_VERSION = "V2.3.22";

export interface FirmwareReleaseInput {
  downloadUrl: string;
  sha256?: string | null;
  sizeBytes?: number | null;
  version?: string | null;
}

export interface ResolvedCableFirmwareRelease extends FirmwareReleaseInput {
  source: "published" | "bundled";
  hardwareTarget: CableHardwareTarget;
}

export type CableHardwareTarget = "v2" | "v3";

const VERIFIED_V3_CABLE_FIRMWARE: ResolvedCableFirmwareRelease = {
  downloadUrl: "/firmware/esp32/magicbox-v3-V2.3.22.bin",
  sha256: "46239b0c927a4d1bfebcfb8adb6ee5bd78c1b15bd9a71ff3237a4ffb951a7e59",
  sizeBytes: 1_349_040,
  version: MINIMUM_CABLE_FIRMWARE_VERSION,
  source: "bundled",
  hardwareTarget: "v3",
};

const VERIFIED_V2_CABLE_FIRMWARE: ResolvedCableFirmwareRelease = {
  downloadUrl: "/firmware/esp32/magicbox-v2-V2.3.23.bin",
  sha256: "c96db95668f653a02451a7b932944210e13eab067cd87d2daad204b00a730327",
  sizeBytes: 1_357_536,
  version: "V2.3.23",
  source: "bundled",
  hardwareTarget: "v2",
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
    && isAtLeastVersion(release.version, target === "v2" ? "V2.3.23" : MINIMUM_CABLE_FIRMWARE_VERSION),
  );

  if (isPublishedValid && release) {
    if (doesDownloadUrlMatchTarget(release.downloadUrl, target)) {
      return { ...release, source: "published", hardwareTarget: target };
    }
  }

  if (target === "v3") return VERIFIED_V3_CABLE_FIRMWARE;
  return VERIFIED_V2_CABLE_FIRMWARE;
}

interface FlashFirmwareOptions {
  release: ResolvedCableFirmwareRelease;
  onProgress?: (progress: number, message: string) => void;
  onLog?: (message: string) => void;
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

    onProgress?.(15, "Verificando particiones para preservar configuración y partidas…");
    validateCablePartitionTable(await loader.readFlash(0x8000, 0xc00), firmware.byteLength);
    const totalBytes = firmware.byteLength + otaSelector.byteLength;
    onProgress?.(18, `Dispositivo detectado: ${chip}. Escribiendo firmware…`);
    await loader.writeFlash({
      // Primero se escribe la aplicación. El selector OTA se actualiza al final
      // para que un corte previo no cambie el slot de arranque.
      fileArray: [
        { data: firmware, address: APP0_ADDRESS },
        { data: otaSelector, address: OTA_SELECTOR_ADDRESS },
      ],
      flashMode: "keep",
      flashFreq: "keep",
      flashSize: "keep",
      eraseAll: false,
      compress: true,
      reportProgress(fileIndex, written, total) {
        const completedBefore = fileIndex === 0 ? 0 : firmware.byteLength;
        const currentTotal = fileIndex === 0 ? firmware.byteLength : otaSelector.byteLength;
        const normalizedWritten = total > 0 ? Math.min(currentTotal, (written / total) * currentTotal) : written;
        const percent = 18 + Math.round(((completedBefore + normalizedWritten) / totalBytes) * 77);
        onProgress?.(Math.min(95, percent), fileIndex === 0 ? "Escribiendo aplicación…" : "Activando nuevo firmware…");
      },
    });

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
