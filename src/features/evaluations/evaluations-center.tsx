"use client";

import { useMemo, useState } from "react";
import { BarChart3, ClipboardCheck, FileBarChart, GraduationCap, Search, TrendingUp, Upload, Users } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-context";
import { useInstitutions } from "@/features/institutions/api";
import { useClassGroups, useCreateEvaluation, useEvaluation, useEvaluationDetails, useEvaluations, useStudents } from "@/features/evaluations/api";
import type { CreateEvaluationPayload, EvaluationRecord, EvaluationType, ScaleType } from "@/features/evaluations/types";
import { cn, formatDateTime, getErrorMessage } from "@/lib/utils";

const evaluationTypes: Array<{ value: EvaluationType; label: string }> = [
  { value: "diagnostic", label: "Diagnóstico" },
  { value: "formative", label: "Formativa" },
  { value: "summative", label: "Sumativa" },
  { value: "observation", label: "Observación" },
  { value: "other", label: "Otra" },
];

const scaleTypes: Array<{ value: ScaleType; label: string }> = [
  { value: "score", label: "Puntaje" },
  { value: "percentage", label: "Porcentaje" },
  { value: "level", label: "Nivel" },
  { value: "pass_fail", label: "Aprobado" },
];

const chartColors = ["#2563eb", "#0f766e", "#7c3aed", "#c2410c", "#be123c", "#4d7c0f"];

type ResultDraft = { score: string; level: string; observations: string; passFail: "none" | "pass" | "fail" };
type ImportRow = Record<string, unknown>;
type TrendDatum = { date: string; [key: string]: string | number | null };

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function displayType(type: EvaluationType | string) {
  return evaluationTypes.find((item) => item.value === type)?.label || type;
}

function displayScale(type: ScaleType | string) {
  return scaleTypes.find((item) => item.value === type)?.label || type;
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizeColumn(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function readImportValue(row: ImportRow, keys: string[]) {
  const normalizedKeys = keys.map(normalizeColumn);
  for (const [key, value] of Object.entries(row)) {
    if (normalizedKeys.includes(normalizeColumn(key)) && String(value ?? "").trim()) return String(value).trim();
  }
  return "";
}

function readImportNumber(row: ImportRow, keys: string[]) {
  const value = readImportValue(row, keys);
  if (!value) return "";
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? String(parsed) : "";
}

function readImportBoolean(row: ImportRow, keys: string[]): ResultDraft["passFail"] {
  const value = normalizeText(readImportValue(row, keys));
  if (!value) return "none";
  if (["si", "sí", "s", "true", "1", "aprobado", "aprueba", "pass", "passed"].includes(value)) return "pass";
  if (["no", "n", "false", "0", "reprobado", "no_aprobo", "no_aprobado", "fail", "failed"].includes(value)) return "fail";
  return "none";
}

function parseCsvRows(text: string): ImportRow[] {
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  row.push(current.trim());
  if (row.some(Boolean)) rows.push(row);
  const [headers = [], ...body] = rows;
  return body.map((values) =>
    headers.reduce<ImportRow>((accumulator, header, index) => {
      accumulator[header || `columna_${index + 1}`] = values[index] ?? "";
      return accumulator;
    }, {}),
  );
}

async function readImportRows(file: File): Promise<ImportRow[]> {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".csv")) return parseCsvRows(await file.text());
  if (!lowerName.endsWith(".xlsx")) throw new Error("El archivo debe ser .xlsx o .csv.");
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<ImportRow>(sheet, { defval: "" });
}

function resultPercentage(result: EvaluationRecord["results"][number]) {
  if (typeof result.percentage === "number" && Number.isFinite(result.percentage)) return result.percentage;
  if (typeof result.score === "number" && typeof result.maxScore === "number" && result.maxScore > 0) return (result.score / result.maxScore) * 100;
  return null;
}

function SummaryCard({ label, value, hint, icon: Icon }: { label: string; value: string; hint: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-foreground">{value}</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</p>
          </div>
          <div className="rounded-2xl bg-primary/12 p-3 text-primary"><Icon className="size-5" /></div>
        </div>
      </CardContent>
    </Card>
  );
}

