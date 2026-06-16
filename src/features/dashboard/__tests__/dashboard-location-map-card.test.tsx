import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardLocationMapCard } from "@/features/dashboard/dashboard-location-map-card";

const fetchMock = vi.fn();

describe("DashboardLocationMapCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          { key: "institution-north", query: "Colegio Norte, Montevideo", lat: -34.85, lon: -56.17 },
          { key: "institution-south", query: "Colegio Sur, Montevideo", lat: -34.92, lon: -56.12 },
        ],
      }),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("zooms the embedded map to the selected institution from the side list", async () => {
    render(
      <DashboardLocationMapCard
        locations={[
          {
            key: "institution-north",
            label: "Colegio Norte",
            query: "Colegio Norte, Montevideo",
            detail: "Montevideo",
            kind: "institution",
            deviceCount: 4,
            institutionCount: 1,
          },
          {
            key: "institution-south",
            label: "Colegio Sur",
            query: "Colegio Sur, Montevideo",
            detail: "Montevideo",
            kind: "institution",
            deviceCount: 2,
            institutionCount: 1,
          },
        ]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Centrar mapa en Colegio Sur/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Centrar mapa en Colegio Sur/i }));

    const iframe = screen.getByTitle("Mapa de centros con dispositivos");
    expect(iframe).toHaveAttribute("src", expect.stringContaining("-34.92%2C-56.12"));
    expect(iframe).toHaveAttribute("src", expect.stringContaining("z=15"));
    expect(screen.getByRole("button", { name: /Centrar mapa en Colegio Sur/i })).toHaveAttribute("aria-pressed", "true");
  });
});
