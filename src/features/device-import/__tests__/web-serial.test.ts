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
});
