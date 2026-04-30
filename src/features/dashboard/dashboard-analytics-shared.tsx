"use client";

import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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

const dashboardCardClassName = "border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,251,254,0.96))] shadow-[0_16px_40px_rgba(31,42,55,0.06)]";

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
}) {
  const hasData = data.some((item) => (item.value || 0) > 0 || (item.secondaryValue || 0) > 0);
  const chartData = hasData
    ? data
    : [{ label: "Sin datos", value: 0, secondaryValue: secondaryDataKey ? 0 : undefined }];

  return (
    <Card className={dashboardCardClassName}>
      <CardHeader className="space-y-3 pb-3">
        <div className="inline-flex w-fit items-center rounded-full border border-primary/12 bg-primary/7 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/90">
          Lectura analítica
        </div>
        <CardTitle className="tracking-[-0.03em]">{title}</CardTitle>
        <CardDescription className="max-w-3xl text-[15px] leading-6">{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-72 w-full min-w-0" data-testid="dashboard-bar-chart-plot">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
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
}: {
  title: string;
  description: string;
  data: AnalyticsDatum[];
  emptyLabel?: string;
  onDatumSelect?: (label: string) => void;
  activeDatumLabel?: string | null;
}) {
  const hasData = data.some((item) => (item.value || 0) > 0 || (item.secondaryValue || 0) > 0);
  const hasSecondarySeries = data.some((item) => item.secondaryValue != null);
  const chartData = hasData ? data : [{ label: "Sin datos", value: 0 }];

  return (
    <Card className={dashboardCardClassName}>
      <CardHeader className="space-y-3 pb-3">
        <div className="inline-flex w-fit items-center rounded-full border border-primary/12 bg-primary/7 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/90">
          Tendencia
        </div>
        <CardTitle className="tracking-[-0.03em]">{title}</CardTitle>
        <CardDescription className="max-w-3xl text-[15px] leading-6">{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-72 w-full min-w-0" data-testid="dashboard-line-chart-plot">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
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

  return (
    <Card className={dashboardCardClassName}>
      <CardHeader className="space-y-3 pb-3">
        <div className="inline-flex w-fit items-center rounded-full border border-primary/12 bg-primary/7 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/90">
          Tendencia comparada
        </div>
        <CardTitle className="tracking-[-0.03em]">{title}</CardTitle>
        <CardDescription className="max-w-3xl text-[15px] leading-6">{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="h-72 w-full min-w-0" data-testid="dashboard-multi-line-chart-plot">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey={xAxisDataKey} tickLine={false} axisLine={false} fontSize={12} />
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
          items.map((item, index) => (
            <div key={`${item.label}-${item.value}-${item.badge || "sin-badge"}-${index}`} className={`rounded-2xl border bg-background/80 p-4 ${activeItemLabel === item.label ? "border-primary/30 ring-1 ring-primary/20" : "border-border/70"}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
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
          ))
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
          rows.map((row, index) => (
            <div key={`${row.label}-${row.value || "sin-valor"}-${index}`} className="rounded-2xl border border-border/70 bg-background/80 p-4">
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
          ))
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
