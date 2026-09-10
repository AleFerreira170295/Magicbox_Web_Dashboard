import { buildDownloadedGame, encodeProtocolCommand, normalizeDeviceInfo, normalizeGameSummary, parseProtocolLine, type ProtocolMessage } from "@/features/device-import/protocol";
import type { DeviceGameDownload, DeviceGameSummary, MagicBoxDeviceInfo } from "@/features/device-import/types";

interface SerialPortLike {
  readable: ReadableStream<Uint8Array> | null;
  writable: WritableStream<Uint8Array> | null;
  open(options: { baudRate: number }): Promise<void>;
  close(): Promise<void>;
  setSignals?(signals: { dataTerminalReady?: boolean; requestToSend?: boolean }): Promise<void>;
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

  async connect() {
    const serial = serialApi();
    if (!serial) throw new Error("Web Serial no está disponible en este navegador.");
    this.port = await serial.requestPort();
    await this.port.open({ baudRate: 115200 });
    if (this.port.setSignals) {
      // Recover transparently if a previous update left the ESP32 in its
      // bootloader: IO0 high plus a short EN pulse starts the application.
      await this.port.setSignals({ dataTerminalReady: false, requestToSend: true });
      await new Promise((resolve) => setTimeout(resolve, 120));
      await this.port.setSignals({ dataTerminalReady: false, requestToSend: false });
    }
    if (!this.port.readable || !this.port.writable) throw new Error("El puerto serie no quedó disponible.");
    this.reader = this.port.readable.getReader();
    this.writer = this.port.writable.getWriter();
    this.readLoop = this.pumpMessages();

    // Opening an ESP32 serial port can reset the board through DTR/RTS. Give
    // the firmware enough time to mount LittleFS before the first command.
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }

  async disconnect() {
    try { await this.reader?.cancel(); } catch { /* noop */ }
    try { await this.readLoop; } catch { /* surfaced through pending waiters */ }
    try { this.reader?.releaseLock(); } catch { /* noop */ }
    try { this.writer?.releaseLock(); } catch { /* noop */ }
    this.reader = null;
    this.writer = null;
    this.readLoop = null;
    this.readError = null;
    this.pendingMessages = [];
    this.rejectWaiters(new Error("La conexión serie se cerró."));
    if (this.port) await this.port.close();
    this.port = null;
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

  async listGames(): Promise<DeviceGameSummary[]> {
    const games = new Map<number, DeviceGameSummary>();
    for (let attempt = 1; attempt <= 3; attempt++) {
      await this.send({ type: "savedGamesListRequest" });
      try {
        while (true) {
          const message = await this.nextMessage(12_000);
          if (message.type !== "savedGamesList") continue;
          if (message.status === "error") throw new Error(`La MagicBox rechazó la lectura: ${String(message.reason || "unknown")}.`);
          const chunk = Array.isArray(message.games) ? message.games : [];
          chunk.forEach((entry) => {
            const game = normalizeGameSummary(entry);
            if (game) games.set(game.gameId, game);
          });
          if (message.isLastChunk === true) {
            // V2.3.21 emits the final list frame just before clearing its busy
            // flag. Avoid racing the first download command against cleanup.
            await new Promise((resolve) => setTimeout(resolve, 100));
            return [...games.values()].sort((a, b) => b.gameId - a.gameId);
          }
        }
      } catch (cause) {
        const retryable = cause instanceof Error && cause.message === "La MagicBox no respondió a tiempo.";
        if (!retryable || attempt === 3) throw cause;
      }
    }
    return [];
  }

  async getDeviceInfo(): Promise<MagicBoxDeviceInfo> {
    await this.send({ type: "deviceInfoRequest" });
    while (true) {
      const message = await this.nextMessage(3_000);
      const info = normalizeDeviceInfo(message);
      if (info) return info;
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
