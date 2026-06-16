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
import { useNotifications } from "@/components/ui/notifications";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-context";
import { useLanguage, type AppLanguage } from "@/features/i18n/i18n-context";
import { useInstitutions } from "@/features/institutions/api";
import { useClassGroups, useCreateEvaluation, useEvaluation, useEvaluationDetails, useEvaluations, useStudents } from "@/features/evaluations/api";
import type { CreateEvaluationPayload, EvaluationRecord, EvaluationType, ScaleType } from "@/features/evaluations/types";
import { cn, formatDateTime, getErrorMessage } from "@/lib/utils";

const evaluationTypes: EvaluationType[] = ["diagnostic", "formative", "summative", "observation", "other"];
const scaleTypes: ScaleType[] = ["score", "percentage", "level", "pass_fail"];

const evaluationMessages: Record<AppLanguage, {
  typeLabels: Record<EvaluationType, string>;
  scaleLabels: Record<ScaleType, string>;
  pass: string;
  fail: string;
  noAverage: string;
  averageSuffix: string;
  resultKey: string;
  groupFallback: (index: number) => string;
  importFileType: string;
  importNoGroup: string;
  importReady: (matched: number, skipped: number) => string;
  requiredScope: string;
  saved: string;
  header: { eyebrow: string; title: string; description: string; search: string };
  metrics: { evaluations: string; evaluationsHint: string; results: string; resultsHint: string; groups: string; groupsHint: string; average: string; averageHint: string };
  charts: { groupTitle: string; groupDesc: string; groupEmpty: string; studentTitle: string; studentDesc: string; student: string; selectGroup: string; studentEmpty: string; result: string };
  filters: { title: string; desc: string; search: string; dateFrom: string; dateTo: string; institution: string; allVisible: string; group: string; allGroups: string };
  form: { title: string; desc: string; titleLabel: string; titlePlaceholder: string; subject: string; subjectFallback: string; date: string; type: string; scale: string; max: string; notes: string; notesPlaceholder: string; importTitle: string; importDesc: string; file: string; groupResults: string; students: (count: number) => string; score: string; level: string; state: string; observation: string; noGroup: string; none: string; save: string };
  list: { title: string; desc: string; empty: string; resultsCount: (count: number) => string };
  detail: { title: string; desc: string; empty: string; student: string; result: string; level: string; observation: string; noResults: string };
}> = {
  es: {
    typeLabels: { diagnostic: "Diagnóstico", formative: "Formativa", summative: "Sumativa", observation: "Observación", other: "Otra" },
    scaleLabels: { score: "Puntaje", percentage: "Porcentaje", level: "Nivel", pass_fail: "Aprobado" },
    pass: "Aprobó",
    fail: "No aprobó",
    noAverage: "sin promedio",
    averageSuffix: "promedio",
    resultKey: "resultado",
    groupFallback: (index) => `Grupo ${index}`,
    importFileType: "El archivo debe ser .xlsx o .csv.",
    importNoGroup: "Seleccioná un grupo antes de importar resultados.",
    importReady: (matched, skipped) => `Importación lista: ${matched} estudiantes asociados${skipped ? `, ${skipped} filas sin match` : ""}.`,
    requiredScope: "Completá institución, grupo y título antes de guardar.",
    saved: "Evaluación guardada correctamente.",
    header: { eyebrow: "Evaluaciones", title: "Pruebas realizadas por estudiantes", description: "Carga y consulta de evaluaciones pedagógicas por grupo, con resultados individuales y alcance institucional.", search: "Buscar evaluación, área o grupo" },
    metrics: { evaluations: "Evaluaciones", evaluationsHint: "Pruebas cargadas en el alcance actual.", results: "Resultados", resultsHint: "Registros individuales asociados a estudiantes.", groups: "Grupos", groupsHint: "Grupos con evaluaciones registradas.", average: "Promedio", averageHint: "Promedio agregado cuando existe porcentaje." },
    charts: { groupTitle: "Resultados por grupo", groupDesc: "Promedio porcentual de cada grupo visible a lo largo del tiempo.", groupEmpty: "Todavía no hay promedios suficientes para graficar grupos.", studentTitle: "Resultados por estudiante", studentDesc: "Evolución porcentual del estudiante seleccionado dentro del grupo activo.", student: "Estudiante", selectGroup: "Seleccioná un grupo", studentEmpty: "Seleccioná un grupo con evaluaciones y resultados para graficar estudiantes.", result: "Resultado" },
    filters: { title: "Filtros", desc: "Ajustá la lectura de resultados por grupo, estudiante y evaluaciones cargadas.", search: "Buscar evaluación, área o grupo", dateFrom: "Desde", dateTo: "Hasta", institution: "Institución", allVisible: "Todas las visibles", group: "Grupo", allGroups: "Todos los grupos" },
    form: { title: "Nueva evaluación", desc: "Cargá resultados manualmente o importalos desde CSV/XLSX usando legajo, id o nombre del estudiante.", titleLabel: "Título", titlePlaceholder: "Diagnóstico inicial", subject: "Área", subjectFallback: "Sin área", date: "Fecha", type: "Tipo", scale: "Escala", max: "Máximo", notes: "Notas", notesPlaceholder: "Observaciones generales", importTitle: "Importar resultados", importDesc: "Columnas aceptadas: legajo/id, estudiante/nombre, puntaje/nota, máximo, nivel, aprobado y observaciones.", file: "CSV o Excel", groupResults: "Resultados del grupo", students: (count) => `${count} estudiantes`, score: "Puntaje", level: "Nivel", state: "Estado", observation: "Observación", noGroup: "Seleccioná un grupo para cargar resultados.", none: "-", save: "Guardar evaluación" },
    list: { title: "Evaluaciones cargadas", desc: "Listado operativo del alcance actual, con acceso al detalle y resultados asociados.", empty: "No hay evaluaciones para los filtros actuales.", resultsCount: (count) => `${count} resultados` },
    detail: { title: "Detalle", desc: "Resultados individuales de la evaluación seleccionada.", empty: "Seleccioná una evaluación para ver sus resultados.", student: "Estudiante", result: "Resultado", level: "Nivel", observation: "Observación", noResults: "Esta evaluación todavía no tiene resultados cargados." },
  },
  en: {
    typeLabels: { diagnostic: "Diagnostic", formative: "Formative", summative: "Summative", observation: "Observation", other: "Other" },
    scaleLabels: { score: "Score", percentage: "Percentage", level: "Level", pass_fail: "Pass/fail" },
    pass: "Passed",
    fail: "Did not pass",
    noAverage: "no average",
    averageSuffix: "average",
    resultKey: "result",
    groupFallback: (index) => `Group ${index}`,
    importFileType: "The file must be .xlsx or .csv.",
    importNoGroup: "Select a group before importing results.",
    importReady: (matched, skipped) => `Import ready: ${matched} students matched${skipped ? `, ${skipped} rows without a match` : ""}.`,
    requiredScope: "Complete institution, group, and title before saving.",
    saved: "Evaluation saved successfully.",
    header: { eyebrow: "Evaluations", title: "Student assessments", description: "Load and review pedagogical evaluations by group, with individual results and institutional scope.", search: "Search evaluation, subject, or group" },
    metrics: { evaluations: "Evaluations", evaluationsHint: "Assessments loaded in the current scope.", results: "Results", resultsHint: "Individual records linked to students.", groups: "Groups", groupsHint: "Groups with registered evaluations.", average: "Average", averageHint: "Aggregated average when a percentage exists." },
    charts: { groupTitle: "Results by group", groupDesc: "Percentage average for each visible group over time.", groupEmpty: "There are not enough averages yet to chart groups.", studentTitle: "Results by student", studentDesc: "Percentage trend for the selected student in the active group.", student: "Student", selectGroup: "Select a group", studentEmpty: "Select a group with evaluations and results to chart students.", result: "Result" },
    filters: { title: "Filters", desc: "Adjust the group, student, and loaded evaluation results view.", search: "Search evaluation, subject, or group", dateFrom: "From", dateTo: "To", institution: "Institution", allVisible: "All visible", group: "Group", allGroups: "All groups" },
    form: { title: "New evaluation", desc: "Load results manually or import them from CSV/XLSX using student file number, id, or name.", titleLabel: "Title", titlePlaceholder: "Initial diagnostic", subject: "Subject", subjectFallback: "No subject", date: "Date", type: "Type", scale: "Scale", max: "Maximum", notes: "Notes", notesPlaceholder: "General observations", importTitle: "Import results", importDesc: "Accepted columns: file number/id, student/name, score/grade, maximum, level, passed, and observations.", file: "CSV or Excel", groupResults: "Group results", students: (count) => `${count} students`, score: "Score", level: "Level", state: "Status", observation: "Observation", noGroup: "Select a group to load results.", none: "-", save: "Save evaluation" },
    list: { title: "Loaded evaluations", desc: "Operational list for the current scope, with access to details and linked results.", empty: "There are no evaluations for the current filters.", resultsCount: (count) => `${count} results` },
    detail: { title: "Detail", desc: "Individual results for the selected evaluation.", empty: "Select an evaluation to see its results.", student: "Student", result: "Result", level: "Level", observation: "Observation", noResults: "This evaluation does not have loaded results yet." },
  },
  pt: {
    typeLabels: { diagnostic: "Diagnóstica", formative: "Formativa", summative: "Somativa", observation: "Observação", other: "Outra" },
    scaleLabels: { score: "Pontuação", percentage: "Percentual", level: "Nível", pass_fail: "Aprovado" },
    pass: "Aprovou",
    fail: "Não aprovou",
    noAverage: "sem média",
    averageSuffix: "média",
    resultKey: "resultado",
    groupFallback: (index) => `Grupo ${index}`,
    importFileType: "O arquivo deve ser .xlsx ou .csv.",
    importNoGroup: "Selecione um grupo antes de importar resultados.",
    importReady: (matched, skipped) => `Importação pronta: ${matched} estudantes associados${skipped ? `, ${skipped} linhas sem correspondência` : ""}.`,
    requiredScope: "Complete instituição, grupo e título antes de salvar.",
    saved: "Avaliação salva com sucesso.",
    header: { eyebrow: "Avaliações", title: "Avaliações realizadas por estudantes", description: "Carregue e consulte avaliações pedagógicas por grupo, com resultados individuais e escopo institucional.", search: "Buscar avaliação, área ou grupo" },
    metrics: { evaluations: "Avaliações", evaluationsHint: "Avaliações carregadas no escopo atual.", results: "Resultados", resultsHint: "Registros individuais associados a estudantes.", groups: "Grupos", groupsHint: "Grupos com avaliações registradas.", average: "Média", averageHint: "Média agregada quando existe percentual." },
    charts: { groupTitle: "Resultados por grupo", groupDesc: "Média percentual de cada grupo visível ao longo do tempo.", groupEmpty: "Ainda não há médias suficientes para graficar grupos.", studentTitle: "Resultados por estudante", studentDesc: "Evolução percentual do estudante selecionado no grupo ativo.", student: "Estudante", selectGroup: "Selecione um grupo", studentEmpty: "Selecione um grupo com avaliações e resultados para graficar estudantes.", result: "Resultado" },
    filters: { title: "Filtros", desc: "Ajuste a leitura de resultados por grupo, estudante e avaliações carregadas.", search: "Buscar avaliação, área ou grupo", dateFrom: "Desde", dateTo: "Até", institution: "Instituição", allVisible: "Todas visíveis", group: "Grupo", allGroups: "Todos os grupos" },
    form: { title: "Nova avaliação", desc: "Carregue resultados manualmente ou importe de CSV/XLSX usando matrícula, id ou nome do estudante.", titleLabel: "Título", titlePlaceholder: "Diagnóstico inicial", subject: "Área", subjectFallback: "Sem área", date: "Data", type: "Tipo", scale: "Escala", max: "Máximo", notes: "Notas", notesPlaceholder: "Observações gerais", importTitle: "Importar resultados", importDesc: "Colunas aceitas: matrícula/id, estudante/nome, pontuação/nota, máximo, nível, aprovado e observações.", file: "CSV ou Excel", groupResults: "Resultados do grupo", students: (count) => `${count} estudantes`, score: "Pontuação", level: "Nível", state: "Estado", observation: "Observação", noGroup: "Selecione um grupo para carregar resultados.", none: "-", save: "Salvar avaliação" },
    list: { title: "Avaliações carregadas", desc: "Lista operacional do escopo atual, com acesso ao detalhe e resultados associados.", empty: "Não há avaliações para os filtros atuais.", resultsCount: (count) => `${count} resultados` },
    detail: { title: "Detalhe", desc: "Resultados individuais da avaliação selecionada.", empty: "Selecione uma avaliação para ver seus resultados.", student: "Estudante", result: "Resultado", level: "Nível", observation: "Observação", noResults: "Esta avaliação ainda não tem resultados carregados." },
  },
};

