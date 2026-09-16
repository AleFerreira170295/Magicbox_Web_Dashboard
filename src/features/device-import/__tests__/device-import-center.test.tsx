import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeviceImportCenter } from "@/features/device-import/device-import-center";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  getDeviceInfo: vi.fn(),
  listGames: vi.fn(),
  downloadGame: vi.fn(),
  deleteGames: vi.fn(),
  disconnect: vi.fn(),
  flashMagicBoxFirmware: vi.fn(),
  unexpectedDisconnects: [] as Array<() => void>,
  uploadRawGameSync: vi.fn(),
  uploadGamesBatch: vi.fn(),
  invalidateQueries: vi.fn(),
  useDeviceByDeviceId: vi.fn(),
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
    constructor(onUnexpectedDisconnect?: () => void) {
      if (onUnexpectedDisconnect) mocks.unexpectedDisconnects.push(onUnexpectedDisconnect);
    }
    connect = mocks.connect;
    getDeviceInfo = mocks.getDeviceInfo;
    listGames = mocks.listGames;
    downloadGame = mocks.downloadGame;
    deleteGames = mocks.deleteGames;
    disconnect = mocks.disconnect;
  },
}));

vi.mock("@/features/device-import/firmware-updater", () => ({
  resolveCableFirmwareRelease: () => ({
    downloadUrl: "/firmware.bin",
    sha256: "a".repeat(64),
    sizeBytes: 123,
    version: "V2.3.22",
    source: "bundled",
  }),
  flashMagicBoxFirmware: mocks.flashMagicBoxFirmware,
}));

