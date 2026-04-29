import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { StudentImportPanel } from "@/features/class-groups/student-import-panel";

const useClassGroupsMock = vi.fn();
const importClassGroupStudentsMock = vi.fn();
const createClassGroupMock = vi.fn();

vi.mock("@/features/class-groups/api", () => ({
  useClassGroups: (...args: unknown[]) => useClassGroupsMock(...args),
  importClassGroupStudents: (...args: unknown[]) => importClassGroupStudentsMock(...args),
  createClassGroup: (...args: unknown[]) => createClassGroupMock(...args),
}));

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <StudentImportPanel
        token="token"
        institutionId="ec-1"
        institutionName="Colegio Norte"
        user={{
          id: "user-1",
          email: "admin@example.com",
          firstName: "Ana",
          lastName: "Admin",
          fullName: "Ana Admin",
          educationalCenterId: "ec-1",
          roles: ["institution-admin"],
          permissions: ["class_group:update", "class_group:create"],
          raw: {},
        }}
      />
    </QueryClientProvider>,
  );
}

describe("StudentImportPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    useClassGroupsMock.mockReturnValue({
      data: {
        data: [
          {
            id: "cg-1",
            educationalCenterId: "ec-1",
            userId: null,
            name: "Quinto A",
            code: "quinto_a",
          },
        ],
      },
      isLoading: false,
    });

    importClassGroupStudentsMock.mockResolvedValue({
      classGroupId: "cg-1",
      educationalCenterId: "ec-1",
      groupName: "Quinto A",
      totalRows: 3,
      processedRows: 3,
      createdCount: 2,
      updatedCount: 1,
      skippedCount: 0,
      errorCount: 0,
      issues: [],
    });

    createClassGroupMock.mockResolvedValue({
      id: "cg-2",
      educationalCenterId: "ec-1",
      userId: null,
      name: "Quinto B",
      code: "quinto_b",
    });
  });

  it("imports an excel into the selected class group and shows the summary", async () => {
    renderPanel();

    fireEvent.change(screen.getByLabelText("Grupo destino"), {
      target: { value: "cg-1" },
    });

    const file = new File(["excel"], "students.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    fireEvent.change(screen.getByLabelText("Excel .xlsx"), {
      target: { files: [file] },
    });

    fireEvent.click(screen.getByRole("button", { name: "Subir Excel" }));

    await waitFor(() => {
      expect(importClassGroupStudentsMock).toHaveBeenCalledWith("token", "cg-1", file);
    });

    expect(await screen.findByText(/Importación terminada para Quinto A/)).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("creates a class group from the same panel", async () => {
    renderPanel();

    fireEvent.change(screen.getByLabelText("Nombre del grupo"), {
      target: { value: "Quinto B" },
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Crear grupo" })[0]);

    await waitFor(() => {
      expect(createClassGroupMock).toHaveBeenCalledWith("token", {
        educationalCenterId: "ec-1",
        name: "Quinto B",
        code: "quinto_b",
        userId: null,
      });
    });

    expect(await screen.findByText(/Grupo Quinto B creado y listo para usar/)).toBeInTheDocument();
  });
});
