"use client";

import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { useMemo, useState } from "react";
import { ArrowRight, Download } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ListPaginationControls, useListPagination } from "@/components/ui/list-pagination-controls";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type DashboardDetailRow = {
  label: string;
  value?: string;
  hint?: string;
  badge?: string;
};

export type AnalyticsDatum = {
  label: string;
  value: number;
  secondaryValue?: number;
};

export type AnalyticsSeriesDatum = {
  label: string;
  [key: string]: string | number | undefined;
};

export type DashboardTimeRange = "7d" | "30d" | "90d" | "all";

export const DASHBOARD_TIME_RANGE_OPTIONS: Array<{ value: DashboardTimeRange; label: string }> = [
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
  { value: "90d", label: "90 días" },
  { value: "all", label: "Todo" },
];

const dashboardCardClassName = "border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,251,254,0.96))] shadow-[0_16px_40px_rgba(31,42,55,0.06)]";

function getDashboardRangeCutoff(range: DashboardTimeRange) {
  if (range === "all") return null;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

export function filterDashboardItemsByRange<T>(items: T[], range: DashboardTimeRange, getDate: (item: T) => string | null | undefined) {
  const cutoff = getDashboardRangeCutoff(range);
  if (cutoff == null) return items;

  const itemsWithValidDate = items.filter((item) => {
    const value = getDate(item);
    if (!value) return false;
    return !Number.isNaN(new Date(value).getTime());
  });

  if (itemsWithValidDate.length === 0) return items;

  return items.filter((item) => {
    const value = getDate(item);
    if (!value) return false;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return false;
    return parsed.getTime() >= cutoff;
  });
}

export function useDashboardModuleControls(defaultRange: DashboardTimeRange = "30d") {
  const [ranges, setRanges] = useState<Record<string, DashboardTimeRange>>({});

  return {
    getRange: (moduleId: string) => ranges[moduleId] || defaultRange,
    setRange: (moduleId: string, range: DashboardTimeRange) => {
      setRanges((current) => ({ ...current, [moduleId]: range }));
    },
  };
}

function sanitizeCsvCell(value: unknown) {
  const stringValue = String(value ?? "").replace(/\r?\n|\r/g, " ").trim();
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function sanitizeFilename(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "dashboard";
}

function downloadCsvRows(filename: string, rows: Array<Record<string, unknown>>) {
  if (typeof window === "undefined" || rows.length === 0) return;

  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const csvContent = [
    headers.map((header) => sanitizeCsvCell(header)).join(","),
    ...rows.map((row) => headers.map((header) => sanitizeCsvCell(row[header])).join(",")),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

function DashboardChartToolbar({
  title,
  range,
  onRangeChange,
  rangeOptions = DASHBOARD_TIME_RANGE_OPTIONS,
  csvRows,
  csvFileName,
}: {
  title: string;
  range?: DashboardTimeRange;
  onRangeChange?: (range: DashboardTimeRange) => void;
  rangeOptions?: Array<{ value: DashboardTimeRange; label: string }>;
  csvRows: Array<Record<string, unknown>>;
  csvFileName?: string;
}) {
  const canDownload = csvRows.length > 0;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {onRangeChange ? (
        <label className="flex items-center gap-2 rounded-full border border-border/70 bg-white/85 px-3 py-1.5 text-xs font-medium text-foreground">
          Período
          <select
            value={range || "30d"}
            onChange={(event) => onRangeChange(event.target.value as DashboardTimeRange)}
            className="bg-transparent text-xs text-foreground outline-none"
            aria-label={`Período de ${title}`}
          >
            {rangeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button
        type="button"
        onClick={() => downloadCsvRows(csvFileName || `${sanitizeFilename(title)}.csv`, csvRows)}
        disabled={!canDownload}
        aria-label={`Descargar CSV de ${title}`}
        className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-white/85 px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/30 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Download className="size-3.5" />
        Descargar CSV
      </button>
    </div>
  );
}

export function DashboardMetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
  isLoading = false,
  onSelect,
  isActive = false,
  actionLabel = "Ver detalle",
}: {
  label: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "primary" | "accent" | "warning";
  isLoading?: boolean;
  onSelect?: () => void;
  isActive?: boolean;
  actionLabel?: string;
}) {
  const toneClass = {
    primary: "border border-primary/10 bg-primary/10 text-primary",
    accent: "border border-emerald-200/70 bg-emerald-50 text-emerald-700",
    warning: "border border-amber-200/80 bg-amber-100 text-amber-700",
  }[tone];

  return (
    <Card className={`${dashboardCardClassName} ${isActive ? "ring-2 ring-primary/20" : ""}`}>
      <CardContent className="p-5">
        <div className="flex h-full items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/45">{label}</p>
            {isLoading ? (
              <>
                <Skeleton className="mt-3 h-8 w-24 rounded-xl" />
                <Skeleton className="mt-3 h-4 w-40 rounded-xl" />
              </>
            ) : (
              <>
                <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground">{value}</p>
                <p className="mt-3 max-w-[28ch] text-sm leading-6 text-muted-foreground">{hint}</p>
              </>
            )}
          </div>
          <div className={`rounded-2xl p-3 shadow-sm ${toneClass}`}>
            <Icon className="size-5" />
          </div>
        </div>
        {onSelect ? (
          <button
            type="button"
            onClick={onSelect}
            aria-label={`${isActive ? "Detalle activo para" : actionLabel} ${label}`}
            className={`mt-4 inline-flex rounded-full border px-3 py-1.5 text-xs font-medium transition ${isActive ? "border-primary/30 bg-primary/10 text-primary" : "border-border/70 bg-white/80 text-foreground hover:border-primary/30 hover:bg-primary/5"}`}
          >
            {isActive ? "Detalle activo" : actionLabel}
          </button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function DashboardBarChartCard({
  title,
  description,
  data,
  dataKey = "value",
  secondaryDataKey,
  secondaryLabel,
  emptyLabel,
  onDatumSelect,
  activeDatumLabel,
  range,
  onRangeChange,
  rangeOptions,
  csvFileName,
}: {
  title: string;
  description: string;
  data: AnalyticsDatum[];
  dataKey?: "value" | "secondaryValue";
  secondaryDataKey?: "value" | "secondaryValue";
  secondaryLabel?: string;
  emptyLabel?: string;
  onDatumSelect?: (label: string) => void;
  activeDatumLabel?: string | null;
  range?: DashboardTimeRange;
  onRangeChange?: (range: DashboardTimeRange) => void;
  rangeOptions?: Array<{ value: DashboardTimeRange; label: string }>;
  csvFileName?: string;
}) {
  const hasData = data.some((item) => (item.value || 0) > 0 || (item.secondaryValue || 0) > 0);
  const chartData = hasData
    ? data
    : [{ label: "Sin datos", value: 0, secondaryValue: secondaryDataKey ? 0 : undefined }];
  const csvRows = useMemo(
    () => data.map((item) => ({
      etiqueta: item.label,
      [dataKey === "secondaryValue" ? "valor_secundario" : "valor_principal"]: item[dataKey],
      ...(secondaryDataKey ? { [secondaryLabel || "comparativo"]: item[secondaryDataKey] } : {}),
    })),
    [data, dataKey, secondaryDataKey, secondaryLabel],
  );

  return (
    <Card className={dashboardCardClassName}>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex w-fit items-center rounded-full border border-primary/12 bg-primary/7 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/90">
              Lectura analítica
            </div>
            <div>
              <CardTitle className="tracking-[-0.03em]">{title}</CardTitle>
              <CardDescription className="mt-2 max-w-3xl text-[15px] leading-6">{description}</CardDescription>
            </div>
          </div>
          <DashboardChartToolbar title={title} range={range} onRangeChange={onRangeChange} rangeOptions={rangeOptions} csvRows={csvRows} csvFileName={csvFileName} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-72 w-full min-w-0" data-testid="dashboard-bar-chart-plot">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey={dataKey} name="Valor principal" fill="#4280a4" radius={[8, 8, 0, 0]} />
              {secondaryDataKey ? <Bar dataKey={secondaryDataKey} name={secondaryLabel || "Comparativo"} fill="#89b5d3" radius={[8, 8, 0, 0]} /> : null}
            </BarChart>
          </ResponsiveContainer>
        </div>
        {!hasData ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
            {emptyLabel || "El recorte actual todavía no reúne datos suficientes para mostrar esta visualización."}
          </div>
        ) : null}
        {onDatumSelect && hasData ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {data.map((item, index) => (
              <button
                key={`${title}-${item.label}-${index}`}
                type="button"
                onClick={() => onDatumSelect(item.label)}
                aria-label={`Filtrar ${title} por ${item.label}`}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${activeDatumLabel === item.label ? "border-primary/30 bg-primary/10 text-primary" : "border-border/70 bg-white/80 text-foreground hover:border-primary/30 hover:bg-primary/5"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function DashboardLineChartCard({
  title,
  description,
  data,
  emptyLabel,
  onDatumSelect,
  activeDatumLabel,
  range,
  onRangeChange,
  rangeOptions,
  csvFileName,
}: {
  title: string;
  description: string;
  data: AnalyticsDatum[];
  emptyLabel?: string;
  onDatumSelect?: (label: string) => void;
  activeDatumLabel?: string | null;
  range?: DashboardTimeRange;
  onRangeChange?: (range: DashboardTimeRange) => void;
  rangeOptions?: Array<{ value: DashboardTimeRange; label: string }>;
  csvFileName?: string;
}) {
  const hasData = data.some((item) => (item.value || 0) > 0 || (item.secondaryValue || 0) > 0);
  const hasSecondarySeries = data.some((item) => item.secondaryValue != null);
  const chartData = hasData ? data : [{ label: "Sin datos", value: 0 }];
  const csvRows = useMemo(
    () => data.map((item) => ({
      etiqueta: item.label,
      valor_principal: item.value,
      ...(hasSecondarySeries ? { comparativo: item.secondaryValue } : {}),
    })),
    [data, hasSecondarySeries],
  );

  return (
    <Card className={dashboardCardClassName}>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex w-fit items-center rounded-full border border-primary/12 bg-primary/7 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/90">
              Tendencia
            </div>
            <div>
              <CardTitle className="tracking-[-0.03em]">{title}</CardTitle>
              <CardDescription className="mt-2 max-w-3xl text-[15px] leading-6">{description}</CardDescription>
            </div>
          </div>
          <DashboardChartToolbar title={title} range={range} onRangeChange={onRangeChange} rangeOptions={rangeOptions} csvRows={csvRows} csvFileName={csvFileName} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-72 w-full min-w-0" data-testid="dashboard-line-chart-plot">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="value" name="Valor principal" stroke="#4280a4" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              {hasSecondarySeries ? <Line type="monotone" dataKey="secondaryValue" name="Comparativo" stroke="#89b5d3" strokeWidth={2} dot={{ r: 2 }} /> : null}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {!hasData ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
            {emptyLabel || "El recorte actual todavía no reúne datos suficientes para mostrar esta tendencia."}
          </div>
        ) : null}
        {onDatumSelect && hasData ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {data.map((item, index) => (
              <button
                key={`${title}-${item.label}-${index}`}
                type="button"
                onClick={() => onDatumSelect(item.label)}
                aria-label={`Filtrar ${title} por ${item.label}`}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${activeDatumLabel === item.label ? "border-primary/30 bg-primary/10 text-primary" : "border-border/70 bg-white/80 text-foreground hover:border-primary/30 hover:bg-primary/5"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function DashboardMultiLineChartCard({
  title,
  description,
  data,
  series,
  xAxisDataKey = "label",
  emptyLabel,
  footer,
  onDatumSelect,
  activeDatumLabel,
  range,
  onRangeChange,
  rangeOptions,
  csvFileName,
}: {
  title: string;
  description: string;
  data: AnalyticsSeriesDatum[];
  series: Array<{ key: string; label: string; color: string }>;
  xAxisDataKey?: string;
  emptyLabel?: string;
  footer?: ReactNode;
  onDatumSelect?: (label: string) => void;
  activeDatumLabel?: string | null;
  range?: DashboardTimeRange;
  onRangeChange?: (range: DashboardTimeRange) => void;
  rangeOptions?: Array<{ value: DashboardTimeRange; label: string }>;
  csvFileName?: string;
}) {
  const hasData = data.some((item) => series.some((entry) => Number(item[entry.key] || 0) > 0));
  const chartData = hasData
    ? data
    : [
        series.reduce<AnalyticsSeriesDatum>(
          (accumulator, entry) => ({ ...accumulator, [entry.key]: 0 }),
          { [xAxisDataKey]: "Sin datos", label: "Sin datos" },
        ),
      ];
  const csvRows = useMemo(
    () => data.map((item, index) => ({
      [xAxisDataKey]: item[xAxisDataKey] ?? item.label ?? `Punto ${index + 1}`,
      ...series.reduce<Record<string, unknown>>((accumulator, entry) => ({ ...accumulator, [entry.label]: item[entry.key] }), {}),
    })),
    [data, series, xAxisDataKey],
  );

  return (
    <Card className={dashboardCardClassName}>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex w-fit items-center rounded-full border border-primary/12 bg-primary/7 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/90">
              Tendencia comparada
            </div>
            <div>
              <CardTitle className="tracking-[-0.03em]">{title}</CardTitle>
              <CardDescription className="mt-2 max-w-3xl text-[15px] leading-6">{description}</CardDescription>
            </div>
          </div>
          <DashboardChartToolbar title={title} range={range} onRangeChange={onRangeChange} rangeOptions={rangeOptions} csvRows={csvRows} csvFileName={csvFileName} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-72 w-full min-w-0" data-testid="dashboard-multi-line-chart-plot">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey={xAxisDataKey} tickLine={false} axisLine={false} fontSize={12} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
              <Tooltip />
              {series.map((entry) => (
                <Line key={entry.key} type="monotone" dataKey={entry.key} name={entry.label} stroke={entry.color} strokeWidth={entry.key === series[0]?.key ? 3 : 2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {!hasData ? (
          <div className="mt-4 rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
            {emptyLabel || "El recorte actual todavía no reúne datos suficientes para comparar tendencias."}
          </div>
        ) : null}
        {onDatumSelect && hasData ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {data.map((item, index) => {
              const label = String(item[xAxisDataKey] ?? item.label ?? `Punto ${index + 1}`);
              return (
                <button
                  key={`${title}-${label}-${index}`}
                  type="button"
                  onClick={() => onDatumSelect(label)}
                  aria-label={`Filtrar ${title} por ${label}`}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${activeDatumLabel === label ? "border-primary/30 bg-primary/10 text-primary" : "border-border/70 bg-white/80 text-foreground hover:border-primary/30 hover:bg-primary/5"}`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : null}
        {footer ? <div className="mt-4">{footer}</div> : null}
      </CardContent>
    </Card>
  );
}

export function DashboardTopListCard({
  title,
  description,
  items,
  valueLabel,
  emptyLabel,
  onItemSelect,
  activeItemLabel,
}: {
  title: string;
  description: string;
  items: Array<{ label: string; value: string; badge?: string }>;
  valueLabel?: string;
  emptyLabel?: string;
  onItemSelect?: (label: string) => void;
  activeItemLabel?: string | null;
}) {
  const pagination = useListPagination(items);
  const visibleItems = items.length > 0 ? pagination.paginatedItems : [];

  return (
    <Card className={dashboardCardClassName}>
      <CardHeader className="space-y-3 pb-3">
        <div className="inline-flex w-fit items-center rounded-full border border-primary/12 bg-primary/7 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/90">
          Ranking / foco
        </div>
        <CardTitle className="tracking-[-0.03em]">{title}</CardTitle>
        <CardDescription className="max-w-3xl text-[15px] leading-6">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {items.length > 0 ? (
          <>
            <div className="max-h-[30rem] space-y-3 overflow-y-auto pr-1">
              {visibleItems.map((item, index) => {
                const absoluteIndex = (pagination.currentPage - 1) * pagination.pageSize + index;
                return (
                  <div key={`${item.label}-${item.value}-${item.badge || "sin-badge"}-${absoluteIndex}`} className={`rounded-2xl border bg-background/80 p-4 ${activeItemLabel === item.label ? "border-primary/30 ring-1 ring-primary/20" : "border-border/70"}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {absoluteIndex + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{item.label}</p>
                          {item.badge ? <p className="mt-1 text-sm text-muted-foreground">{item.badge}</p> : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {onItemSelect ? (
                          <button
                            type="button"
                            onClick={() => onItemSelect(item.label)}
                            aria-label={`Ver detalle de ${item.label}`}
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition ${activeItemLabel === item.label ? "border-primary/30 bg-primary/10 text-primary" : "border-border/70 bg-white/80 text-foreground hover:border-primary/30 hover:bg-primary/5"}`}
                          >
                            {activeItemLabel === item.label ? "Detalle activo" : "Ver detalle"}
                          </button>
                        ) : null}
                        <Badge variant="secondary">{item.value}{valueLabel ? ` ${valueLabel}` : ""}</Badge>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {items.length > pagination.pageSize ? (
              <ListPaginationControls
                pageSize={pagination.pageSize}
                setPageSize={pagination.setPageSize}
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalItems}
                paginationStart={pagination.paginationStart}
                paginationEnd={pagination.paginationEnd}
                goToPreviousPage={pagination.goToPreviousPage}
                goToNextPage={pagination.goToNextPage}
              />
            ) : null}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
            {emptyLabel || "Todavía no hay elementos suficientes para ordenar este ranking."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardDetailPanel({
  title,
  description,
  rows,
  activeFilterLabel,
  emptyLabel,
  onClear,
}: {
  title: string;
  description: string;
  rows: DashboardDetailRow[];
  activeFilterLabel?: string | null;
  emptyLabel?: string;
  onClear?: () => void;
}) {
  const pagination = useListPagination(rows);
  const visibleRows = rows.length > 0 ? pagination.paginatedItems : [];

  return (
    <Card className={dashboardCardClassName}>
      <CardHeader className="space-y-3 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="tracking-[-0.03em]">{title}</CardTitle>
            <CardDescription className="mt-2 max-w-3xl text-[15px] leading-6">{description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {activeFilterLabel ? <Badge variant="outline">Filtro: {activeFilterLabel}</Badge> : null}
            {onClear ? (
              <button type="button" onClick={onClear} aria-label={activeFilterLabel ? `Limpiar filtro ${activeFilterLabel}` : "Limpiar detalle"} className="rounded-full border border-border/70 bg-white/80 px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-primary/30 hover:bg-primary/5">
                Limpiar
              </button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {rows.length > 0 ? (
          <>
            <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
              {visibleRows.map((row, index) => {
                const absoluteIndex = (pagination.currentPage - 1) * pagination.pageSize + index;
                return (
                  <div key={`${row.label}-${row.value || "sin-valor"}-${absoluteIndex}`} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{row.label}</p>
                        {row.hint ? <p className="mt-1 text-sm text-muted-foreground">{row.hint}</p> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {row.badge ? <Badge variant="outline">{row.badge}</Badge> : null}
                        {row.value ? <Badge variant="secondary">{row.value}</Badge> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {rows.length > pagination.pageSize ? (
              <ListPaginationControls
                pageSize={pagination.pageSize}
                setPageSize={pagination.setPageSize}
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalItems}
                paginationStart={pagination.paginationStart}
                paginationEnd={pagination.paginationEnd}
                goToPreviousPage={pagination.goToPreviousPage}
                goToNextPage={pagination.goToNextPage}
              />
            ) : null}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
            {emptyLabel || "No encontré filas detalladas para este filtro todavía."}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardModuleLinksCard({
  title,
  description,
  items,
}: {
  title: string;
  description: string;
  items: Array<{ href: string; label: string; hint: string }>;
}) {
  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-2xl border border-border/70 bg-white/85 p-4 transition hover:border-primary/30 hover:bg-primary/5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">{item.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.hint}</p>
              </div>
              <ArrowRight className="size-4 text-primary" />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
