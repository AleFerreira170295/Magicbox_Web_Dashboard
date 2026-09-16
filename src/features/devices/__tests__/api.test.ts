import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDeviceByDeviceId } from "@/features/devices/api";

const apiRequestMock = vi.fn();

vi.mock("@/lib/api/fetcher", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
}));

describe("devices api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads one authoritative device by its physical USB ID", async () => {
    apiRequestMock.mockResolvedValueOnce({
      id: "caracal-record",
      device_id: "CC88311D16F0",
      name: "Caracal205",
      assignment_scope: "home",
      owner_user_id: "owner-205",
      owner_user_name: "Owner Caracal",
      firmware_version: "V2.3.14",
      device_metadata: {},
    });

    const result = await getDeviceByDeviceId("demo-token", "CC88311D16F0");

    expect(apiRequestMock).toHaveBeenCalledWith(
      "/ble-device/device-id/CC88311D16F0",
      { token: "demo-token" },
    );
    expect(result).toMatchObject({
      deviceId: "CC88311D16F0",
      name: "Caracal205",
      assignmentScope: "home",
      ownerUserName: "Owner Caracal",
    });
  });
});
