import type { DeviceGameDownload, DeviceGamePlayer, DeviceGameSummary, DeviceGameTurn, MagicBoxDeviceInfo } from "@/features/device-import/types";

export type ProtocolMessage = Record<string, unknown>;

function asRecord(value: unknown): ProtocolMessage {
  return value && typeof value === "object" && !Array.isArray(value) ? value as ProtocolMessage : {};
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : fallback;
}

export function parseProtocolLine(line: string): ProtocolMessage | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  try {
    return asRecord(JSON.parse(trimmed));
  } catch {
    return null;
  }
}

export function encodeProtocolCommand(command: ProtocolMessage) {
  return `${JSON.stringify(command)}\n`;
}

export function normalizeGameSummary(input: unknown): DeviceGameSummary | null {
  const record = asRecord(input);
  const gameId = asNumber(record.gameId ?? record.game_id);
  if (gameId <= 0) return null;
  return {
    gameId,
    startedAt: asString(record.startedAt ?? record.start_date),
    durationSeconds: asNumber(record.duration ?? record.durationSeconds),
    totalPlayers: asNumber(record.totalPlayers),
    deckName: asString(record.deckName, "UNKNOWN"),
  };
}

export function normalizeDeviceInfo(input: unknown): MagicBoxDeviceInfo | null {
  const record = asRecord(input);
  if (record.type !== "deviceInfo") return null;
  const deviceId = asString(record.deviceId ?? record.chipId).replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (deviceId.length !== 12) return null;
  return {
    deviceId,
    firmwareVersion: asString(record.firmwareVersion ?? record.version, "Desconocida"),
    hardware: asString(record.hardware, "MagicBox"),
  };
}

export function buildDownloadedGame(messages: ProtocolMessage[]): DeviceGameDownload {
  const metaMessage = messages.find((message) => message.type === "savedGameMeta");
  const startMessage = messages.find((message) => message.type === "savedGameTransferStart");
  const summary = normalizeGameSummary({ ...startMessage, ...metaMessage });
  if (!summary) throw new Error("La MagicBox no informó un gameId válido.");

  const players: DeviceGamePlayer[] = messages
    .filter((message) => message.type === "savedGamePlayer")
    .map((message) => asRecord(message.player))
    .map((player) => ({
      position: asNumber(player.position),
      uid: asString(player.uid),
      colorCode: asString(player.colorCode, "AM"),
      name: asString(player.name, "Jugador"),
    }))
    .filter((player) => player.position > 0 && player.uid.length > 0);

  const turns: DeviceGameTurn[] = messages
    .filter((message) => message.type === "savedGameTurnsChunk")
    .flatMap((message) => Array.isArray(message.turns) ? message.turns : [])
    .map(asRecord)
    .map((turn) => ({
      turnNumber: asNumber(turn.turnNumber),
      playerUid: asString(turn.playerUid ?? turn.playerId),
      cardId: asString(turn.cardId),
      correct: turn.correct === true || asNumber(turn.correct) === 1,
      difficulty: asString(turn.difficulty, "UNKNOWN"),
      timestamp: asNumber(turn.timestamp),
      playTimeSeconds: asNumber(turn.playTimeSeconds),
    }))
    .filter((turn) => turn.turnNumber > 0 && turn.playerUid.length > 0 && turn.cardId.length > 0);

  if (players.length === 0) throw new Error(`La partida ${summary.gameId} llegó sin jugadores.`);
  return { summary: { ...summary, totalPlayers: players.length }, players, turns };
}

export function turnDateFromGameStart(startedAt: string, timestampSeconds: number) {
  const parsed = Date.parse(startedAt);
  const base = Number.isFinite(parsed) ? parsed : Date.now();
  return new Date(base + Math.max(0, timestampSeconds) * 1000).toISOString();
}
