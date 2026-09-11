import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeviceImportCenter } from "@/features/device-import/device-import-center";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  getDeviceInfo: vi.fn(),
  listGames: vi.fn(),
  downloadGame: vi.fn(),
  deleteGames: vi.fn(),
  disconnect: vi.fn(),
  uploadRawGameSync: vi.fn(),
  uploadGamesBatch: vi.fn(),
  invalidateQueries: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}));

vi.mock("@/components/ui/modal", () => ({
  Modal: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) => open ? <div role="dialog" aria-label={title}>{children}</div> : null,
}));

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => ({
    tokens: { accessToken: "token", refreshToken: "refresh" },
    user: { id: "user-1", identityId: "identity-1", email: "ana@example.com", firstName: "Ana", lastName: "Admin", fullName: "Ana Admin", educationalCenterId: "institution-1", roles: ["admin"], permissions: [], raw: {} },
  }),
}));

vi.mock("@/features/device-import/web-serial", () => ({
  supportsWebSerial: () => true,
  MagicBoxSerialClient: class {
    connect = mocks.connect;
    getDeviceInfo = mocks.getDeviceInfo;
    listGames = mocks.listGames;
    downloadGame = mocks.downloadGame;
    deleteGames = mocks.deleteGames;
    disconnect = mocks.disconnect;
  },
}));

vi.mock("@/features/devices/api", () => ({
  useDevices: () => ({ data: { data: [{ id: "device-record-1", deviceId: "AABBCCDDEEFF", name: "MagicBox Aula Norte", educationalCenterId: "institution-1", educationalCenterName: "Colegio Demo", assignmentScope: "institution", ownerUserId: "user-1", ownerUserName: "Ana Admin", ownerUserEmail: "ana@example.com", firmwareVersion: "V2.3.22", status: "online", deviceMetadata: {}, raw: {} }] } }),
}));

vi.mock("@/features/institutions/api", () => ({
  useInstitutions: () => ({ data: { data: [{ id: "institution-1", name: "Colegio Demo" }] } }),
}));

vi.mock("@/features/profiles/api", () => ({
  useProfilesOverview: () => ({ data: [], refetch: vi.fn() }),
  createHomeProfile: vi.fn(),
}));

vi.mock("@/features/students/api", () => ({
  useAllStudents: () => ({ data: { data: [] } }),
}));

vi.mock("@/features/settings/api", () => ({
  useOtaRelease: () => ({ data: undefined }),
}));

vi.mock("@/features/games/api", () => ({
  uploadRawGameSync: mocks.uploadRawGameSync,
  uploadGamesBatch: mocks.uploadGamesBatch,
}));

vi.mock("@/features/device-import/imported-game-charts", () => ({
  ImportedGameCharts: () => <div>charts</div>,
}));

vi.mock("@/features/syncs/sync-navigation", () => ({
  SyncNavigation: () => <div>sync navigation</div>,
}));

const downloadedGame = {
  summary: { gameId: 7, startedAt: "2026-09-10T12:00:00.000Z", durationSeconds: 40, totalPlayers: 1, deckName: "Demo" },
  players: [{ position: 1, uid: "p1", colorCode: "AM", name: "Jugador 1" }],
  turns: [{ turnNumber: 1, playerUid: "p1", cardId: "1DACCAD8A00000", correct: true, difficulty: "3102", timestamp: 1, playTimeSeconds: 2 }],
};

const uploadedGame = {
  id: "cloud-game-7",
  educationalCenterId: "institution-1",
  bleDeviceId: "device-record-1",
  gameId: 7,
  deckName: "Demo",
  totalPlayers: 1,
  startDate: "2026-09-10T12:00:00.000Z",
  players: [],
  turns: [],
  raw: {},
};

describe("DeviceImportCenter cable actions", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.connect.mockResolvedValue(undefined);
    mocks.getDeviceInfo.mockResolvedValue({ deviceId: "AABBCCDDEEFF", firmwareVersion: "V2.3.22", hardware: "MagicBox V3" });
    mocks.listGames.mockResolvedValue([downloadedGame.summary]);
    mocks.downloadGame.mockResolvedValue(downloadedGame);
    mocks.uploadRawGameSync.mockResolvedValue({});
    mocks.uploadGamesBatch.mockResolvedValue([uploadedGame]);
    mocks.deleteGames.mockResolvedValue(undefined);
    mocks.disconnect.mockResolvedValue(undefined);
    mocks.invalidateQueries.mockResolvedValue(undefined);
  });

  it("shows device/game metadata and keeps upload and deletion as separate popup-confirmed actions", async () => {
    render(<DeviceImportCenter />);

    fireEvent.click(screen.getByRole("button", { name: "Conectar" }));
    expect(await screen.findByText("MagicBox Aula Norte")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Leer partidas" }));
    expect(await screen.findByRole("button", { name: /Subir 1 partidas/ })).toBeInTheDocument();
    expect(screen.getAllByText("Colegio Demo").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ana Admin").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/10 .*2026/i).length).toBeGreaterThan(0);

    const deckNameInput = screen.getByLabelText("Nombre del mazo utilizado");
    expect(deckNameInput).toHaveValue("3.1 Geometría | Fácil");
    fireEvent.change(deckNameInput, { target: { value: "Mazo personalizado" } });

    const deleteButton = screen.getByRole("button", { name: /Borrar 1 originales/ });
    expect(deleteButton).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /Subir 1 partidas/ }));
    expect(await screen.findByRole("dialog", { name: "Subida completada" })).toBeInTheDocument();
    expect(mocks.uploadGamesBatch).toHaveBeenCalledWith("token", expect.objectContaining({ games: [expect.objectContaining({ deck_name: "Mazo personalizado" })] }));
    expect(mocks.deleteGames).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    await waitFor(() => expect(deleteButton).toBeEnabled());
    fireEvent.click(deleteButton);
    expect(await screen.findByRole("dialog", { name: "Confirmar borrado" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Borrar originales" }));
    expect(await screen.findByRole("dialog", { name: "Borrado completado" })).toBeInTheDocument();
    expect(mocks.deleteGames).toHaveBeenCalledWith([7]);
  });

  it("shows an immediate modal when the connected device has no saved games", async () => {
    mocks.listGames.mockResolvedValue([]);
    render(<DeviceImportCenter />);

    fireEvent.click(screen.getByRole("button", { name: "Conectar" }));
    await screen.findByText("MagicBox Aula Norte");
    fireEvent.click(screen.getByRole("button", { name: "Leer partidas" }));

    expect(await screen.findByRole("dialog", { name: "No hay partidas para sincronizar" })).toBeInTheDocument();
    expect(screen.getByText(/no tiene partidas guardadas internamente/i)).toBeInTheDocument();
  });
});
