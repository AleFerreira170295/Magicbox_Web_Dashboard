import { ESPLoader, Transport, type IEspLoaderTerminal } from "esptool-js";
import { resolveApiBaseUrl } from "@/lib/api/fetcher";

const APP0_ADDRESS = 0x10000;
const OTA_SELECTOR_ADDRESS = 0xe000;
const OTA_SELECTOR_URL = "/firmware/esp32/boot_app0.bin";

export interface FirmwareReleaseInput {
  downloadUrl: string;
  sha256?: string | null;
  sizeBytes?: number | null;
  version?: string | null;
}

interface FlashFirmwareOptions {
  release: FirmwareReleaseInput;
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
  return new URL(value, resolveApiBaseUrl()).toString();
}

export async function sha256Hex(data: Uint8Array) {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  const digest = await crypto.subtle.digest("SHA-256", copy.buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function validateFirmwareImage(data: Uint8Array, release: FirmwareReleaseInput) {
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
}

async function downloadBinary(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`No se pudo descargar el firmware (${response.status}).`);
  return new Uint8Array(await response.arrayBuffer());
}

export async function flashMagicBoxFirmware({ release, onProgress, onLog }: FlashFirmwareOptions) {
  const serial = (navigator as Navigator & SerialNavigator).serial;
  if (!serial) throw new Error("Web Serial no está disponible en este navegador.");
  if (!window.isSecureContext) throw new Error("La actualización requiere HTTPS o localhost.");
  if (!release.downloadUrl) throw new Error("No hay una release de firmware publicada.");

  onProgress?.(2, "Descargando firmware publicado…");
  const [firmware, otaSelector] = await Promise.all([
    downloadBinary(resolveDownloadUrl(release.downloadUrl)),
    downloadBinary(OTA_SELECTOR_URL),
  ]);
  await validateFirmwareImage(firmware, release);

  onProgress?.(8, "Seleccioná el puerto USB de la MagicBox…");
  const port = await serial.requestPort();
  const transport = new Transport(port, false);
  const terminal: IEspLoaderTerminal = {
    clean() {},
    write(data) { onLog?.(data); },
    writeLine(data) { onLog?.(data); },
  };
  const loader = new ESPLoader({ transport, baudrate: 115200, terminal, debugLogging: false });

  try {
    onProgress?.(12, "Entrando al cargador seguro del ESP32…");
    const chip = await loader.main();
    if (!chip.toUpperCase().includes("ESP32")) {
      throw new Error(`El puerto seleccionado no corresponde a una MagicBox ESP32 (${chip}).`);
    }

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
    await loader.after("hard_reset");
    onProgress?.(100, `Firmware ${release.version || "nuevo"} instalado.`);
  } finally {
    try { await transport.disconnect(); } catch { /* el reset puede cerrar el puerto */ }
  }
}