function TrendChart({ data, series, emptyLabel }: { data: TrendDatum[]; series: Array<{ key: string; label: string; color: string }>; emptyLabel: string }) {
  const hasData = data.some((item) => series.some((entry) => typeof item[entry.key] === "number"));
  return (
    <div>
      <div className="h-72 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={hasData ? data : [{ date: "-", empty: 0 }]} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={12} minTickGap={22} />
            <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} domain={[0, 100]} />
            <Tooltip />
            {series.map((entry) => (
              <Line key={entry.key} type="monotone" dataKey={entry.key} name={entry.label} stroke={entry.color} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {!hasData ? <div className="mt-4 rounded-2xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">{emptyLabel}</div> : null}
    </div>
  );
}

export function EvaluationsCenter() {
  const { tokens, user } = useAuth();
  const [institutionId, setInstitutionId] = useState(user?.educationalCenterId || "");
  const [classGroupId, setClassGroupId] = useState("");
  const [query, setQuery] = useState("");
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Matemática");
  const [evaluationType, setEvaluationType] = useState<EvaluationType>("diagnostic");
  const [evaluationDate, setEvaluationDate] = useState(todayIsoDate());
  const [scaleType, setScaleType] = useState<ScaleType>("score");
  const [maxScore, setMaxScore] = useState("100");
  const [notes, setNotes] = useState("");
  const [resultDrafts, setResultDrafts] = useState<Record<string, ResultDraft>>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const institutionFilter = institutionId || user?.educationalCenterId || "";
  const institutionsQuery = useInstitutions(tokens?.accessToken);
  const classGroupsQuery = useClassGroups(tokens?.accessToken, institutionFilter || undefined);
  const studentsQuery = useStudents(tokens?.accessToken, classGroupId || undefined);
  const evaluationsQuery = useEvaluations(tokens?.accessToken, { educationalCenterId: institutionId || undefined, classGroupId: classGroupId || undefined });
  const selectedEvaluationQuery = useEvaluation(tokens?.accessToken, selectedEvaluationId);
  const createEvaluationMutation = useCreateEvaluation(tokens?.accessToken);

  const institutions = useMemo(() => institutionsQuery.data?.data || [], [institutionsQuery.data?.data]);
  const rawClassGroups = useMemo(() => classGroupsQuery.data?.data || [], [classGroupsQuery.data?.data]);
  const classGroups = useMemo(
    () => rawClassGroups.filter((classGroup) => !institutionFilter || classGroup.educationalCenterId === institutionFilter),
    [institutionFilter, rawClassGroups],
  );
  const students = useMemo(() => studentsQuery.data?.data || [], [studentsQuery.data?.data]);
  const evaluations = useMemo(() => evaluationsQuery.data?.data || [], [evaluationsQuery.data?.data]);
  const selectedEvaluation = selectedEvaluationQuery.data || evaluations.find((item) => item.id === selectedEvaluationId) || null;
  const canCreate = Boolean(user?.roles.some((role) => ["teacher", "director", "admin", "institution-admin"].includes(role)));

  const evaluationDetailIds = useMemo(() => (classGroupId ? evaluations.map((evaluation) => evaluation.id).slice(0, 60) : []), [classGroupId, evaluations]);
  const evaluationDetailQueries = useEvaluationDetails(tokens?.accessToken, evaluationDetailIds);
  const detailedEvaluations = useMemo(
    () => evaluationDetailQueries.map((entry) => entry.data).filter((entry): entry is EvaluationRecord => Boolean(entry)),
    [evaluationDetailQueries],
  );
  const isLoadingEvaluationDetails = evaluationDetailQueries.some((entry) => entry.isLoading);

  const institutionById = useMemo(() => new Map(institutions.map((institution) => [institution.id, institution])), [institutions]);
  const classGroupById = useMemo(() => new Map(rawClassGroups.map((classGroup) => [classGroup.id, classGroup])), [rawClassGroups]);
  const studentById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);
  const selectedClassGroup = classGroupById.get(classGroupId) || null;
  const effectiveStudentId = selectedStudentId || students[0]?.id || "";

  const filteredEvaluations = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return evaluations;
    return evaluations.filter((evaluation) =>
      [evaluation.title, evaluation.subject, displayType(evaluation.evaluationType), classGroupById.get(evaluation.classGroupId)?.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized)),
    );
  }, [classGroupById, evaluations, query]);

  const metrics = useMemo(() => {
    const resultsCount = evaluations.reduce((acc, evaluation) => acc + evaluation.resultsCount, 0);
    const averageValues = evaluations.map((evaluation) => evaluation.averagePercentage).filter((value): value is number => typeof value === "number" && !Number.isNaN(value));
    return {
      evaluations: evaluations.length,
      resultsCount,
      classGroups: new Set(evaluations.map((evaluation) => evaluation.classGroupId)).size,
      average: averageValues.length ? Math.round(averageValues.reduce((acc, value) => acc + value, 0) / averageValues.length) : null,
    };
  }, [evaluations]);

  const groupTrend = useMemo(() => {
    const groupIds = Array.from(new Set(evaluations.map((evaluation) => evaluation.classGroupId).filter(Boolean))).slice(0, chartColors.length);
    const series = groupIds.map((groupId, index) => ({
      key: `group_${index}`,
      label: classGroupById.get(groupId)?.name || `Grupo ${index + 1}`,
      color: chartColors[index],
      groupId,
    }));
    const rows = Array.from(new Set(evaluations.map((evaluation) => evaluation.evaluationDate).filter(Boolean)))
      .sort()
      .map<TrendDatum>((date) => {
        const row: TrendDatum = { date };
        for (const item of series) {
          const values = evaluations
            .filter((evaluation) => evaluation.evaluationDate === date && evaluation.classGroupId === item.groupId)
            .map((evaluation) => evaluation.averagePercentage)
            .filter((value): value is number => typeof value === "number" && !Number.isNaN(value));
          row[item.key] = values.length ? Math.round(values.reduce((acc, value) => acc + value, 0) / values.length) : null;
        }
        return row;
      });
    return { rows, series };
  }, [classGroupById, evaluations]);

  const studentTrend = useMemo(() => {
    if (!effectiveStudentId) return [] as TrendDatum[];
    return detailedEvaluations
      .map<TrendDatum | null>((evaluation) => {
        const result = evaluation.results.find((item) => item.studentId === effectiveStudentId);
        const percentage = result ? resultPercentage(result) : null;
        return percentage == null ? null : { date: evaluation.evaluationDate, resultado: Math.round(percentage) };
      })
      .filter((entry): entry is TrendDatum => Boolean(entry))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [detailedEvaluations, effectiveStudentId]);

  function updateDraft(studentId: string, patch: Partial<ResultDraft>) {
    setResultDrafts((current) => ({
      ...current,
      [studentId]: { ...(current[studentId] || { score: "", level: "", observations: "", passFail: "none" }), ...patch },
    }));
  }

  async function importResultsFile(file: File | null) {
    setFormMessage(null);
    if (!file) return;
    if (!classGroupId) {
      setFormMessage("Seleccioná un grupo antes de importar resultados.");
      return;
    }
    try {
      const rows = await readImportRows(file);
      const byId = new Map(students.map((student) => [normalizeText(student.id), student]));
      const byFile = new Map(students.map((student) => [normalizeText(student.fileNumber), student]));
      const byName = new Map(students.map((student) => [normalizeText(student.fullName), student]));
      const imported: Record<string, ResultDraft> = {};
      let matched = 0;
      let skipped = 0;
      let importedMaxScore = "";

      for (const row of rows) {
        const identifier = readImportValue(row, ["student_id", "id_estudiante", "id", "file_number", "legajo", "matricula"]);
        const fullName = readImportValue(row, ["estudiante", "student", "nombre_completo", "full_name", "nombre"]);
        const student = byId.get(normalizeText(identifier)) || byFile.get(normalizeText(identifier)) || byName.get(normalizeText(fullName));
        if (!student) {
          skipped += 1;
          continue;
        }
        const score = readImportNumber(row, ["score", "puntaje", "nota", "resultado", "porcentaje", "percentage"]);
        const rowMaxScore = readImportNumber(row, ["max_score", "maximo", "máximo", "puntaje_maximo"]);
        if (!importedMaxScore && rowMaxScore) importedMaxScore = rowMaxScore;
        imported[student.id] = {
          score,
          level: readImportValue(row, ["level", "nivel"]),
          observations: readImportValue(row, ["observations", "observaciones", "comentario", "comentarios"]),
          passFail: readImportBoolean(row, ["pass_fail", "aprobado", "estado"]),
        };
        matched += 1;
      }

      if (importedMaxScore) setMaxScore(importedMaxScore);
      setResultDrafts((current) => ({ ...current, ...imported }));
      setFormMessage(`Importación lista: ${matched} estudiantes asociados${skipped ? `, ${skipped} filas sin match` : ""}.`);
    } catch (error) {
      setFormMessage(getErrorMessage(error));
    }
  }

  async function submitEvaluation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage(null);
    const evaluationInstitutionId = institutionId || selectedClassGroup?.educationalCenterId || user?.educationalCenterId || "";
    if (!evaluationInstitutionId || !classGroupId || !title.trim()) {
      setFormMessage("Completá institución, grupo y título antes de guardar.");
      return;
    }
    const parsedMaxScore = maxScore.trim() ? Number(maxScore) : null;
    const results = students
      .map((student) => {
        const draft = resultDrafts[student.id];
        if (!draft) return null;
        const score = draft.score.trim() ? Number(draft.score) : null;
        const hasResult = score !== null || draft.level.trim() || draft.observations.trim() || draft.passFail !== "none";
        if (!hasResult) return null;
        return {
          studentId: student.id,
          score,
          maxScore: parsedMaxScore,
          level: draft.level.trim() || null,
          passFail: draft.passFail === "none" ? null : draft.passFail === "pass",
          observations: draft.observations.trim() || null,
        };
      })
      .filter(Boolean) as CreateEvaluationPayload["results"];
    try {
      const created = await createEvaluationMutation.mutateAsync({
        educationalCenterId: evaluationInstitutionId,
        classGroupId,
        title: title.trim(),
        subject: subject.trim() || "Sin área",
        evaluationType,
        evaluationDate,
        scaleType,
        maxScore: parsedMaxScore,
        notes: notes.trim() || null,
        results,
      });
      setSelectedEvaluationId(created.id);
      setTitle("");
      setNotes("");
      setFormMessage("Evaluación guardada correctamente.");
      setResultDrafts({});
    } catch (error) {
      setFormMessage(getErrorMessage(error));
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Evaluaciones"
        title="Pruebas realizadas por estudiantes"
        description="Carga y consulta de evaluaciones pedagógicas por grupo, con resultados individuales y alcance institucional."
        actions={
          <div className="relative min-w-72">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar evaluación, área o grupo" className="pl-9" />
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {evaluationsQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard label="Evaluaciones" value={String(metrics.evaluations)} hint="Pruebas cargadas en el alcance actual." icon={ClipboardCheck} />
            <SummaryCard label="Resultados" value={String(metrics.resultsCount)} hint="Registros individuales asociados a estudiantes." icon={Users} />
            <SummaryCard label="Grupos" value={String(metrics.classGroups)} hint="Grupos con evaluaciones registradas." icon={GraduationCap} />
            <SummaryCard label="Promedio" value={metrics.average == null ? "-" : String(metrics.average) + "%"} hint="Promedio agregado cuando existe porcentaje." icon={TrendingUp} />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Resultados por grupo</CardTitle>
            <CardDescription>Promedio porcentual de cada grupo visible a lo largo del tiempo.</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart data={groupTrend.rows} series={groupTrend.series} emptyLabel="Todavía no hay promedios suficientes para graficar grupos." />
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>Resultados por estudiante</CardTitle>
                <CardDescription>Evolución porcentual del estudiante seleccionado dentro del grupo activo.</CardDescription>
              </div>
              <BarChart3 className="size-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Estudiante</Label>
              <select value={effectiveStudentId} onChange={(event) => setSelectedStudentId(event.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm" disabled={!classGroupId || students.length === 0}>
                {students.length === 0 ? <option value="">Seleccioná un grupo</option> : null}
                {students.map((student) => <option key={student.id} value={student.id}>{student.fullName}</option>)}
              </select>
            </div>
            {isLoadingEvaluationDetails ? <Skeleton className="h-72 rounded-2xl" /> : <TrendChart data={studentTrend} series={[{ key: "resultado", label: studentById.get(effectiveStudentId)?.fullName || "Resultado", color: "#2563eb" }]} emptyLabel="Seleccioná un grupo con evaluaciones y resultados para graficar estudiantes." />}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
        <div className="space-y-6">
          <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
            <CardHeader>
              <CardTitle>Filtros de alcance</CardTitle>
              <CardDescription>Los grupos se consultan como entidades reales del backend y se filtran por institución cuando corresponde.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Institución</Label>
                <select value={institutionId} onChange={(event) => { setInstitutionId(event.target.value); setClassGroupId(""); setSelectedStudentId(""); }} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Todas las visibles</option>
                  {institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Grupo</Label>
                <select value={classGroupId} onChange={(event) => { setClassGroupId(event.target.value); setSelectedStudentId(""); }} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Todos los grupos</option>
                  {classGroups.map((classGroup) => <option key={classGroup.id} value={classGroup.id}>{classGroup.name}</option>)}
                </select>
              </div>
            </CardContent>
          </Card>

          {canCreate ? (
            <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
              <CardHeader>
                <CardTitle>Nueva evaluación</CardTitle>
                <CardDescription>Cargá resultados manualmente o importalos desde CSV/XLSX usando legajo, id o nombre del estudiante.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-5" onSubmit={submitEvaluation}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2"><Label>Título</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Diagnóstico inicial" /></div>
                    <div className="space-y-2"><Label>Área</Label><Input value={subject} onChange={(event) => setSubject(event.target.value)} /></div>
                    <div className="space-y-2"><Label>Fecha</Label><Input type="date" value={evaluationDate} onChange={(event) => setEvaluationDate(event.target.value)} /></div>
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <select value={evaluationType} onChange={(event) => setEvaluationType(event.target.value as EvaluationType)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                        {evaluationTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>Escala</Label>
                      <select value={scaleType} onChange={(event) => setScaleType(event.target.value as ScaleType)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                        {scaleTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2"><Label>Máximo</Label><Input type="number" min="1" value={maxScore} onChange={(event) => setMaxScore(event.target.value)} /></div>
                    <div className="space-y-2 md:col-span-2"><Label>Notas</Label><Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observaciones generales" /></div>
                  </div>

                  <div className="rounded-2xl border border-border/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">Importar resultados</p>
                        <p className="mt-1 text-xs text-muted-foreground">Columnas aceptadas: legajo/id, estudiante/nombre, puntaje/nota, máximo, nivel, aprobado y observaciones.</p>
                      </div>
                      <Label htmlFor="evaluation-results-file" className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium">
                        <Upload className="size-4" />
                        CSV o Excel
                      </Label>
                      <input id="evaluation-results-file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(event) => void importResultsFile(event.target.files?.[0] ?? null)} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70">
                    <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                      <p className="text-sm font-semibold text-foreground">Resultados del grupo</p>
                      <Badge variant="outline">{students.length} estudiantes</Badge>
                    </div>
                    <div className="max-h-[420px] overflow-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead>Estudiante</TableHead><TableHead>Puntaje</TableHead><TableHead>Nivel</TableHead><TableHead>Estado</TableHead><TableHead>Observación</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {students.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Seleccioná un grupo para cargar resultados.</TableCell></TableRow>
                          ) : students.map((student) => {
                            const draft = resultDrafts[student.id] || { score: "", level: "", observations: "", passFail: "none" };
                            return (
                              <TableRow key={student.id}>
                                <TableCell><p className="font-medium text-foreground">{student.fullName}</p><p className="text-xs text-muted-foreground">{student.fileNumber || student.id}</p></TableCell>
                                <TableCell><Input className="w-24" type="number" value={draft.score} onChange={(event) => updateDraft(student.id, { score: event.target.value })} /></TableCell>
                                <TableCell><Input className="w-28" value={draft.level} onChange={(event) => updateDraft(student.id, { level: event.target.value })} /></TableCell>
                                <TableCell>
                                  <select value={draft.passFail} onChange={(event) => updateDraft(student.id, { passFail: event.target.value as ResultDraft["passFail"] })} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
                                    <option value="none">-</option><option value="pass">Aprobó</option><option value="fail">No aprobó</option>
                                  </select>
                                </TableCell>
                                <TableCell><Input value={draft.observations} onChange={(event) => updateDraft(student.id, { observations: event.target.value })} /></TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {formMessage ? <p className="text-sm text-muted-foreground">{formMessage}</p> : null}
                  <Button type="submit" disabled={createEvaluationMutation.isPending || !classGroupId}><FileBarChart className="size-4" />Guardar evaluación</Button>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
            <CardHeader><CardTitle>Evaluaciones cargadas</CardTitle><CardDescription>Listado operativo del alcance actual, con acceso al detalle y resultados asociados.</CardDescription></CardHeader>
            <CardContent>
              {evaluationsQuery.isLoading ? (
                <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-16 rounded-2xl" />)}</div>
              ) : filteredEvaluations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">No hay evaluaciones para los filtros actuales.</div>
              ) : (
                <div className="space-y-3">
                  {filteredEvaluations.map((evaluation) => (
                    <button key={evaluation.id} onClick={() => setSelectedEvaluationId(evaluation.id)} className={cn("w-full rounded-2xl border px-4 py-4 text-left transition-all", selectedEvaluationId === evaluation.id ? "border-primary bg-primary/8" : "border-border bg-white/70 hover:border-primary/30")}>
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-semibold text-foreground">{evaluation.title}</p><p className="mt-1 text-sm text-muted-foreground">{evaluation.subject} · {classGroupById.get(evaluation.classGroupId)?.name || evaluation.classGroupId}</p></div>
                        <Badge variant="outline">{displayType(evaluation.evaluationType)}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{formatDateTime(evaluation.evaluationDate)}</span><span>{evaluation.resultsCount} resultados</span><span>{evaluation.averagePercentage == null ? "sin promedio" : String(Math.round(evaluation.averagePercentage)) + "% promedio"}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
            <CardHeader><CardTitle>Detalle</CardTitle><CardDescription>Resultados individuales de la evaluación seleccionada.</CardDescription></CardHeader>
            <CardContent>
              {!selectedEvaluation ? (
                <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">Seleccioná una evaluación para ver sus resultados.</div>
              ) : (
                <EvaluationDetail evaluation={selectedEvaluation} studentById={studentById} institutionName={institutionById.get(selectedEvaluation.educationalCenterId)?.name} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function EvaluationDetail({ evaluation, studentById, institutionName }: { evaluation: EvaluationRecord; studentById: Map<string, { fullName: string; fileNumber: string }>; institutionName?: string }) {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{displayType(evaluation.evaluationType)}</Badge><Badge variant="outline">{displayScale(evaluation.scaleType)}</Badge>{institutionName ? <Badge variant="outline">{institutionName}</Badge> : null}
        </div>
        <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-foreground">{evaluation.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{evaluation.subject} · {formatDateTime(evaluation.evaluationDate)}</p>
        {evaluation.notes ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{evaluation.notes}</p> : null}
      </div>
      <div className="rounded-2xl border border-border/70">
        <Table>
          <TableHeader><TableRow><TableHead>Estudiante</TableHead><TableHead>Resultado</TableHead><TableHead>Nivel</TableHead><TableHead>Observación</TableHead></TableRow></TableHeader>
          <TableBody>
            {evaluation.results.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">Esta evaluación todavía no tiene resultados cargados.</TableCell></TableRow>
            ) : evaluation.results.map((result) => {
              const student = studentById.get(result.studentId);
              const resultLabel = result.score != null ? String(result.score) + (result.maxScore ? " / " + String(result.maxScore) : "") : result.percentage != null ? String(Math.round(result.percentage)) + "%" : result.passFail == null ? "-" : result.passFail ? "Aprobó" : "No aprobó";
              return (
                <TableRow key={result.id}>
                  <TableCell><p className="font-medium text-foreground">{student?.fullName || result.studentId}</p><p className="text-xs text-muted-foreground">{student?.fileNumber || ""}</p></TableCell>
                  <TableCell>{resultLabel}</TableCell>
                  <TableCell>{result.level || "-"}</TableCell>
                  <TableCell>{result.observations || "-"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
