import type { AuthUser } from "@/features/auth/types";
import type { DeviceRecord } from "@/features/devices/types";
import type { GameRecord, GameTurnRecord } from "@/features/games/types";
import type { InstitutionRecord } from "@/features/institutions/types";

export type GameRowRecord = GameRecord & {
  institution: InstitutionRecord | null;
  device: DeviceRecord | null;
  ownerLabel: string;
  accessRelation: string;
  isOwnedByCurrentUser: boolean;
  isInstitutionVisible: boolean;
  hasUnresolvedAssociation: boolean;
  playerCount: number;
  manualCount: number;
  registeredCount: number;
  playerMixLabel: string;
};

export function getPlayerMixLabel(manualCount: number, registeredCount: number) {
  if (manualCount > 0 && registeredCount > 0) return "mixta";
  if (manualCount > 0) return "manual";
  if (registeredCount > 0) return "registrada";
  return "sin jugadores";
}

export function buildGameRows(games: GameRecord[], devices: DeviceRecord[], institutions: InstitutionRecord[], currentUser?: AuthUser | null) {
  const deviceById = new Map(devices.map((device) => [device.id, device]));
  const institutionById = new Map(institutions.map((institution) => [institution.id, institution]));
  const currentUserEmail = (currentUser?.email || "").trim().toLowerCase();

  return games.map((game) => {
    const institution = game.educationalCenterId ? institutionById.get(game.educationalCenterId) || null : null;
    const device = game.bleDeviceId ? deviceById.get(game.bleDeviceId) || null : null;
    const isOwnedByCurrentUser = Boolean(
      device && ((currentUser?.id && device.ownerUserId === currentUser.id) || (currentUserEmail && (device.ownerUserEmail || "").trim().toLowerCase() === currentUserEmail)),
    );
    const isInstitutionVisible = Boolean(device?.educationalCenterId && currentUser?.educationalCenterId && device.educationalCenterId === currentUser.educationalCenterId);

    const accessRelation = isOwnedByCurrentUser
      ? "mis dispositivos"
      : isInstitutionVisible
        ? "institución visible"
        : device?.ownerUserId || device?.ownerUserEmail
          ? "compartido visible"
          : "sin asociación resuelta";

    const manualCount = game.players.filter((player) => player.playerSource === "manual").length;
    const registeredCount = game.players.filter((player) => player.playerSource !== "manual").length;

    return {
      ...game,
      institution,
      device,
      ownerLabel: device?.ownerUserName || device?.ownerUserEmail || "sin responsable",
      accessRelation,
      isOwnedByCurrentUser,
      isInstitutionVisible,
      hasUnresolvedAssociation: !device || !game.educationalCenterId || accessRelation === "sin asociación resuelta",
      playerCount: game.players.length || game.totalPlayers || 0,
      manualCount,
      registeredCount,
      playerMixLabel: getPlayerMixLabel(manualCount, registeredCount),
    } satisfies GameRowRecord;
  });
}

export function resolveTurnPlayerLabel(game: Pick<GameRowRecord, "id" | "players">, playerId?: string | null, externalPlayerUid?: string | null, studentId?: string | null) {
  const player = game.players.find((item) =>
    (playerId && item.id === playerId) ||
    (externalPlayerUid && item.externalPlayerUid === externalPlayerUid) ||
    (studentId && item.studentId === studentId),
  );

  return player?.playerName || player?.externalPlayerUid || player?.studentId || externalPlayerUid || studentId || playerId || "sin jugador enlazado";
}

export function buildTurnOutcomeSeries(turns: GameTurnRecord[]) {
  return [...turns]
    .sort((a, b) => a.turnNumber - b.turnNumber)
    .map((turn) => ({
      label: `T${turn.turnNumber}`,
      turnNumber: turn.turnNumber,
      aciertos: turn.success ? 1 : 0,
      errores: turn.success ? 0 : 1,
      tiempo: turn.playTimeSeconds || 0,
    }));
}

export function buildTurnOutcomeSeriesByParticipant(game: Pick<GameRowRecord, "id" | "players" | "turns">) {
  const groups = new Map<
    string,
    {
      participantLabel: string;
      participantKey: string;
      turns: GameTurnRecord[];
    }
  >();

  for (const turn of [...game.turns].sort((a, b) => a.turnNumber - b.turnNumber)) {
    const participantKey = turn.gamePlayerId || turn.externalPlayerUid || turn.studentId || `turn-${turn.id}`;
    const existing = groups.get(participantKey);

    if (existing) {
      existing.turns.push(turn);
      continue;
    }

    groups.set(participantKey, {
      participantKey,
      participantLabel: resolveTurnPlayerLabel(game, turn.gamePlayerId, turn.externalPlayerUid, turn.studentId),
      turns: [turn],
    });
  }

  return Array.from(groups.values()).map((group) => ({
    participantKey: group.participantKey,
    participantLabel: group.participantLabel,
    series: buildTurnOutcomeSeries(group.turns),
  }));
}

export function buildSyncRelationHref(game: { bleDeviceId?: string | null; device?: { deviceId?: string | null; name?: string | null } | null }) {
  const params = new URLSearchParams();
  if (game.bleDeviceId) params.set("bleDeviceId", game.bleDeviceId);
  if (game.device?.deviceId) params.set("deviceId", game.device.deviceId);
  if (game.device?.name) params.set("deviceName", game.device.name);
  const query = params.toString();
  return query ? `/syncs?${query}` : "/syncs";
}
