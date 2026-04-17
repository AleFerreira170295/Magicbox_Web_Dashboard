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
            players: [{ id: "player-1", playerName: "Ana" }],
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

  it("surfaces recent activity, participants and turn success for the teacher view", () => {
    renderDashboard();

    expect(screen.getByText("Docente")).toBeInTheDocument();
    expect(screen.getByText("Partidas 7 días")).toBeInTheDocument();
    expect(screen.getByText("Estudiantes participantes")).toBeInTheDocument();
    expect(screen.getByText("Tiempo promedio por turno")).toBeInTheDocument();
    expect(screen.getByText("Éxito de turnos")).toBeInTheDocument();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
    expect(screen.getByText(/Volumen reciente de juego para leer continuidad de uso/i)).toBeInTheDocument();
    expect(screen.getByText(/Cuenta única de jugadores visibles en la muestra actual/i)).toBeInTheDocument();
    expect(screen.getByText(/100%/i)).toBeInTheDocument();
  });

  it("shows empty-state copy when the teacher view has no dated activity yet", () => {
    useGamesMock.mockReturnValue(okQuery(okPaginated([])));
    useDevicesMock.mockReturnValue(okQuery(okPaginated([])));
    useSyncSessionsMock.mockReturnValue(okQuery(okPaginated([])));

    renderDashboard();

    expect(screen.getByText("Todavía no hay actividad fechada para graficar.")).toBeInTheDocument();
  });

  it("shows an error banner when one teacher dashboard feed fails", () => {
    useSyncSessionsMock.mockReturnValue(errorQuery("Syncs docentes caídas"));

    renderDashboard();

    expect(screen.getByText(/No pude cargar una parte del dashboard/i)).toBeInTheDocument();
    expect(screen.getByText(/Syncs docentes caídas/i)).toBeInTheDocument();
  });
});
