import type { JsonObject } from "@/lib/api/types";

export type SyncSourceType =
  | "ble_sync"
  | "device_snapshot"
  | "game_download"
  | "notification"
  | "manual_backfill"
  | string;

export interface RawIngestionRecord {
  id: string;
  sourceType: SyncSourceType;
  receivedAt?: string | null;
  deviceId?: string | null;
  firmwareVersion?: string | null;
  appVersion?: string | null;
  syncSessionId?: string | null;
  gameId?: string | number | null;
  capturedAt?: string | null;
  checksumSha256?: string | null;
  rawPayload: JsonObject;
  rawFragments?: JsonObject[];
  unknownFields?: JsonObject;
  raw: JsonObject;
}

export interface SyncParticipant {
  id?: string | null;
  profileId?: string | null;
  profileName?: string | null;
  playerName?: string | null;
  cardUid?: string | null;
  position?: number | null;
  studentId?: string | null;
  externalPlayerUid?: string | null;
  raw: JsonObject;
}

export interface SyncSessionRecord {
  id: string;
  syncId?: string | null;
  source?: string | null;
  sourceType?: SyncSourceType | null;
  sessionType?: string | null;
  status?: string | null;
  bleDeviceId?: string | null;
  deviceId?: string | null;
  gameId?: string | number | null;
  deckName?: string | null;
  totalCards?: number | null;
  totalPlayers?: number | null;
  durationSeconds?: number | null;
  score?: number | null;
  finalResult?: string | null;
  gameEndReason?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  syncedAt?: string | null;
  capturedAt?: string | null;
  participants: SyncParticipant[];
  rawRecordIds: string[];
  rawPayload?: JsonObject | null;
  fragmentCount?: number | null;
  additionalFields: JsonObject;
  raw: JsonObject;
}
