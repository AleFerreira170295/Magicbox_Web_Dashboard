import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAccountProfile } from "@/features/account-profile/api";

const apiRequestMock = vi.fn();

vi.mock("@/lib/api/fetcher", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  normalizeImageUrl: (value?: string | null) => value || null,
}));

describe("account profile api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the signed-in user through the identity profile endpoint", async () => {
    apiRequestMock.mockResolvedValue({
      identity: { id: "identity-1" },
      user: {
        id: "user-1",
        identity_id: "identity-1",
        first_name: "Paula",
        last_name: "Control",
        email: "paula@example.com",
        roles: ["admin"],
      },
    });

    const profile = await getAccountProfile("demo-token");

    expect(apiRequestMock).toHaveBeenCalledWith("/identity/me", { token: "demo-token" });
    expect(profile).toMatchObject({
      id: "user-1",
      identityId: "identity-1",
      firstName: "Paula",
      lastName: "Control",
      roles: ["admin"],
    });
  });
});
