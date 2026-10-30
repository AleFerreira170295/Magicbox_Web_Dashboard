// Cable updates are application-only. Never write a merged/full-flash image
// at app0: doing so corrupts the boot image and can overwrite saved games.
export const APP0_ADDRESS = 0x10000;
export const OTA_SELECTOR_ADDRESS = 0xe000;
export const APP0_SIZE = 0x1e0000;

export type FirmwareSafetyCode = "BOOTLOADER_MISSING" | "PARTITION_TABLE_MISSING" | "CURRENT_APP_MISSING" | "PARTITION_TABLE_INCOMPATIBLE" | "FLASH_LAYOUT_INVALID";

export class FirmwareSafetyError extends Error {
  readonly recoveryRequired: boolean;

  constructor(readonly code: FirmwareSafetyCode, message: string, recoveryRequired = true) {
    super(message);
    this.name = "FirmwareSafetyError";
    this.recoveryRequired = recoveryRequired;
  }
}

type Partition = { label: string; type: number; subtype: number; offset: number; size: number; flags: number };

const EXPECTED_PARTITIONS: Partition[] = [
  { label: "nvs", type: 1, subtype: 2, offset: 0x9000, size: 0x5000, flags: 0 },
  { label: "otadata", type: 1, subtype: 0, offset: OTA_SELECTOR_ADDRESS, size: 0x2000, flags: 0 },
  { label: "app0", type: 0, subtype: 0x10, offset: APP0_ADDRESS, size: APP0_SIZE, flags: 0 },
  { label: "app1", type: 0, subtype: 0x11, offset: 0x1f0000, size: APP0_SIZE, flags: 0 },
  { label: "spiffs", type: 1, subtype: 0x83, offset: 0x3d0000, size: 0x20000, flags: 0 },
  { label: "coredump", type: 1, subtype: 3, offset: 0x3f0000, size: 0x10000, flags: 0 },
];

function isErased(data: Uint8Array) {
  return data.every((byte) => byte === 0xff);
}

function inspectInstalledEsp32ImageHeader(data: Uint8Array, kind: "bootloader" | "application") {
  if (data.length < 16 || isErased(data) || data[0] !== 0xe9) {
    throw new FirmwareSafetyError(
      kind === "bootloader" ? "BOOTLOADER_MISSING" : "CURRENT_APP_MISSING",
      kind === "bootloader"
        ? "La MagicBox no tiene un cargador de arranque válido. Requiere recuperación segura con respaldo; la actualización web no escribió nada."
        : "La aplicación instalada no tiene una cabecera ESP32 válida. Requiere recuperación segura con respaldo; la actualización web no escribió nada.",
    );
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint16(12, true) !== 0) {
    throw new FirmwareSafetyError("FLASH_LAYOUT_INVALID", "La imagen instalada no corresponde al ESP32 clásico de MagicBox; no se escribió nada.", false);
  }
}

export function inspectEsp32Application(data: Uint8Array) {
  if (data.length < 288 || data[0] !== 0xe9) throw new Error("El archivo no es una aplicación ESP32. No se admiten imágenes completas/merged ni bootloaders.");
  if (data.length > APP0_SIZE) throw new Error("El firmware excede la partición de aplicación; no se escribió nada.");
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (view.getUint16(12, true) !== 0) throw new Error("El firmware no corresponde al chip ESP32 clásico de MagicBox.");
  if (data[2] !== 2 || (data[3] & 0x0f) !== 0) throw new Error("El firmware debe usar flash DIO a 40 MHz.");
  if (view.getUint32(32, true) !== 0xabcd5432) throw new Error("Falta el descriptor de aplicación ESP32; no se admite un bootloader.");
  const count = data[1];
  if (count < 1 || count > 16) throw new Error("Cantidad de segmentos ESP32 inválida.");
  let offset = 24;
  let checksum = 0xef;
  for (let i = 0; i < count; i++) {
    if (offset + 8 > data.length) throw new Error("Segmento ESP32 truncado.");
    const length = view.getUint32(offset + 4, true);
    offset += 8;
    if ((i === 0 && length < 256) || length > data.length - offset) throw new Error("Longitud de segmento ESP32 inválida.");
    for (let j = offset; j < offset + length; j++) checksum ^= data[j];
    offset += length;
  }
  const checksumEnd = Math.ceil((offset + 1) / 16) * 16;
  if (checksumEnd > data.length || data[checksumEnd - 1] !== checksum) throw new Error("Checksum interno ESP32 inválido.");
  if (data[23] !== 1 || data.length !== checksumEnd + 32) throw new Error("La imagen debe contener solo la aplicación y su hash interno, sin relleno de flash.");
  return { checksumEnd };
}

