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

function firstRecord(...values: unknown[]) {
  for (const value of values) {
    const record = asRecord(value);
    if (Object.keys(record).length > 0) return record;
  }
  return {};
}

export function normalizeProtocolMessage(input: unknown): ProtocolMessage {
  const raw = asRecord(input);
  const payload = firstRecord(raw.payload, raw.data);
  const normalized = { ...raw, ...payload };
  const type = asString(normalized.type ?? normalized.event ?? normalized.message ?? normalized.command);
  if (type) normalized.type = type;
  const transferId = asString(normalized.transferId ?? normalized.transfer_id);
  if (transferId) normalized.transferId = transferId;
  const gameId = asNumber(normalized.gameId ?? normalized.game_id ?? normalized.gid ?? normalized.id);
  if (gameId > 0) normalized.gameId = gameId;
  return normalized;
}

export function parseProtocolLine(line: string): ProtocolMessage | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) return null;
  try {
    return normalizeProtocolMessage(JSON.parse(trimmed));
  } catch {
    return null;
  }
}

export function encodeProtocolCommand(command: ProtocolMessage) {
  return JSON.stringify(command) + "\n";
}

function resolveGameStartedAt(sourceStartedAt: string, durationSeconds: number, receivedAtMs: number) {
  const trimmed = sourceStartedAt.trim();
  const isFirmwarePlaceholder = /^2024-01-01(?:[ T]00:00(?::00)?(?:\.000)?(?:Z)?)?$/u.test(trimmed);
  const parsed = Date.parse(trimmed);
  if (!isFirmwarePlaceholder && Number.isFinite(parsed)) {
    return { startedAt: new Date(parsed).toISOString(), timestampQuality: "exact" as const };
  }
  return {
    startedAt: new Date(receivedAtMs - Math.max(0, durationSeconds) * 1000).toISOString(),
    timestampQuality: "estimated" as const,
  };
}

export function normalizeGameSummary(input: unknown, receivedAtMs = Date.now()): DeviceGameSummary | null {
  const record = normalizeProtocolMessage(input);
  const nested = firstRecord(record.game, record.gameInfo, record.meta);
  const source = { ...record, ...nested };
  const gameId = asNumber(source.gameId ?? source.game_id ?? source.gid ?? source.id);
  if (gameId <= 0) return null;
  const sourceStartedAt = asString(source.startedAt ?? source.startDate ?? source.start_date ?? source.date ?? source.createdAt);
  const durationMs = asNumber(source.durationMs);
  const durationSeconds = asNumber(source.durationSeconds ?? source.duration ?? source.playTimeSeconds, durationMs > 0 ? durationMs / 1000 : 0);
  const startedAt = resolveGameStartedAt(sourceStartedAt, durationSeconds, receivedAtMs);
  const playersValue = source.totalPlayers ?? source.playersCount ?? source.playerCount ?? source.players;
  return {
    gameId,
    startedAt: startedAt.startedAt,
    timestampQuality: startedAt.timestampQuality,
    sourceStartedAt,
    durationSeconds,
    totalPlayers: Array.isArray(playersValue) ? playersValue.length : asNumber(playersValue),
    deckName: asString(source.deckName ?? source.deck ?? source.deck_name, "UNKNOWN"),
  };
}

export function normalizeDeviceInfo(input: unknown): MagicBoxDeviceInfo | null {
  const record = normalizeProtocolMessage(input);
  if (record.type !== "deviceInfo") return null;
  const deviceId = asString(record.deviceId ?? record.chipId).replace(/[^a-fA-F0-9]/g, "").toUpperCase();
  if (deviceId.length !== 12) return null;
  return {
    deviceId,
    firmwareVersion: asString(record.firmwareVersion ?? record.version, "Desconocida"),
    hardware: asString(record.hardware ?? record.hardwareRevision, "MagicBox"),
  };
}

function normalizePlayer(message: ProtocolMessage): DeviceGamePlayer | null {
  const player = firstRecord(message.player, message);
  const uid = asString(player.uid ?? player.id ?? player.playerUid ?? player.playerId ?? player.playerID);
  const position = asNumber(player.position ?? player.index);
  if (!uid || position <= 0) return null;
  return {
    position,
    uid,
    colorCode: asString(player.colorCode ?? player.color, "AM").toUpperCase(),
    name: asString(player.name ?? player.playerName, "Jugador"),
  };
}

