// Cable updates are application-only. Never write a merged/full-flash image
// at app0: doing so corrupts the boot image and can overwrite saved games.
export const APP0_ADDRESS = 0x10000;
export const OTA_SELECTOR_ADDRESS = 0xe000;
export const APP0_SIZE = 0x1e0000;

export function inspectEsp32Application(data: Uint8Array) {
  if (data.length < 288 || data[0] !== 0xe9) {
    throw new Error("El archivo no es una aplicación ESP32. No se admiten imágenes completas/merged ni bootloaders.");
  }
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
  if (data.length < 0xc00) throw new Error("No se pudo leer la tabla de particiones; no se escribió nada.");
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const partitions: Array<{ type: number; subtype: number; offset: number; size: number }> = [];
  for (let pos = 0; pos + 32 <= data.length; pos += 32) {
    if (view.getUint16(pos, true) !== 0x50aa) break;
    partitions.push({ type: data[pos + 2], subtype: data[pos + 3], offset: view.getUint32(pos + 4, true), size: view.getUint32(pos + 8, true) });
  }
  const required = [
    { type: 1, subtype: 2, offset: 0x9000, size: 0x5000 },
    { type: 1, subtype: 0, offset: OTA_SELECTOR_ADDRESS, size: 0x2000 },
    { type: 0, subtype: 0x10, offset: APP0_ADDRESS, size: APP0_SIZE },
    { type: 0, subtype: 0x11, offset: 0x1f0000, size: APP0_SIZE },
    { type: 1, subtype: 0x83, offset: 0x3d0000, size: 0x20000 },
  ];
  if (imageSize > APP0_SIZE || required.some((entry) => !partitions.some((p) =>
    p.type === entry.type && p.subtype === entry.subtype && p.offset === entry.offset && p.size === entry.size))) {
    throw new Error("La tabla de particiones no es compatible con esta actualización. Se requiere recuperación por consola con respaldo; no se escribió nada.");
  }
  for (let i = 0; i < partitions.length; i++) {
    const a = partitions[i];
    if (a.offset < 0x9000 || a.size === 0 || a.offset + a.size > 0x400000 || partitions.slice(i + 1).some((b) => a.offset < b.offset + b.size && b.offset < a.offset + a.size)) {
      throw new Error("La tabla de particiones contiene rangos inválidos o superpuestos; no se escribió nada.");
    }
  }
}
