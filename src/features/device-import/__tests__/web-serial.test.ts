import { afterEach, describe, expect, it, vi } from "vitest";
import { MagicBoxSerialClient } from "@/features/device-import/web-serial";

function makePort() {
  let disconnectListener: (() => void) | undefined;
  const readable = new ReadableStream<Uint8Array>();
  const writable = new WritableStream<Uint8Array>();
  const port = {
    readable,
    writable,
    open: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    setSignals: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn((_type: "disconnect", listener: () => void) => { disconnectListener = listener; }),
    removeEventListener: vi.fn((_type: "disconnect", listener: () => void) => {
      if (disconnectListener === listener) disconnectListener = undefined;
    }),
    emitDisconnect() { disconnectListener?.(); },
  };
  return port;
}

async function connectWithoutDelays(client: MagicBoxSerialClient) {
  const connecting = client.connect();
  await vi.advanceTimersByTimeAsync(1_620);
  await connecting;
}

describe("MagicBoxSerialClient session cleanup", () => {
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, "serial");
  });

  it("releases reader, writer, listener and port exactly once when cleanup is repeated", async () => {
    vi.useFakeTimers();
    const port = makePort();
    Object.defineProperty(navigator, "serial", {
      configurable: true,
      value: { requestPort: vi.fn().mockResolvedValue(port) },
    });
    const client = new MagicBoxSerialClient();
    await connectWithoutDelays(client);

    await Promise.all([client.disconnect(), client.disconnect()]);
    await client.disconnect();

    expect(port.close).toHaveBeenCalledTimes(1);
    expect(port.removeEventListener).toHaveBeenCalledTimes(1);
    expect(port.readable.locked).toBe(false);
    expect(port.writable.locked).toBe(false);
  });

  it("notifies once and cleans the session when the USB device disappears", async () => {
    vi.useFakeTimers();
    const port = makePort();
    const onUnexpectedDisconnect = vi.fn();
    Object.defineProperty(navigator, "serial", {
      configurable: true,
      value: { requestPort: vi.fn().mockResolvedValue(port) },
    });
    const client = new MagicBoxSerialClient(onUnexpectedDisconnect);
    await connectWithoutDelays(client);

    port.emitDisconnect();
    await vi.waitFor(() => expect(port.close).toHaveBeenCalledTimes(1));
    port.emitDisconnect();

    expect(onUnexpectedDisconnect).toHaveBeenCalledTimes(1);
    expect(port.readable.locked).toBe(false);
    expect(port.writable.locked).toBe(false);
  });
  it("ignores frames from another transfer while downloading a game", async () => {
    const client = new MagicBoxSerialClient();
    const send = vi.fn().mockResolvedValue(undefined);
    const nextMessage = vi.fn()
      .mockResolvedValueOnce({ type: "savedGameTransferStart", transferId: "foreign", gameId: 99, playersCount: 1, turnsCount: 0 })
      .mockResolvedValueOnce({ type: "savedGameTransferStart", transferId: "target", gameId: 7, playersCount: 1, turnsCount: 0 })
      .mockResolvedValueOnce({ type: "savedGameMeta", transferId: "target", gameId: 7, startedAt: "2026-09-10T12:00:00Z" })
      .mockResolvedValueOnce({ type: "savedGamePlayer", transferId: "target", gameId: 7, player: { position: 1, uid: "P1", colorCode: "AM", name: "Ana" } })
      .mockResolvedValueOnce({ type: "savedGameTransferComplete", transferId: "foreign", gameId: 7, status: "ok" })
      .mockResolvedValueOnce({ type: "savedGameTransferComplete", transferId: "target", gameId: 7, status: "ok" });
    Object.assign(client, { send, nextMessage });

    const game = await client.downloadGame(7);

    expect(game.summary.gameId).toBe(7);
    expect(game.players).toHaveLength(1);
  });

  it("rejects a saved-games list with missing chunks", async () => {
    const client = new MagicBoxSerialClient();
    Object.assign(client, {
      send: vi.fn().mockResolvedValue(undefined),
      nextMessage: vi.fn().mockResolvedValue({ type: "savedGamesList", chunkIndex: 1, isLastChunk: true, count: 1, games: [{ gameId: 7 }] }),
    });

    await expect(client.listGames()).rejects.toThrow("falta el bloque 0");
  });

  it("rejects an incomplete delete acknowledgement", async () => {
    const client = new MagicBoxSerialClient();
    Object.assign(client, {
      send: vi.fn().mockResolvedValue(undefined),
      nextMessage: vi.fn().mockResolvedValue({ type: "deleteGamesEnd", status: "complete", deleted: 1, notFound: 0, errors: 0 }),
    });

    await expect(client.deleteGames([7, 8])).rejects.toThrow("1/2");
  });

});
