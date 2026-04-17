import type React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TeacherDashboard } from "@/features/dashboard/teacher-dashboard";

const useAuthMock = vi.fn();
const useGamesMock = vi.fn();
const useDevicesMock = vi.fn();
const useSyncSessionsMock = vi.fn();

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/games/api", () => ({
  useGames: (...args: unknown[]) => useGamesMock(...args),
}));

vi.mock("@/features/devices/api", () => ({
  useDevices: (...args: unknown[]) => useDevicesMock(...args),
}));

vi.mock("@/features/syncs/api", () => ({
  useSyncSessions: (...args: unknown[]) => useSyncSessionsMock(...args),
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Bar: () => null,
}));

function okQuery<T>(data: T) {
  return { data, isLoading: false, error: null };
}

function errorQuery(message: string) {
  return { data: undefined, isLoading: false, error: new Error(message) };
}

function okPaginated(data: unknown[]) {
  return { data, total: data.length, page: 1, limit: data.length || 1, total_pages: 1 };
}

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <TeacherDashboard />
    </QueryClientProvider>,
  );
}

describe("TeacherDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useAuthMock.mockReturnValue({
      tokens: { accessToken: "token", refreshToken: "refresh" },
      user: {
        fullName: "Tania Teacher",
        roles: ["teacher"],
        permissions: ["game_data:read"],
      },
    });

    useGamesMock.mockReturnValue(
      okQuery(
        okPaginated([
          {
            id: "game-1",
            deckName: "Animales",
            turns: [{ id: "turn-1", turnNumber: 1, playTimeSeconds: 30, success: true }],
          },
        ]),
      ),
    );
    useDevicesMock.mockReturnValue(okQuery(okPaginated([{ id: "device-1" }, { id: "device-2" }])));
    useSyncSessionsMock.mockReturnValue(okQuery(okPaginated([{ id: "sync-1", source: "magicbox" }])));
  });

  afterEach(() => {
    cleanup();
  });

  it("surfaces device, sync and game totals for the teacher command level", () => {
    renderDashboard();

    expect(screen.getByText("Docente")).toBeInTheDocument();
    expect(screen.getByText("Partidas visibles")).toBeInTheDocument();
    expect(screen.getByText("Dispositivos visibles")).toBeInTheDocument();
    expect(screen.getByText("Sincronizaciones visibles")).toBeInTheDocument();
    expect(screen.getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getByText(/Fuente base para el mapa operativo del parque MagicBox en circulación/i)).toBeInTheDocument();
    expect(screen.getByText(/Sirve para validar el flujo actual mientras completamos la capa lossless/i)).toBeInTheDocument();
  });

  it("shows empty-state copy when the teacher view has no recent syncs", () => {
    useGamesMock.mockReturnValue(okQuery(okPaginated([])));
    useDevicesMock.mockReturnValue(okQuery(okPaginated([])));
    useSyncSessionsMock.mockReturnValue(okQuery(okPaginated([])));

    renderDashboard();

    expect(screen.getByText("No hay sincronizaciones visibles todavía.")).toBeInTheDocument();
  });

  it("shows an error banner when one teacher dashboard feed fails", () => {
    useSyncSessionsMock.mockReturnValue(errorQuery("Syncs docentes caídas"));

    renderDashboard();

    expect(screen.getByText(/No pude cargar una parte del dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Syncs docentes caídas/i)).toBeInTheDocument();
  });
});
