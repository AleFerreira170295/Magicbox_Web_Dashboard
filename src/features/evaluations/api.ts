import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiEndpoints } from "@/lib/api/endpoints";
import { apiRequest } from "@/lib/api/fetcher";
import type { JsonObject, PaginatedResponse } from "@/lib/api/types";
import type {
  ClassGroupRecord,
  CreateEvaluationPayload,
  EvaluationRecord,
  EvaluationResultRecord,
  StudentRecord,
} from "@/features/evaluations/types";

function asRecord(value: unknown): JsonObject {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as JsonObject;
  return {};
}

function readString(record: JsonObject, ...keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function normalizePage<T>(response: unknown, mapper: (value: unknown) => T): PaginatedResponse<T> {
  if (Array.isArray(response)) {
    return { data: response.map(mapper), page: 1, limit: response.length, total: response.length, total_pages: 1 };
  }
  const record = asRecord(response);
  const nested = asRecord(record.data);
  const source = Array.isArray(nested.data) ? nested : record;
  const data = Array.isArray(source.data) ? source.data : [];
  return {
    data: data.map(mapper),
    page: Number(source.page || 1),
    limit: Number(source.limit || data.length || 0),
    total: Number(source.total || data.length || 0),
    total_pages: Number(source.total_pages || 1),
  };
}

function normalizeClassGroup(value: unknown): ClassGroupRecord {
  const record = asRecord(value);
  return {
    id: readString(record, "id"),
    educationalCenterId: readString(record, "educational_center_id", "educationalCenterId"),
    name: readString(record, "name") || "Grupo sin nombre",
    code: readString(record, "code") || "-",
  };
}

function normalizeStudent(value: unknown): StudentRecord {
  const record = asRecord(value);
  const firstName = readString(record, "first_name", "firstName");
  const lastName = readString(record, "last_name", "lastName");
  return {
    id: readString(record, "id"),
    classGroupId: readString(record, "class_group_id", "classGroupId"),
    firstName,
    lastName,
    fileNumber: readString(record, "file_number", "fileNumber"),
    fullName: [firstName, lastName].filter(Boolean).join(" ").trim() || "Estudiante sin nombre",
  };
}

function normalizeResult(value: unknown): EvaluationResultRecord {
  const record = asRecord(value);
  return {
    id: readString(record, "id"),
    evaluationId: readString(record, "evaluation_id", "evaluationId"),
    studentId: readString(record, "student_id", "studentId"),
    score: record.score == null ? null : Number(record.score),
    maxScore: record.max_score == null ? null : Number(record.max_score),
    percentage: record.percentage == null ? null : Number(record.percentage),
    level: readString(record, "level") || null,
    passFail: typeof record.pass_fail === "boolean" ? record.pass_fail : null,
    observations: readString(record, "observations") || null,
    raw: record,
  };
}

function normalizeEvaluation(value: unknown): EvaluationRecord {
  const record = asRecord(value);
  const results = Array.isArray(record.results) ? record.results.map(normalizeResult) : [];
  return {
    id: readString(record, "id"),
    educationalCenterId: readString(record, "educational_center_id", "educationalCenterId"),
    classGroupId: readString(record, "class_group_id", "classGroupId"),
    createdByUserId: readString(record, "created_by_user_id", "createdByUserId") || null,
    title: readString(record, "title") || "Evaluación sin título",
    subject: readString(record, "subject") || "Sin área",
    evaluationType: (readString(record, "evaluation_type", "evaluationType") || "other") as EvaluationRecord["evaluationType"],
    evaluationDate: readString(record, "evaluation_date", "evaluationDate"),
    scaleType: (readString(record, "scale_type", "scaleType") || "score") as EvaluationRecord["scaleType"],
    maxScore: record.max_score == null ? null : Number(record.max_score),
    notes: readString(record, "notes") || null,
    resultsCount: Number(record.results_count ?? record.resultsCount ?? results.length),
    averagePercentage: record.average_percentage == null ? null : Number(record.average_percentage),
    createdAt: readString(record, "created_at", "createdAt") || null,
    updatedAt: readString(record, "updated_at", "updatedAt") || null,
    results,
    raw: record,
  };
}

function serializeEvaluation(payload: CreateEvaluationPayload) {
  return {
    educational_center_id: payload.educationalCenterId,
    class_group_id: payload.classGroupId,
    title: payload.title,
    subject: payload.subject,
    evaluation_type: payload.evaluationType,
    evaluation_date: payload.evaluationDate,
    scale_type: payload.scaleType,
    max_score: payload.maxScore || null,
    notes: payload.notes || null,
    results: (payload.results || []).map((result) => ({
      student_id: result.studentId,
      score: result.score ?? null,
      max_score: result.maxScore ?? payload.maxScore ?? null,
      percentage: result.percentage ?? null,
      level: result.level || null,
      pass_fail: result.passFail ?? null,
      observations: result.observations || null,
    })),
  };
}

export async function listClassGroups(token: string, educationalCenterId?: string | null) {
  const response = await apiRequest<unknown>(apiEndpoints.classGroups.list, {
    token,
    searchParams: {
      page: 1,
      limit: 200,
      sort_by: "name",
      order: "asc",
      educational_center_id: educationalCenterId || undefined,
    },
  });
  return normalizePage(response, normalizeClassGroup);
}

export async function listStudents(token: string, classGroupId?: string | null) {
  const response = await apiRequest<unknown>(apiEndpoints.students.list, {
    token,
    searchParams: {
      page: 1,
      limit: 300,
      sort_by: "last_name",
      order: "asc",
      class_group_id: classGroupId || undefined,
    },
  });
  return normalizePage(response, normalizeStudent);
}

export async function listEvaluations(token: string, params: { educationalCenterId?: string | null; classGroupId?: string | null } = {}) {
  const response = await apiRequest<unknown>(apiEndpoints.evaluations.list, {
    token,
    searchParams: {
      page: 1,
      limit: 100,
      educational_center_id: params.educationalCenterId || undefined,
      class_group_id: params.classGroupId || undefined,
    },
  });
  return normalizePage(response, normalizeEvaluation);
}

export async function getEvaluation(token: string, id: string) {
  const response = await apiRequest<unknown>(apiEndpoints.evaluations.byId(id), { token });
  return normalizeEvaluation(response);
}

export async function createEvaluation(token: string, payload: CreateEvaluationPayload) {
  const response = await apiRequest<unknown>(apiEndpoints.evaluations.list, {
    method: "POST",
    token,
    body: serializeEvaluation(payload),
  });
  return normalizeEvaluation(response);
}

export function useClassGroups(token?: string, educationalCenterId?: string | null) {
  return useQuery({
    queryKey: ["class-groups", token, educationalCenterId],
    queryFn: () => listClassGroups(token as string, educationalCenterId),
    enabled: Boolean(token),
  });
}

export function useStudents(token?: string, classGroupId?: string | null) {
  return useQuery({
    queryKey: ["students", token, classGroupId],
    queryFn: () => listStudents(token as string, classGroupId),
    enabled: Boolean(token && classGroupId),
  });
}

export function useEvaluations(token?: string, params: { educationalCenterId?: string | null; classGroupId?: string | null } = {}) {
  return useQuery({
    queryKey: ["evaluations", token, params.educationalCenterId, params.classGroupId],
    queryFn: () => listEvaluations(token as string, params),
    enabled: Boolean(token),
  });
}

export function useEvaluation(token?: string, id?: string | null) {
  return useQuery({
    queryKey: ["evaluation", token, id],
    queryFn: () => getEvaluation(token as string, id as string),
    enabled: Boolean(token && id),
  });
}

export function useCreateEvaluation(token?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateEvaluationPayload) => createEvaluation(token as string, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evaluations"] });
    },
  });
}

