import { buildDownloadedGame, encodeProtocolCommand, normalizeGameSummary, parseProtocolLine, type ProtocolMessage } from "@/features/device-import/protocol";
import type { DeviceGameDownload, DeviceGameSummary } from "@/features/device-import/types";

interface SerialPortLike {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
}

interface SerialNavigatorLike {
  requestPort(): Promise<SerialPortLike>;
}

function serialApi(): SerialNavigatorLike | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as Navigator & { serial?: SerialNavigatorLike }).serial ?? null;
}

export function supportsWebSerial() {
  return serialApi() !== null && typeof window !== "undefined" && window.isSecureContext;
}

export class MagicBoxSerialClient {
  private port: SerialPortLike | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private buffer = "";
  private pendingLines: string[] = [];

  async connect() {
    const serial = serialApi();
    if (!serial) throw new Error("Web Serial no está disponible en este navegador.");
    this.port = await serial.requestPort();
    await this.port.open({ baudRate: 115200 });
    if (!this.port.readable || !this.port.writable) throw new Error("El puerto serie no quedó disponible.");
    this.reader = this.port.readable.getReader();
    this.writer = this.port.writable.getWriter();
  }

  async disconnect() {
    try { await this.reader?.cancel(); } catch { /* noop */ }
    try { this.reader?.releaseLock(); } catch { /* noop */ }
    try { this.writer?.releaseLock(); } catch { /* noop */ }
    this.reader = null;
    this.writer = null;
    if (this.port) await this.port.close();
    this.port = null;
  }

  private async send(command: ProtocolMessage) {
    if (!this.writer) throw new Error("La MagicBox no está conectada.");
    await this.writer.write(new TextEncoder().encode(encodeProtocolCommand(command)));
  }

  private async nextMessage(timeoutMs: number): Promise<ProtocolMessage> {
    if (!this.reader) throw new Error("La MagicBox no está conectada.");
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      while (this.pendingLines.length > 0) {
        const parsed = parseProtocolLine(this.pendingLines.shift() as string);
        if (parsed) return parsed;
      }
      const remaining = Math.max(1, deadline - Date.now());
      const result = await Promise.race([
        this.reader.read(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("La MagicBox no respondió a tiempo.")), remaining)),
      ]);
      if (result.done) throw new Error("La conexión serie se cerró.");
      this.buffer += new TextDecoder().decode(result.value, { stream: true });
      const lines = this.buffer.split(/\r?\n/);
      this.buffer = lines.pop() ?? "";
      this.pendingLines.push(...lines);
    }
    throw new Error("La MagicBox no respondió a tiempo.");
  }

  async listGames(): Promise<DeviceGameSummary[]> {
    await this.send({ type: "savedGamesListRequest" });
    const games = new Map<number, DeviceGameSummary>();
    while (true) {
      const message = await this.nextMessage(30_000);
      if (message.type !== "savedGamesList") continue;
      if (message.status === "error") throw new Error(`La MagicBox rechazó la lectura: ${String(message.reason || "unknown")}.`);
      const chunk = Array.isArray(message.games) ? message.games : [];
      chunk.forEach((entry) => {
        const game = normalizeGameSummary(entry);
        if (game) games.set(game.gameId, game);
      });
      if (message.isLastChunk === true) return [...games.values()].sort((a, b) => b.gameId - a.gameId);
    }
  }

  async downloadGame(gameId: number): Promise<DeviceGameDownload> {
    await this.send({ type: "savedGameDownloadRequest", gameId: String(gameId) });
    const messages: ProtocolMessage[] = [];
    while (true) {
      const message = await this.nextMessage(60_000);
      const receivedGameId = Number(message.gameId || 0);
      if (receivedGameId && receivedGameId !== gameId) continue;
      messages.push(message);
      if (message.type !== "savedGameTransferComplete") continue;
      if (message.status !== "ok") throw new Error(`No se pudo descargar la partida ${gameId}: ${String(message.reason || "unknown")}.`);
      return buildDownloadedGame(messages);
    }
  }

  async deleteGames(gameIds: number[]) {
    await this.send({ command: "deleteGames", gameIds });
    while (true) {
      const message = await this.nextMessage(60_000);
      if (message.type !== "deleteGamesEnd") continue;
      if (Number(message.errors || 0) > 0) throw new Error(`La MagicBox informó ${message.errors} errores al borrar.`);
      return;
    }
  }
}