vi.mock("@/features/devices/api", () => ({
  useDevices: () => ({ data: { data: [{ id: "device-record-1", deviceId: "AABBCCDDEEFF", name: "MagicBox Aula Norte", educationalCenterId: "institution-1", educationalCenterName: "Colegio Demo", assignmentScope: "institution", ownerUserId: "user-1", ownerUserName: "Ana Admin", ownerUserEmail: "ana@example.com", firmwareVersion: "V2.3.22", status: "online", deviceMetadata: {}, raw: {} }] } }),
  useDeviceByDeviceId: mocks.useDeviceByDeviceId,
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
    mocks.unexpectedDisconnects.length = 0;
    mocks.connect.mockResolvedValue(undefined);
    mocks.getDeviceInfo.mockResolvedValue({ deviceId: "AABBCCDDEEFF", firmwareVersion: "V2.3.22", hardware: "MagicBox V3" });
    mocks.listGames.mockResolvedValue([downloadedGame.summary]);
    mocks.downloadGame.mockResolvedValue(downloadedGame);
    mocks.uploadRawGameSync.mockResolvedValue({});
    mocks.uploadGamesBatch.mockResolvedValue([uploadedGame]);
    mocks.deleteGames.mockResolvedValue(undefined);
    mocks.disconnect.mockResolvedValue(undefined);
    mocks.flashMagicBoxFirmware.mockResolvedValue(undefined);
    mocks.invalidateQueries.mockResolvedValue(undefined);
    mocks.useDeviceByDeviceId.mockImplementation((_token: string | undefined, deviceId: string | undefined) => ({
      data: deviceId === "AABBCCDDEEFF" ? {
        id: "device-record-1",
        deviceId: "AABBCCDDEEFF",
        name: "MagicBox Aula Norte",
        educationalCenterId: "institution-1",
        educationalCenterName: "Colegio Demo",
        assignmentScope: "institution",
        ownerUserId: "user-1",
        ownerUserName: "Ana Admin",
        ownerUserEmail: "ana@example.com",
        firmwareVersion: "V2.3.22",
        status: "online",
        deviceMetadata: {},
        raw: {},
      } : undefined,
      isLoading: false,
      isError: false,
    }));
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

  it("loads the authoritative device record by the fresh USB ID even when it is outside the first list page", async () => {
    mocks.getDeviceInfo.mockResolvedValue({ deviceId: "CC88311D16F0", firmwareVersion: "V2.3.22", hardware: "V3" });
    mocks.useDeviceByDeviceId.mockImplementation((_token: string | undefined, deviceId: string | undefined) => ({
      data: deviceId === "CC88311D16F0" ? {
        id: "caracal-record",
        deviceId: "CC88311D16F0",
        name: "Caracal205",
        educationalCenterId: null,
        educationalCenterName: null,
        assignmentScope: "home",
        ownerUserId: "owner-205",
        ownerUserName: "Owner Caracal",
        ownerUserEmail: "owner@example.com",
        firmwareVersion: "V2.3.14",
        status: "offline",
        deviceMetadata: {},
        raw: {},
      } : undefined,
      isLoading: false,
      isError: false,
    }));

    render(<DeviceImportCenter />);
    fireEvent.click(screen.getByRole("button", { name: "Conectar" }));

    expect(await screen.findByText("Caracal205")).toBeInTheDocument();
    expect(screen.getByText("Owner Caracal")).toBeInTheDocument();
    expect(screen.getByText("Home")).toBeInTheDocument();
    expect(screen.getByLabelText("ID de la MagicBox")).toHaveValue("CC88311D16F0");
    expect(mocks.useDeviceByDeviceId).toHaveBeenLastCalledWith("token", "CC88311D16F0");
    expect(screen.queryByText("Sin owner registrado")).not.toBeInTheDocument();
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

  it("keeps session guards active after Strict Mode replays mount effects", async () => {
    render(<StrictMode><DeviceImportCenter /></StrictMode>);

    fireEvent.click(screen.getByRole("button", { name: "Conectar" }));

    await waitFor(() => expect(screen.getByLabelText("ID de la MagicBox")).toHaveValue("AABBCCDDEEFF"));
    expect(screen.getByText("MagicBox Aula Norte")).toBeInTheDocument();
  });

  it("clears device A state before updating and connecting device B", async () => {
    const deviceBGame = {
      ...downloadedGame,
      summary: { ...downloadedGame.summary, gameId: 8 },
    };
    mocks.getDeviceInfo
      .mockResolvedValueOnce({ deviceId: "AABBCCDDEEFF", firmwareVersion: "V2.3.22", hardware: "MagicBox V3" })
      .mockResolvedValueOnce({ deviceId: "112233445566", firmwareVersion: "V2.3.19", hardware: "MagicBox V2" });
    mocks.listGames
      .mockResolvedValueOnce([downloadedGame.summary])
      .mockResolvedValueOnce([deviceBGame.summary]);
    mocks.downloadGame
      .mockResolvedValueOnce(downloadedGame)
      .mockResolvedValueOnce(deviceBGame);

    render(<DeviceImportCenter />);

    fireEvent.click(screen.getByRole("button", { name: "Conectar" }));
    await screen.findByText("MagicBox Aula Norte");
    fireEvent.click(screen.getByRole("button", { name: "Leer partidas" }));
    expect((await screen.findAllByText("Partida #7")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Actualizar a V2.3.22" }));

    await waitFor(() => expect(mocks.flashMagicBoxFirmware).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("button", { name: "Conectar" })).toBeEnabled());
    expect(screen.queryAllByText("Partida #7")).toHaveLength(0);
    expect(screen.queryByText("MagicBox Aula Norte")).not.toBeInTheDocument();
    expect(screen.getByLabelText("ID de la MagicBox")).toHaveValue("");

    fireEvent.click(screen.getByRole("button", { name: "Conectar" }));
    await waitFor(() => expect(screen.getByLabelText("ID de la MagicBox")).toHaveValue("112233445566"));
    expect(mocks.getDeviceInfo).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText("MagicBox V2 · V2.3.19").length).toBeGreaterThan(0);
    expect(screen.queryByText("MagicBox V3 · V2.3.22")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Leer partidas" }));
    expect((await screen.findAllByText("Partida #8")).length).toBeGreaterThan(0);
    expect(screen.queryAllByText("Partida #7")).toHaveLength(0);

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Actualizar a V2.3.22" }));
    await waitFor(() => expect(mocks.flashMagicBoxFirmware).toHaveBeenCalledTimes(2));
    expect(mocks.disconnect).toHaveBeenCalledTimes(2);
  });

  it("recovers from a cable loss during update and ignores late progress from device A", async () => {
    mocks.getDeviceInfo
      .mockResolvedValueOnce({ deviceId: "AABBCCDDEEFF", firmwareVersion: "V2.3.22", hardware: "MagicBox V3" })
      .mockResolvedValueOnce({ deviceId: "112233445566", firmwareVersion: "V2.3.22", hardware: "MagicBox V3" });
    mocks.flashMagicBoxFirmware.mockImplementationOnce(async ({ onProgress }) => {
      onProgress?.(52, "Escribiendo A…");
      throw new Error("device has been lost");
    });

    render(<DeviceImportCenter />);
    fireEvent.click(screen.getByRole("button", { name: "Conectar" }));
    await screen.findByText("MagicBox Aula Norte");
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Actualizar a V2.3.22" }));

    expect(await screen.findByRole("dialog", { name: "No se pudo actualizar el firmware" })).toBeInTheDocument();
    expect(screen.getByText("device has been lost")).toBeInTheDocument();
    expect(screen.queryByText("MagicBox Aula Norte")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conectar" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Conectar" }));
    await waitFor(() => expect(screen.getByLabelText("ID de la MagicBox")).toHaveValue("112233445566"));
    const firstFlashOptions = mocks.flashMagicBoxFirmware.mock.calls[0][0];
    firstFlashOptions.onProgress?.(99, "Progreso tardío de A");

    expect(screen.queryByText("Progreso tardío de A")).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "No se pudo actualizar el firmware" })).not.toBeInTheDocument();
  });

  it("clears the active session on physical disconnect and ignores its late read", async () => {
    let resolveGames: ((value: (typeof downloadedGame.summary)[]) => void) | undefined;
    mocks.listGames.mockImplementationOnce(() => new Promise((resolve) => { resolveGames = resolve; }));

    render(<DeviceImportCenter />);
    fireEvent.click(screen.getByRole("button", { name: "Conectar" }));
    await screen.findByText("MagicBox Aula Norte");
    fireEvent.click(screen.getByRole("button", { name: "Leer partidas" }));
    expect(await screen.findByText("Leyendo")).toBeInTheDocument();

    mocks.unexpectedDisconnects[0]();
    await waitFor(() => expect(screen.getByRole("button", { name: "Conectar" })).toBeEnabled());
    expect(screen.getByText("Desconectada")).toBeInTheDocument();
    expect(screen.queryByText("MagicBox Aula Norte")).not.toBeInTheDocument();

    resolveGames?.([downloadedGame.summary]);
    await Promise.resolve();
    expect(screen.queryAllByText("Partida #7")).toHaveLength(0);
    expect(mocks.downloadGame).not.toHaveBeenCalled();
  });
});
