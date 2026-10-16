export type UploadQueueState = "queued" | "uploading_raw" | "uploading_batch" | "confirmed" | "failed";

export type UploadQueueLastError = {
  title: string;
  message: string;
  status?: number;
  endpoint?: string;
  method?: string;
};

export type UploadQueueRecord = {
  id: string;
  createdAt: number;
  updatedAt: number;
  state: UploadQueueState;

  uploaderUserId?: string | null;
  uploaderIdentityId?: string | null;
  deviceId: string;
  educationalCenterId: string | null;
  selectedGameIds: number[];

  rawEnvelopes: unknown[];
  batchPayload: unknown;

  attemptsRaw: number;
  attemptsBatch: number;
  lastError?: UploadQueueLastError;
};

const STORAGE_KEY = "magicbox:uploadQueue:v1";

function safeParseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function now() {
  return Date.now();
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `upload_${now()}_${Math.random().toString(16).slice(2)}`;
}

export function isUploadQueueEnabled() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function loadUploadQueue(): UploadQueueRecord[] {
  if (!isUploadQueueEnabled()) return [];
  const stored = safeParseJson<UploadQueueRecord[]>(window.localStorage.getItem(STORAGE_KEY));
  if (!stored || !Array.isArray(stored)) return [];
  return stored;
}

export function persistUploadQueue(records: UploadQueueRecord[]) {
  if (!isUploadQueueEnabled()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function enqueueUpload(input: Omit<UploadQueueRecord, "id" | "createdAt" | "updatedAt" | "state" | "attemptsRaw" | "attemptsBatch">) {
  const record: UploadQueueRecord = {
    ...input,
    id: createId(),
    createdAt: now(),
    updatedAt: now(),
    state: "queued",
    attemptsRaw: 0,
    attemptsBatch: 0,
  };
  const records = loadUploadQueue();
  records.unshift(record);
  persistUploadQueue(records);
  return record;
}

export function updateUploadRecord(id: string, updater: (record: UploadQueueRecord) => UploadQueueRecord) {
  const records = loadUploadQueue();
  const index = records.findIndex((r) => r.id === id);
  if (index < 0) return;
  const next = updater(records[index]);
  next.updatedAt = now();
  records.splice(index, 1, next);
  persistUploadQueue(records);
}

export function removeUploadRecord(id: string) {
  const records = loadUploadQueue().filter((r) => r.id !== id);
  persistUploadQueue(records);
}

export function clearUploadQueue() {
  if (!isUploadQueueEnabled()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

