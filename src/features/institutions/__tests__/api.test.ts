import { beforeEach, describe, expect, it, vi } from "vitest";
import { listInstitutions } from "@/features/institutions/api";

const apiRequestMock = vi.fn();

vi.mock("@/lib/api/fetcher", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
  normalizeImageUrl: (value?: string | null) => value || null,
}));

describe("institutions api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends name search to the backend with a contains filter", async () => {
    apiRequestMock.mockResolvedValueOnce({
      data: [
        {
          id: "ec-1",
          name: "Colegio Norte",
          email: "colegio@example.com",
          phone_number: "+598111111",
          address: {
            address_first_line: "Calle 123",
            country_code: "UY",
            city: "Montevideo",
          },
        },
      ],
      page: 1,
      limit: 100,
      total: 1,
      total_pages: 1,
    });

    const result = await listInstitutions("demo-token", { name: "  norte  " });

    expect(apiRequestMock).toHaveBeenCalledWith(
      "/educational-center",
      expect.objectContaining({
        token: "demo-token",
        searchParams: {
          page: 1,
          limit: 100,
          sort_by: "created_at",
          order: "desc",
          name__contains: "norte",
        },
      }),
    );
    expect(result.data.map((item) => item.name)).toEqual(["Colegio Norte"]);
  });
});