export function validateCablePartitionTable(data: Uint8Array, imageSize: number) {
  if (data.length < 0xc00) throw new FirmwareSafetyError("PARTITION_TABLE_MISSING", "No se pudo leer la tabla de particiones. Requiere recuperación segura con respaldo; no se escribió nada.");
  if (isErased(data)) throw new FirmwareSafetyError("PARTITION_TABLE_MISSING", "La tabla de particiones está borrada. Requiere recuperación segura con respaldo; no se escribió nada.");
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const partitions: Partition[] = [];
  const decoder = new TextDecoder();
  let terminalOffset = 0;
  for (let pos = 0; pos + 32 <= data.length; pos += 32) {
    if (view.getUint16(pos, true) !== 0x50aa) { terminalOffset = pos; break; }
    const labelBytes = data.subarray(pos + 12, pos + 28);
    const nul = labelBytes.indexOf(0);
    partitions.push({ label: decoder.decode(nul >= 0 ? labelBytes.subarray(0, nul) : labelBytes), type: data[pos + 2], subtype: data[pos + 3], offset: view.getUint32(pos + 4, true), size: view.getUint32(pos + 8, true), flags: view.getUint32(pos + 28, true) });
  }
  const hasMd5Record = terminalOffset + 32 <= data.length && view.getUint16(terminalOffset, true) === 0xebeb;
  const exactLayout = partitions.length === EXPECTED_PARTITIONS.length && partitions.every((partition, index) => {
    const expected = EXPECTED_PARTITIONS[index];
    const subtypeMatches = partition.label === "spiffs"
      ? partition.subtype === 0x82 || partition.subtype === 0x83
      : partition.subtype === expected.subtype;
    return partition.label === expected.label && partition.type === expected.type && subtypeMatches
      && partition.offset === expected.offset && partition.size === expected.size && partition.flags === expected.flags;
  });
  if (imageSize > APP0_SIZE || !exactLayout || !hasMd5Record) {
    throw new FirmwareSafetyError("PARTITION_TABLE_INCOMPATIBLE", "La tabla de particiones no es compatible: no coincide con uno de los layouts históricos seguros de MagicBox. Requiere diagnóstico o recuperación con respaldo; no se escribió nada.");
  }
  for (let i = 0; i < partitions.length; i++) {
    const a = partitions[i];
    if (a.offset < 0x9000 || a.size === 0 || a.offset + a.size > 0x400000 || partitions.slice(i + 1).some((b) => a.offset < b.offset + b.size && b.offset < a.offset + a.size)) {
      throw new FirmwareSafetyError("FLASH_LAYOUT_INVALID", "La tabla de particiones contiene rangos inválidos o superpuestos; no se escribió nada.", false);
    }
  }
}

export function validateInstalledDeviceForNormalUpdate(input: { bootloaderHeader: Uint8Array; partitionTable: Uint8Array; currentAppHeader: Uint8Array; incomingImageSize: number }) {
  inspectInstalledEsp32ImageHeader(input.bootloaderHeader, "bootloader");
  validateCablePartitionTable(input.partitionTable, input.incomingImageSize);
  inspectInstalledEsp32ImageHeader(input.currentAppHeader, "application");
}
