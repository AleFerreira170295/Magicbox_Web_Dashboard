import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardBarChartCard, DashboardDetailPanel, DashboardLineChartCard, DashboardMetricCard, DashboardMultiLineChartCard, DashboardTopListCard } from "@/features/dashboard/dashboard-analytics-shared";

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Bar: () => null,
  Line: () => null,
}));

const createObjectURLMock = vi.fn(() => "blob:dashboard-csv");
const revokeObjectURLMock = vi.fn();

beforeEach(() => {
  Object.defineProperty(window.URL, "createObjectURL", { value: createObjectURLMock, configurable: true, writable: true });
  Object.defineProperty(window.URL, "revokeObjectURL", { value: revokeObjectURLMock, configurable: true, writable: true });
});

afterEach(() => {
  createObjectURLMock.mockClear();
  revokeObjectURLMock.mockClear();
});

describe("dashboard analytics shared charts", () => {
  it("keeps bar charts visible even when there is no data", () => {
    render(
      <DashboardBarChartCard
        title="Mazos más usados"
        description="Distribución"
        data={[]}
      />,
    );

    expect(screen.getByText("Mazos más usados")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-bar-chart-plot")).toBeInTheDocument();
    expect(screen.getByText(/El recorte actual todavía no reúne datos suficientes para mostrar esta visualización/i)).toBeInTheDocument();
  });

  it("keeps line charts visible even when there is no data", () => {
    render(
      <DashboardLineChartCard
        title="Actividad reciente"
        description="Tendencia"
        data={[]}
      />,
    );

    expect(screen.getByText("Actividad reciente")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-line-chart-plot")).toBeInTheDocument();
    expect(screen.getByText(/El recorte actual todavía no reúne datos suficientes para mostrar esta tendencia/i)).toBeInTheDocument();
  });

  it("keeps multi-line charts visible even when there is no data", () => {
    render(
      <DashboardMultiLineChartCard
        title="Mini tendencias"
        description="Comparativa"
        data={[]}
        series={[
          { key: "syncs", label: "Syncs", color: "#2563eb" },
          { key: "games", label: "Partidas", color: "#7c3aed" },
        ]}
      />,
    );

    expect(screen.getByText("Mini tendencias")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-multi-line-chart-plot")).toBeInTheDocument();
    expect(screen.getByText(/El recorte actual todavía no reúne datos suficientes para comparar tendencias/i)).toBeInTheDocument();
  });

  it("allows selecting a bucket in multi-line charts", () => {
    const onDatumSelect = vi.fn();

    render(
      <DashboardMultiLineChartCard
        title="Mini tendencias"
        description="Comparativa"
        data={[{ date: "2026-04-20", label: "2026-04-20", syncs: 1, games: 2 }]}
        xAxisDataKey="date"
        series={[
          { key: "syncs", label: "Syncs", color: "#2563eb" },
          { key: "games", label: "Partidas", color: "#7c3aed" },
        ]}
        onDatumSelect={onDatumSelect}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Filtrar Mini tendencias por 2026-04-20/i }));
    expect(onDatumSelect).toHaveBeenCalledWith("2026-04-20");
  });

  it("exposes interactive affordances for cards, charts and top lists", () => {
    const metricSelect = vi.fn();
    const datumSelect = vi.fn();
    const itemSelect = vi.fn();

    render(
      <div>
        <DashboardMetricCard
          label="Usuarios visibles"
          value="12"
          hint="Padrón visible"
          icon={() => null}
          onSelect={metricSelect}
        />
        <DashboardBarChartCard
          title="Usuarios visibles por rol"
          description="Distribución"
          data={[{ label: "teacher", value: 4 }]}
          onDatumSelect={datumSelect}
        />
        <DashboardTopListCard
          title="Prioridades"
          description="Foco"
          items={[{ label: "Dispositivos sin status", value: "2" }]}
          onItemSelect={itemSelect}
        />
      </div>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Ver detalle Usuarios visibles/i }));
    fireEvent.click(screen.getByRole("button", { name: /Filtrar Usuarios visibles por rol por teacher/i }));
    fireEvent.click(screen.getByRole("button", { name: /Ver detalle de Dispositivos sin status/i }));

    expect(metricSelect).toHaveBeenCalledTimes(1);
    expect(datumSelect).toHaveBeenCalledWith("teacher");
    expect(itemSelect).toHaveBeenCalledWith("Dispositivos sin status");
  });

  it("allows changing the chart period and exporting CSV", () => {
    const onRangeChange = vi.fn();
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    render(
      <DashboardBarChartCard
        title="Usuarios por rol"
        description="Distribución"
        data={[{ label: "teacher", value: 4 }]}
        range="30d"
        onRangeChange={onRangeChange}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Período de Usuarios por rol/i), { target: { value: "7d" } });
    fireEvent.click(screen.getByRole("button", { name: /Descargar CSV de Usuarios por rol/i }));

    expect(onRangeChange).toHaveBeenCalledWith("7d");
    expect(createObjectURLMock).toHaveBeenCalledTimes(1);

    clickSpy.mockRestore();
  });

  it("renders the detail panel and allows clearing the active filter", () => {
    const onClear = vi.fn();

    render(
      <DashboardDetailPanel
        title="Detalle"
        description="Más contexto"
        activeFilterLabel="teacher"
        rows={[{ label: "Paula Control", value: "teacher", hint: "Activo" }]}
        onClear={onClear}
      />,
    );

    expect(screen.getByText("Detalle")).toBeInTheDocument();
    expect(screen.getByText("Paula Control")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Limpiar filtro teacher/i }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("paginates long top lists and detail panels", () => {
    render(
      <div>
        <DashboardTopListCard
          title="Prioridades"
          description="Foco"
          items={Array.from({ length: 12 }, (_, index) => ({ label: `Item ${index + 1}`, value: String(index + 1) }))}
        />
        <DashboardDetailPanel
          title="Detalle"
          description="Más contexto"
          rows={Array.from({ length: 12 }, (_, index) => ({ label: `Fila ${index + 1}`, value: String(index + 1) }))}
        />
      </div>,
    );

    expect(screen.getAllByText(/Mostrando 1-10 de 12/i)).toHaveLength(2);

    const nextButtons = screen.getAllByRole("button", { name: /Siguiente/i });
    fireEvent.click(nextButtons[0]);
    fireEvent.click(nextButtons[1]);

    expect(screen.getAllByText(/Mostrando 11-12 de 12/i)).toHaveLength(2);
    expect(screen.getByText("Item 12")).toBeInTheDocument();
    expect(screen.getByText("Fila 12")).toBeInTheDocument();
  });
});
