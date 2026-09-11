export type MagicBoxColorCode = "AM" | "NA" | "VE" | "VI" | "CI" | "MA" | string;

export interface DeviceGameSummary {
  gameId: number;
  startedAt: string;
  sourceStartedAt?: string;
  durationSeconds: number;
  totalPlayers: number;
  deckName: string;
}

export interface DeviceGamePlayer {
  position: number;
  uid: string;
  colorCode: MagicBoxColorCode;
  name: string;
}

export interface DeviceGameTurn {
  turnNumber: number;
  playerUid: string;
  cardId: string;
  correct: boolean;
  difficulty: string;
  timestamp: number;
  playTimeSeconds: number;
}

export interface DeviceGameDownload {
  summary: DeviceGameSummary;
  players: DeviceGamePlayer[];
  turns: DeviceGameTurn[];
}

export interface MagicBoxDeviceInfo {
  deviceId: string;
  firmwareVersion: string;
  hardware: string;
}

export type ParticipantTarget =
  | { kind: "student"; id: string; name: string }
  | { kind: "profile"; id: string; name: string }
  | { kind: "manual"; id: string; name: string };

export interface ImportedGame extends DeviceGameDownload {
  assignments: Record<string, ParticipantTarget>;
}
