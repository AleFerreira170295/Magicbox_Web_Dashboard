import type { JsonObject } from "@/lib/api/types";

export interface ProfileBoundDeviceRecord {
  id: string;
  deviceId?: string | null;
  name?: string | null;
}

export interface ProfileOverviewRecord {
  id: string;
  displayName: string;
  avatarUrl?: string | null;
  age?: number | null;
  ageCategory?: string | null;
  isActive: boolean;
  userId: string;
  userName?: string | null;
  userEmail?: string | null;
  educationalCenterId?: string | null;
  educationalCenterName?: string | null;
  bindingCount: number;
  activeBindingCount: number;
  cardUids: string[];
  boundDevices: ProfileBoundDeviceRecord[];
  sessionCount: number;
  lastSessionAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
  raw: JsonObject;
}