function turnsFromMessage(message: ProtocolMessage) {
  const values = message.turns ?? message.chunk ?? message.data;
  return Array.isArray(values) ? values : [];
}

function normalizeTurn(input: unknown): DeviceGameTurn | null {
  const turn = asRecord(input);
  const playerUid = asString(turn.playerUid ?? turn.uid ?? turn.playerId ?? turn.playerID ?? turn.id);
  const turnNumber = asNumber(turn.turnNumber ?? turn.turn_number);
  const cardId = asString(turn.cardId ?? turn.card_id);
  if (!playerUid || turnNumber <= 0 || !cardId) return null;
  const timestamp = asNumber(turn.timestamp ?? turn.time ?? turn.ts);
  const explicitPlayTime = asNumber(turn.playTimeSeconds ?? turn.play_time_seconds);
  return {
    turnNumber,
    playerUid,
    cardId,
    correct: turn.correct === true || turn.success === true || asNumber(turn.correct ?? turn.success) === 1,
    difficulty: asString(turn.difficulty, "UNKNOWN"),
    timestamp,
    playTimeSeconds: explicitPlayTime > 0 ? explicitPlayTime : timestamp > 0 && timestamp < 946_684_800_000 ? timestamp / 1000 : 0,
  };
}

export function buildDownloadedGame(messages: ProtocolMessage[], receivedAtMs = Date.now()): DeviceGameDownload {
  const normalized = messages.map(normalizeProtocolMessage);
  const metaMessage = normalized.find((message) => message.type === "savedGameMeta");
  const startMessage = normalized.find((message) => message.type === "savedGameTransferStart");
  const summary = normalizeGameSummary({ ...startMessage, ...metaMessage }, receivedAtMs);
  if (!summary) throw new Error("La MagicBox no informó un gameId válido.");

  const playersByUid = new Map<string, DeviceGamePlayer>();
  normalized.filter((message) => message.type === "savedGamePlayer").map(normalizePlayer)
    .filter((player): player is DeviceGamePlayer => player !== null)
    .forEach((player) => playersByUid.set(player.uid, player));
  const players = [...playersByUid.values()].sort((left, right) => left.position - right.position);

  const turnsByKey = new Map<string, DeviceGameTurn>();
  normalized.filter((message) => message.type === "savedGameTurnsChunk").flatMap(turnsFromMessage).map(normalizeTurn)
    .filter((turn): turn is DeviceGameTurn => turn !== null)
    .forEach((turn) => turnsByKey.set([turn.playerUid, turn.turnNumber, turn.cardId, turn.timestamp, turn.correct].join("|"), turn));
  const turns = [...turnsByKey.values()].sort((left, right) => left.turnNumber - right.turnNumber);

  const expectedPlayers = asNumber(startMessage?.playersCount ?? startMessage?.totalPlayers ?? metaMessage?.playersCount ?? metaMessage?.totalPlayers);
  const expectedTurns = asNumber(startMessage?.turnsCount ?? metaMessage?.turnsCount);
  if (players.length === 0) throw new Error("La partida " + summary.gameId + " llegó sin jugadores.");
  if (expectedPlayers > 0 && players.length < expectedPlayers) throw new Error("La partida " + summary.gameId + " llegó incompleta: " + players.length + "/" + expectedPlayers + " jugadores.");
  if (expectedTurns > 0 && turns.length < expectedTurns) throw new Error("La partida " + summary.gameId + " llegó incompleta: " + turns.length + "/" + expectedTurns + " turnos.");
  const playerUids = new Set(players.map((player) => player.uid));
  if (turns.some((turn) => !playerUids.has(turn.playerUid))) throw new Error("La partida " + summary.gameId + " contiene un turno sin jugador asociado.");
  return { summary: { ...summary, totalPlayers: players.length }, players, turns };
}

export function turnDateFromGameStart(startedAt: string, timestampMilliseconds: number) {
  const parsed = Date.parse(startedAt);
  const base = Number.isFinite(parsed) ? parsed : Date.now();
  return new Date(base + Math.max(0, timestampMilliseconds)).toISOString();
}
