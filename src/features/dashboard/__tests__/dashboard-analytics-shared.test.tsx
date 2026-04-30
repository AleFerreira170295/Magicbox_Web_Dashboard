import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
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
});
