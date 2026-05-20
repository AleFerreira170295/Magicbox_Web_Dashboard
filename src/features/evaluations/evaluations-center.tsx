"use client";

import { useMemo, useState } from "react";
import { ClipboardCheck, FileBarChart, GraduationCap, Search, TrendingUp, Users } from "lucide-react";
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
import { useClassGroups, useCreateEvaluation, useEvaluation, useEvaluations, useStudents } from "@/features/evaluations/api";
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

type ResultDraft = { score: string; level: string; observations: string; passFail: "none" | "pass" | "fail" };

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function displayType(type: EvaluationType | string) {
  return evaluationTypes.find((item) => item.value === type)?.label || type;
}

function displayScale(type: ScaleType | string) {
  return scaleTypes.find((item) => item.value === type)?.label || type;
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

export function EvaluationsCenter() {
  const { tokens, user } = useAuth();
  const [institutionId, setInstitutionId] = useState(user?.educationalCenterId || "");
  const [classGroupId, setClassGroupId] = useState("");
  const [query, setQuery] = useState("");
  const [selectedEvaluationId, setSelectedEvaluationId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Matemática");
  const [evaluationType, setEvaluationType] = useState<EvaluationType>("diagnostic");
  const [evaluationDate, setEvaluationDate] = useState(todayIsoDate());
  const [scaleType, setScaleType] = useState<ScaleType>("score");
  const [maxScore, setMaxScore] = useState("100");
  const [notes, setNotes] = useState("");
  const [resultDrafts, setResultDrafts] = useState<Record<string, ResultDraft>>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);

  const institutionsQuery = useInstitutions(tokens?.accessToken);
  const classGroupsQuery = useClassGroups(tokens?.accessToken, institutionId || user?.educationalCenterId || undefined);
  const studentsQuery = useStudents(tokens?.accessToken, classGroupId || undefined);
  const evaluationsQuery = useEvaluations(tokens?.accessToken, { educationalCenterId: institutionId || undefined, classGroupId: classGroupId || undefined });
  const selectedEvaluationQuery = useEvaluation(tokens?.accessToken, selectedEvaluationId);
  const createEvaluationMutation = useCreateEvaluation(tokens?.accessToken);

  const institutions = useMemo(() => institutionsQuery.data?.data || [], [institutionsQuery.data?.data]);
  const classGroups = useMemo(() => classGroupsQuery.data?.data || [], [classGroupsQuery.data?.data]);
  const students = useMemo(() => studentsQuery.data?.data || [], [studentsQuery.data?.data]);
  const evaluations = useMemo(() => evaluationsQuery.data?.data || [], [evaluationsQuery.data?.data]);
  const selectedEvaluation = selectedEvaluationQuery.data || evaluations.find((item) => item.id === selectedEvaluationId) || null;
  const canCreate = Boolean(user?.roles.some((role) => ["teacher", "director", "admin", "institution-admin"].includes(role)));

  const institutionById = useMemo(() => new Map(institutions.map((institution) => [institution.id, institution])), [institutions]);
  const classGroupById = useMemo(() => new Map(classGroups.map((classGroup) => [classGroup.id, classGroup])), [classGroups]);
  const studentById = useMemo(() => new Map(students.map((student) => [student.id, student])), [students]);

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

  function updateDraft(studentId: string, patch: Partial<ResultDraft>) {
    setResultDrafts((current) => ({
      ...current,
      [studentId]: { ...(current[studentId] || { score: "", level: "", observations: "", passFail: "none" }), ...patch },
    }));
  }

  async function submitEvaluation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormMessage(null);
    if (!institutionId || !classGroupId || !title.trim()) {
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
        educationalCenterId: institutionId,
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

      <div className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
        <div className="space-y-6">
          <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
            <CardHeader>
              <CardTitle>Filtros de alcance</CardTitle>
              <CardDescription>La disponibilidad final depende de los permisos que trae el backend para el usuario autenticado.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Institución</Label>
                <select value={institutionId} onChange={(event) => { setInstitutionId(event.target.value); setClassGroupId(""); }} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="">Todas las visibles</option>
                  {institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Grupo</Label>
                <select value={classGroupId} onChange={(event) => setClassGroupId(event.target.value)} className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm">
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
                <CardDescription>La carga inicial permite crear la prueba y registrar resultados del grupo seleccionado en una sola operación.</CardDescription>
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
