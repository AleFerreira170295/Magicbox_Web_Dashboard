import type { JsonObject } from "@/lib/api/types";

export interface GamePlayerRecord {
  id: string;
  gameDataId: string;
  studentId?: string | null;
  externalPlayerUid?: string | null;
  playerName?: string | null;
  playerSource?: string | null;
  position: number;
  cardColor?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  raw: JsonObject;
}

export interface GameTurnRecord {
  id: string;
  gameDataId: string;
  studentId?: string | null;
  gamePlayerId?: string | null;
  externalPlayerUid?: string | null;
  turnNumber: number;
  position: number;
  cardId?: string | null;
  success: boolean;
  difficulty?: string | null;
  turnStartDate?: string | null;
  playTimeSeconds?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  raw: JsonObject;
}

export interface GameRecord {
  id: string;
  educationalCenterId?: string | null;
  bleDeviceId?: string | null;
  gameId?: number | null;
  deckName?: string | null;
  totalPlayers?: number | null;
  startDate?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  players: GamePlayerRecord[];
  turns: GameTurnRecord[];
  raw: JsonObject;
}