const chartColors = ["#2563eb", "#0f766e", "#7c3aed", "#c2410c", "#be123c", "#4d7c0f"];

type ResultDraft = { score: string; level: string; observations: string; passFail: "none" | "pass" | "fail" };
type ImportRow = Record<string, unknown>;
type TrendDatum = { date: string; [key: string]: string | number | null };

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function displayType(type: EvaluationType | string, language: AppLanguage) {
  return evaluationMessages[language].typeLabels[type as EvaluationType] || type;
}

function displayScale(type: ScaleType | string, language: AppLanguage) {
  return evaluationMessages[language].scaleLabels[type as ScaleType] || type;
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

async function readImportRows(file: File, language: AppLanguage): Promise<ImportRow[]> {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".csv")) return parseCsvRows(await file.text());
  if (!lowerName.endsWith(".xlsx")) throw new Error(evaluationMessages[language].importFileType);
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
      <CardContent className="flex min-h-40 items-center p-5">
        <div className="flex w-full items-start justify-between gap-4">
          <div className="min-w-0">
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
  const { notify } = useNotifications();
  const { language } = useLanguage();
  const t = evaluationMessages[language];
  const [institutionId, setInstitutionId] = useState(user?.educationalCenterId || "");
  const [classGroupId, setClassGroupId] = useState("");
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [evaluationType, setEvaluationType] = useState<EvaluationType>("diagnostic");
  const [evaluationDate, setEvaluationDate] = useState(todayIsoDate());
  const [scaleType, setScaleType] = useState<ScaleType>("score");
  const [maxScore, setMaxScore] = useState("100");
  const [notes, setNotes] = useState("");
  const [resultDrafts, setResultDrafts] = useState<Record<string, ResultDraft>>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);

  function showFormMessage(message: string, tone: "success" | "error") {
    setFormMessage(message);
    notify({ tone, message });
  }

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
    const normalized = normalizeText(query);
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    return evaluations.filter((evaluation) =>
      {
        const evaluationTime = evaluation.evaluationDate ? new Date(`${evaluation.evaluationDate}T12:00:00`).getTime() : 0;
        if (fromTime !== null && evaluationTime < fromTime) return false;
        if (toTime !== null && evaluationTime > toTime) return false;
        if (!normalized) return true;
        return [evaluation.title, evaluation.subject, displayType(evaluation.evaluationType, language), classGroupById.get(evaluation.classGroupId)?.name]
        .filter(Boolean)
          .some((value) => normalizeText(value).includes(normalized));
      },
    );
  }, [classGroupById, dateFrom, dateTo, evaluations, language, query]);

  const metrics = useMemo(() => {
    const resultsCount = filteredEvaluations.reduce((acc, evaluation) => acc + evaluation.resultsCount, 0);
    const averageValues = filteredEvaluations.map((evaluation) => evaluation.averagePercentage).filter((value): value is number => typeof value === "number" && !Number.isNaN(value));
    return {
      evaluations: filteredEvaluations.length,
      resultsCount,
      classGroups: new Set(filteredEvaluations.map((evaluation) => evaluation.classGroupId)).size,
      average: averageValues.length ? Math.round(averageValues.reduce((acc, value) => acc + value, 0) / averageValues.length) : null,
    };
  }, [filteredEvaluations]);

  const groupTrend = useMemo(() => {
    const groupIds = Array.from(new Set(filteredEvaluations.map((evaluation) => evaluation.classGroupId).filter(Boolean))).slice(0, chartColors.length);
    const series = groupIds.map((groupId, index) => ({
      key: `group_${index}`,
      label: classGroupById.get(groupId)?.name || t.groupFallback(index + 1),
      color: chartColors[index],
      groupId,
    }));
    const rows = Array.from(new Set(filteredEvaluations.map((evaluation) => evaluation.evaluationDate).filter(Boolean)))
      .sort()
      .map<TrendDatum>((date) => {
        const row: TrendDatum = { date };
        for (const item of series) {
          const values = filteredEvaluations
            .filter((evaluation) => evaluation.evaluationDate === date && evaluation.classGroupId === item.groupId)
            .map((evaluation) => evaluation.averagePercentage)
            .filter((value): value is number => typeof value === "number" && !Number.isNaN(value));
          row[item.key] = values.length ? Math.round(values.reduce((acc, value) => acc + value, 0) / values.length) : null;
        }
        return row;
      });
    return { rows, series };
  }, [classGroupById, filteredEvaluations, t]);

  const studentTrend = useMemo(() => {
    if (!effectiveStudentId) return [] as TrendDatum[];
    const filteredIds = new Set(filteredEvaluations.map((evaluation) => evaluation.id));
    return detailedEvaluations
      .filter((evaluation) => filteredIds.has(evaluation.id))
      .map<TrendDatum | null>((evaluation) => {
        const result = evaluation.results.find((item) => item.studentId === effectiveStudentId);
        const percentage = result ? resultPercentage(result) : null;
        return percentage == null ? null : { date: evaluation.evaluationDate, [t.resultKey]: Math.round(percentage) };
      })
      .filter((entry): entry is TrendDatum => Boolean(entry))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [detailedEvaluations, effectiveStudentId, filteredEvaluations, t.resultKey]);

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
      showFormMessage(t.importNoGroup, "error");
      return;
    }
    try {
      const rows = await readImportRows(file, language);
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
      showFormMessage(t.importReady(matched, skipped), "success");
    } catch (error) {
      showFormMessage(getErrorMessage(error), "error");
    }
  }

  async function submitEvaluation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage(null);
    const evaluationInstitutionId = institutionId || selectedClassGroup?.educationalCenterId || user?.educationalCenterId || "";
    if (!evaluationInstitutionId || !classGroupId || !title.trim()) {
      showFormMessage(t.requiredScope, "error");
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
        subject: subject.trim() || t.form.subjectFallback,
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
      showFormMessage(t.saved, "success");
      setResultDrafts({});
    } catch (error) {
      showFormMessage(getErrorMessage(error), "error");
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={t.header.eyebrow}
        title={t.header.title}
        description={t.header.description}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {evaluationsQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard label={t.metrics.evaluations} value={String(metrics.evaluations)} hint={t.metrics.evaluationsHint} icon={ClipboardCheck} />
            <SummaryCard label={t.metrics.results} value={String(metrics.resultsCount)} hint={t.metrics.resultsHint} icon={Users} />
            <SummaryCard label={t.metrics.groups} value={String(metrics.classGroups)} hint={t.metrics.groupsHint} icon={GraduationCap} />
            <SummaryCard label={t.metrics.average} value={metrics.average == null ? "-" : String(metrics.average) + "%"} hint={t.metrics.averageHint} icon={TrendingUp} />
          </>
        )}
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader className="pb-4">
          <CardTitle>{t.filters.title}</CardTitle>
          <CardDescription>{t.filters.desc}</CardDescription>
        </CardHeader>
        <CardContent className="grid items-end gap-4 pt-0 md:grid-cols-2 xl:grid-cols-[minmax(300px,1.35fr)_minmax(180px,0.75fr)_minmax(180px,0.75fr)_minmax(240px,1fr)_minmax(240px,1fr)]">
          <div className="flex min-w-0 flex-col gap-2">
            <Label className="text-sm font-medium text-foreground">{t.header.search}</Label>
            <div className="relative min-w-0">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.filters.search} className="h-11 rounded-xl pl-9 leading-none" />
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Label className="text-sm font-medium text-foreground">{t.filters.dateFrom}</Label>
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-11 rounded-xl leading-none" />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Label className="text-sm font-medium text-foreground">{t.filters.dateTo}</Label>
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-11 rounded-xl leading-none" />
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Label className="text-sm font-medium text-foreground">{t.filters.institution}</Label>
            <select value={institutionId} onChange={(event) => { setInstitutionId(event.target.value); setClassGroupId(""); setSelectedStudentId(""); }} className="h-11 w-full rounded-xl border border-input bg-white/92 px-4 text-sm leading-none text-foreground shadow-[0_10px_24px_rgba(66,128,164,0.08)] outline-none transition focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">{t.filters.allVisible}</option>
              {institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}
            </select>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <Label className="text-sm font-medium text-foreground">{t.filters.group}</Label>
            <select value={classGroupId} onChange={(event) => { setClassGroupId(event.target.value); setSelectedStudentId(""); }} className="h-11 w-full rounded-xl border border-input bg-white/92 px-4 text-sm leading-none text-foreground shadow-[0_10px_24px_rgba(66,128,164,0.08)] outline-none transition focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">{t.filters.allGroups}</option>
              {classGroups.map((classGroup) => <option key={classGroup.id} value={classGroup.id}>{classGroup.name}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>{t.charts.groupTitle}</CardTitle>
            <CardDescription>{t.charts.groupDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <TrendChart data={groupTrend.rows} series={groupTrend.series} emptyLabel={t.charts.groupEmpty} />
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>{t.charts.studentTitle}</CardTitle>
                <CardDescription>{t.charts.studentDesc}</CardDescription>
              </div>
              <BarChart3 className="size-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>{t.charts.student}</Label>
              <select value={effectiveStudentId} onChange={(event) => setSelectedStudentId(event.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm" disabled={!classGroupId || students.length === 0}>
                {students.length === 0 ? <option value="">{t.charts.selectGroup}</option> : null}
                {students.map((student) => <option key={student.id} value={student.id}>{student.fullName}</option>)}
              </select>
            </div>
            {isLoadingEvaluationDetails ? <Skeleton className="h-72 rounded-2xl" /> : <TrendChart data={studentTrend} series={[{ key: t.resultKey, label: studentById.get(effectiveStudentId)?.fullName || t.charts.result, color: "#2563eb" }]} emptyLabel={t.charts.studentEmpty} />}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
        <div className="space-y-6">
          {canCreate ? (
            <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
              <CardHeader>
                <CardTitle>{t.form.title}</CardTitle>
                <CardDescription>{t.form.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="space-y-5" onSubmit={submitEvaluation}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2"><Label>{t.form.titleLabel}</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t.form.titlePlaceholder} /></div>
                    <div className="space-y-2"><Label>{t.form.subject}</Label><Input value={subject} onChange={(event) => setSubject(event.target.value)} /></div>
                    <div className="space-y-2"><Label>{t.form.date}</Label><Input type="date" value={evaluationDate} onChange={(event) => setEvaluationDate(event.target.value)} /></div>
                    <div className="space-y-2">
                      <Label>{t.form.type}</Label>
                      <select value={evaluationType} onChange={(event) => setEvaluationType(event.target.value as EvaluationType)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                        {evaluationTypes.map((item) => <option key={item} value={item}>{displayType(item, language)}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t.form.scale}</Label>
                      <select value={scaleType} onChange={(event) => setScaleType(event.target.value as ScaleType)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                        {scaleTypes.map((item) => <option key={item} value={item}>{displayScale(item, language)}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2"><Label>{t.form.max}</Label><Input type="number" min="1" value={maxScore} onChange={(event) => setMaxScore(event.target.value)} /></div>
                    <div className="space-y-2 md:col-span-2"><Label>{t.form.notes}</Label><Input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t.form.notesPlaceholder} /></div>
                  </div>

                  <div className="rounded-2xl border border-border/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{t.form.importTitle}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{t.form.importDesc}</p>
                      </div>
                      <Label htmlFor="evaluation-results-file" className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm font-medium">
                        <Upload className="size-4" />
                        {t.form.file}
                      </Label>
                      <input id="evaluation-results-file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" onChange={(event) => void importResultsFile(event.target.files?.[0] ?? null)} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/70">
                    <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
                      <p className="text-sm font-semibold text-foreground">{t.form.groupResults}</p>
                      <Badge variant="outline">{t.form.students(students.length)}</Badge>
                    </div>
                    <div className="max-h-[420px] overflow-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead>{t.detail.student}</TableHead><TableHead>{t.form.score}</TableHead><TableHead>{t.form.level}</TableHead><TableHead>{t.form.state}</TableHead><TableHead>{t.form.observation}</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {students.length === 0 ? (
                            <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">{t.form.noGroup}</TableCell></TableRow>
                          ) : students.map((student) => {
                            const draft = resultDrafts[student.id] || { score: "", level: "", observations: "", passFail: "none" };
                            return (
                              <TableRow key={student.id}>
                                <TableCell><p className="font-medium text-foreground">{student.fullName}</p><p className="text-xs text-muted-foreground">{student.fileNumber || student.id}</p></TableCell>
                                <TableCell><Input className="w-24" type="number" value={draft.score} onChange={(event) => updateDraft(student.id, { score: event.target.value })} /></TableCell>
                                <TableCell><Input className="w-28" value={draft.level} onChange={(event) => updateDraft(student.id, { level: event.target.value })} /></TableCell>
                                <TableCell>
                                  <select value={draft.passFail} onChange={(event) => updateDraft(student.id, { passFail: event.target.value as ResultDraft["passFail"] })} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
                                    <option value="none">{t.form.none}</option><option value="pass">{t.pass}</option><option value="fail">{t.fail}</option>
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
                  <Button type="submit" disabled={createEvaluationMutation.isPending || !classGroupId}><FileBarChart className="size-4" />{t.form.save}</Button>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
            <CardHeader><CardTitle>{t.list.title}</CardTitle><CardDescription>{t.list.desc}</CardDescription></CardHeader>
            <CardContent>
              {evaluationsQuery.isLoading ? (
                <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-16 rounded-2xl" />)}</div>
              ) : filteredEvaluations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">{t.list.empty}</div>
              ) : (
                <div className="space-y-3">
                  {filteredEvaluations.map((evaluation) => (
                    <button key={evaluation.id} onClick={() => setSelectedEvaluationId(evaluation.id)} className={cn("w-full rounded-2xl border px-4 py-4 text-left transition-all", selectedEvaluationId === evaluation.id ? "border-primary bg-primary/8" : "border-border bg-white/70 hover:border-primary/30")}>
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-semibold text-foreground">{evaluation.title}</p><p className="mt-1 text-sm text-muted-foreground">{evaluation.subject} · {classGroupById.get(evaluation.classGroupId)?.name || evaluation.classGroupId}</p></div>
                        <Badge variant="outline">{displayType(evaluation.evaluationType, language)}</Badge>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span>{formatDateTime(evaluation.evaluationDate)}</span><span>{t.list.resultsCount(evaluation.resultsCount)}</span><span>{evaluation.averagePercentage == null ? t.noAverage : String(Math.round(evaluation.averagePercentage)) + `% ${t.averageSuffix}`}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
            <CardHeader><CardTitle>{t.detail.title}</CardTitle><CardDescription>{t.detail.desc}</CardDescription></CardHeader>
            <CardContent>
              {!selectedEvaluation ? (
                <div className="rounded-2xl border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">{t.detail.empty}</div>
              ) : (
                <EvaluationDetail evaluation={selectedEvaluation} studentById={studentById} institutionName={institutionById.get(selectedEvaluation.educationalCenterId)?.name} language={language} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function EvaluationDetail({ evaluation, studentById, institutionName, language }: { evaluation: EvaluationRecord; studentById: Map<string, { fullName: string; fileNumber: string }>; institutionName?: string; language: AppLanguage }) {
  const t = evaluationMessages[language];
  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{displayType(evaluation.evaluationType, language)}</Badge><Badge variant="outline">{displayScale(evaluation.scaleType, language)}</Badge>{institutionName ? <Badge variant="outline">{institutionName}</Badge> : null}
        </div>
        <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-foreground">{evaluation.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{evaluation.subject} · {formatDateTime(evaluation.evaluationDate)}</p>
        {evaluation.notes ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{evaluation.notes}</p> : null}
      </div>
      <div className="rounded-2xl border border-border/70">
        <Table>
          <TableHeader><TableRow><TableHead>{t.detail.student}</TableHead><TableHead>{t.detail.result}</TableHead><TableHead>{t.detail.level}</TableHead><TableHead>{t.detail.observation}</TableHead></TableRow></TableHeader>
          <TableBody>
            {evaluation.results.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">{t.detail.noResults}</TableCell></TableRow>
            ) : evaluation.results.map((result) => {
              const student = studentById.get(result.studentId);
              const resultLabel = result.score != null ? String(result.score) + (result.maxScore ? " / " + String(result.maxScore) : "") : result.percentage != null ? String(Math.round(result.percentage)) + "%" : result.passFail == null ? "-" : result.passFail ? t.pass : t.fail;
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
