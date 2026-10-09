import { buildDownloadedGame, encodeProtocolCommand, normalizeDeviceInfo, normalizeGameSummary, normalizeProtocolMessage, parseProtocolLine, type ProtocolMessage } from "@/features/device-import/protocol";
import type { DeviceGameDownload, DeviceGameSummary, MagicBoxDeviceInfo } from "@/features/device-import/types";

interface SerialPortLike {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  setSignals?(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
  addEventListener?(type: "disconnect", listener: () => void): void;
  removeEventListener?(type: "disconnect", listener: () => void): void;
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
  private readLoop: Promise<void> | null = null;
  private buffer = "";
  private pendingMessages: ProtocolMessage[] = [];
  private messageWaiters: Array<{
    resolve: (message: ProtocolMessage) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];
  private readError: Error | null = null;
  private disconnectPromise: Promise<void> | null = null;
  private operationInFlight = false;

  constructor(private readonly onUnexpectedDisconnect?: () => void) {}

  private readonly handleUnexpectedDisconnect = () => {
    if (!this.port) return;
    this.onUnexpectedDisconnect?.();
    void this.disconnect().catch(() => undefined);
  };

  async connect() {
    const serial = serialApi();
    if (!serial) throw new Error("Web Serial no está disponible en este navegador.");
    if (this.port || this.disconnectPromise) await this.disconnect();
    this.buffer = "";
    this.pendingMessages = [];
    this.readError = null;

    const port = await serial.requestPort();
    this.port = port;
    port.addEventListener?.("disconnect", this.handleUnexpectedDisconnect);
    try {
      await port.open({ baudRate: 115200 });
      if (port.setSignals) {
        // Recover transparently if a previous update left the ESP32 in its
        // bootloader: IO0 high plus a short EN pulse starts the application.
        await port.setSignals({ dataTerminalReady: false, requestToSend: true });
        await new Promise((resolve) => setTimeout(resolve, 120));
        await port.setSignals({ dataTerminalReady: false, requestToSend: false });
      }
      if (!port.readable || !port.writable) throw new Error("El puerto serie no quedó disponible.");
      this.reader = port.readable.getReader();
      this.writer = port.writable.getWriter();
      this.readLoop = this.pumpMessages();

      // Opening an ESP32 serial port can reset the board through DTR/RTS. Give
      // the firmware enough time to mount LittleFS before the first command.
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    } catch (cause) {
      await this.disconnect().catch(() => undefined);
      throw cause;
    }
  }

  async disconnect() {
    if (this.disconnectPromise) return this.disconnectPromise;
    const operation = this.performDisconnect();
    this.disconnectPromise = operation;
    try {
      await operation;
    } finally {
      if (this.disconnectPromise === operation) this.disconnectPromise = null;
    }
  }

  private async performDisconnect() {
    const port = this.port;
    const reader = this.reader;
    const writer = this.writer;
    const readLoop = this.readLoop;
    port?.removeEventListener?.("disconnect", this.handleUnexpectedDisconnect);
    this.port = null;
    this.reader = null;
    this.writer = null;
    this.readLoop = null;
    this.readError = null;
    this.buffer = "";
    this.pendingMessages = [];
    this.rejectWaiters(new Error("La conexión serie se cerró."));
    try { await reader?.cancel(); } catch { /* noop */ }
    try { await readLoop; } catch { /* surfaced through pending waiters */ }
    try { reader?.releaseLock(); } catch { /* noop */ }
    try { writer?.releaseLock(); } catch { /* noop */ }
    this.readError = null;
    this.buffer = "";
    this.pendingMessages = [];
    if (port) await port.close();
  }

  private async send(command: ProtocolMessage) {
    if (!this.writer) throw new Error("La MagicBox no está conectada.");
    await this.writer.write(new TextEncoder().encode(encodeProtocolCommand(command)));
  }

  private async pumpMessages() {
    const decoder = new TextDecoder();
    try {
      while (this.reader) {
        const result = await this.reader.read();
        if (result.done) break;
        this.buffer += decoder.decode(result.value, { stream: true });
        const lines = this.buffer.split(/\r?\n/);
        this.buffer = lines.pop() ?? "";
        for (const line of lines) {
          const message = parseProtocolLine(line);
          if (message) this.dispatchMessage(message);
        }
      }
      this.readError = new Error("La conexión serie se cerró.");
    } catch (cause) {
      this.readError = cause instanceof Error ? cause : new Error("Falló la lectura del puerto serie.");
    } finally {
      this.rejectWaiters(this.readError);
    }
  }

  private dispatchMessage(message: ProtocolMessage) {
    const waiter = this.messageWaiters.shift();
    if (!waiter) {
      this.pendingMessages.push(message);
      return;
    }
    clearTimeout(waiter.timer);
    waiter.resolve(message);
  }

  private rejectWaiters(error: Error | null) {
    const failure = error ?? new Error("Falló la lectura del puerto serie.");
    for (const waiter of this.messageWaiters.splice(0)) {
      clearTimeout(waiter.timer);
      waiter.reject(failure);
    }
  }

  private async nextMessage(timeoutMs: number): Promise<ProtocolMessage> {
    const pending = this.pendingMessages.shift();
    if (pending) return pending;
    if (!this.reader) throw new Error("La MagicBox no está conectada.");
    if (this.readError) throw this.readError;

    return new Promise<ProtocolMessage>((resolve, reject) => {
      const waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          const index = this.messageWaiters.indexOf(waiter);
          if (index >= 0) this.messageWaiters.splice(index, 1);
          reject(new Error("La MagicBox no respondió a tiempo."));
        }, timeoutMs),
      };
      this.messageWaiters.push(waiter);
    });
  }


  private async runOperation<T>(label: string, operation: () => Promise<T>): Promise<T> {
    if (this.operationInFlight) throw new Error("Ya hay otra operación en curso: " + label + ".");
    this.operationInFlight = true;
    this.pendingMessages = [];
    try {
      return await operation();
    } finally {
      this.operationInFlight = false;
    }
  }

  async listGames(): Promise<DeviceGameSummary[]> {
    return this.runOperation("listado de partidas", async () => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        const games = new Map<number, DeviceGameSummary>();
        const chunkIndexes = new Set<number>();
        this.pendingMessages = [];
        await this.send({ type: "savedGamesListRequest" });
        try {
          while (true) {
            const message = normalizeProtocolMessage(await this.nextMessage(12_000));
            if (message.type !== "savedGamesList") continue;
            if (message.status === "error") throw new Error("La MagicBox rechazó la lectura: " + String(message.reason || "unknown") + ".");
            const chunkIndex = Number(message.chunkIndex ?? message.chunk_index);
            if (Number.isInteger(chunkIndex) && chunkIndex >= 0) {
              if (chunkIndexes.has(chunkIndex)) continue;
              chunkIndexes.add(chunkIndex);
            }
            const chunk = Array.isArray(message.games) ? message.games : [];
            chunk.forEach((entry) => {
              const game = normalizeGameSummary(entry);
              if (game) games.set(game.gameId, game);
            });
            if (message.isLastChunk !== true && message.is_last_chunk !== true) continue;
            if (Number.isInteger(chunkIndex) && chunkIndex >= 0) {
              for (let index = 0; index <= chunkIndex; index++) {
                if (!chunkIndexes.has(index)) throw new Error("El listado llegó incompleto: falta el bloque " + index + ".");
              }
            }
            const expectedCount = Number(message.count);
            if (Number.isFinite(expectedCount) && expectedCount >= 0 && games.size !== expectedCount) {
              throw new Error("El listado llegó incompleto: " + games.size + "/" + expectedCount + " partidas.");
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
            return [...games.values()].sort((a, b) => b.gameId - a.gameId);
          }
        } catch (cause) {
          const retryable = cause instanceof Error && cause.message === "La MagicBox no respondió a tiempo.";
          if (!retryable || attempt === 3) throw cause;
        }
      }
      return [];
    });
  }

  async getDeviceInfo(): Promise<MagicBoxDeviceInfo> {
    return this.runOperation("identificación del dispositivo", async () => {
      await this.send({ type: "deviceInfoRequest" });
      while (true) {
        const message = await this.nextMessage(3_000);
        const info = normalizeDeviceInfo(message);
        if (info) return info;
      }
    });
  }

  async downloadGame(gameId: number): Promise<DeviceGameDownload> {
    return this.runOperation("descarga de partida", async () => {
      await this.send({ type: "savedGameDownloadRequest", gameId: String(gameId) });
      const messages: ProtocolMessage[] = [];
      const contractTypes = new Set(["savedGameTransferStart", "savedGameMeta", "savedGamePlayer", "savedGameTurnsChunk", "savedGameTransferComplete"]);
      let activeTransferId = "";
      while (true) {
        const message = normalizeProtocolMessage(await this.nextMessage(60_000));
        const type = String(message.type || "");
        if (!contractTypes.has(type)) continue;
        const receivedGameId = Number(message.gameId || 0);
        if (receivedGameId && receivedGameId !== gameId) continue;
        const transferId = String(message.transferId || "").trim();
        if (!transferId) continue;
        if (!activeTransferId) {
          if (type !== "savedGameTransferStart" || receivedGameId !== gameId) continue;
          activeTransferId = transferId;
        }
        if (transferId !== activeTransferId) continue;
        messages.push(message);
        if (type !== "savedGameTransferComplete") continue;
        if (message.status !== "ok") throw new Error("No se pudo descargar la partida " + gameId + ": " + String(message.reason || "unknown") + ".");
        return buildDownloadedGame(messages);
      }
    });
  }

  async deleteGames(gameIds: number[]) {
    return this.runOperation("borrado de partidas", async () => {
      const requestedIds = [...new Set(gameIds.filter((gameId) => Number.isInteger(gameId) && gameId > 0))].sort((a, b) => a - b);
      if (requestedIds.length === 0) throw new Error("No hay partidas válidas para borrar.");
      await this.send({ command: "deleteGames", gameIds: requestedIds });
      while (true) {
        const message = normalizeProtocolMessage(await this.nextMessage(60_000));
        if (message.type !== "deleteGamesEnd") continue;
        const errors = Number(message.errors || 0);
        const deleted = Number(message.deleted || 0);
        const notFound = Number(message.notFound ?? message.not_found ?? 0);
        if (String(message.status || "").toLowerCase() !== "complete") throw new Error("La MagicBox no confirmó el borrado completo.");
        if (errors > 0) throw new Error("La MagicBox informó " + errors + " errores al borrar.");
        if (deleted + notFound !== requestedIds.length) throw new Error("La confirmación de borrado quedó incompleta: " + (deleted + notFound) + "/" + requestedIds.length + ".");
        return { deleted, notFound };
      }
    });
  }
}
