import { beforeEach, describe, expect, it, vi } from "vitest";
import { listUsers } from "@/features/users/api";

const apiRequestMock = vi.fn();

vi.mock("@/lib/api/fetcher", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  normalizeImageUrl: (value?: string | null) => value || null,
}));

describe("users api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads every backend page so the superadmin roster is not truncated", async () => {
    apiRequestMock
      .mockResolvedValueOnce({
        data: [
          {
            id: "user-1",
            first_name: "Ana",
            last_name: "Admin",
            email: "ana@example.com",
            roles: ["admin"],
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
            id: "user-101",
            first_name: "Zoe",
            last_name: "Mobile",
            email: "zoe@example.com",
            roles: ["family"],
          },
        ],
        page: 2,
        limit: 100,
        total: 101,
        total_pages: 2,
      });

    const result = await listUsers("demo-token");

    expect(apiRequestMock).toHaveBeenCalledTimes(2);
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      1,
      "/user",
      expect.objectContaining({
        token: "demo-token",
        searchParams: { page: 1, limit: 100, sort_by: "created_at", order: "desc", include_deleted: true },
      }),
    );
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      2,
      "/user",
      expect.objectContaining({
        token: "demo-token",
        searchParams: { page: 2, limit: 100, sort_by: "created_at", order: "desc", include_deleted: true },
      }),
    );
    expect(result.total).toBe(101);
    expect(result.data.map((item) => item.id)).toEqual(["user-1", "user-101"]);
  });
});
