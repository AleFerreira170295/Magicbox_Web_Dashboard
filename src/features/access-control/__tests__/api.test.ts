import { describe, expect, it, vi, beforeEach } from "vitest";
import { listPermissions } from "@/features/access-control/api";

const apiRequestMock = vi.fn();

vi.mock("@/lib/api/fetcher", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
}));

describe("access-control api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("paginates permissions with backend-safe limit", async () => {
    apiRequestMock
      .mockResolvedValueOnce({
        data: [
          {
            id: "perm-1",
            user_id: "user-1",
            feature_id: "feature-1",
            action_id: "action-1",
          },
        ],
        page: 1,
        limit: 100,
        total: 101,
        total_pages: 2,
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: "perm-2",
            user_id: "user-2",
            feature_id: "feature-1",
            action_id: "action-1",
          },
        ],
        page: 2,
        limit: 100,
        total: 101,
        total_pages: 2,
      });

    const result = await listPermissions("demo-token");

    expect(apiRequestMock).toHaveBeenCalledTimes(2);
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      1,
      "/access-control/permission",
      expect.objectContaining({
        token: "demo-token",
        searchParams: { page: 1, limit: 100, sort_by: "created_at", order: "desc" },
      }),
    );
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      2,
      "/access-control/permission",
      expect.objectContaining({
        token: "demo-token",
        searchParams: { page: 2, limit: 100, sort_by: "created_at", order: "desc" },
      }),
    );
    expect(result.total).toBe(101);
    expect(result.data.map((item) => item.id)).toEqual(["perm-1", "perm-2"]);
  });
});
