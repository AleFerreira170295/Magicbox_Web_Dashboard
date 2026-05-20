import type { JsonObject } from "@/lib/api/types";

export type EvaluationType = "diagnostic" | "formative" | "summative" | "observation" | "other";
export type ScaleType = "score" | "percentage" | "level" | "pass_fail";

export interface ClassGroupRecord {
  id: string;
  educationalCenterId: string;
  name: string;
  code: string;
}

export interface StudentRecord {
  id: string;
  classGroupId: string;
  firstName: string;
  lastName: string;
  fileNumber: string;
  fullName: string;
}

export interface EvaluationResultRecord {
  id: string;
  evaluationId: string;
  studentId: string;
  score?: number | null;
  maxScore?: number | null;
  percentage?: number | null;
  level?: string | null;
  passFail?: boolean | null;
  observations?: string | null;
  raw: JsonObject;
}

export interface EvaluationRecord {
  id: string;
  educationalCenterId: string;
  classGroupId: string;
  createdByUserId?: string | null;
  title: string;
  subject: string;
  evaluationType: EvaluationType;
  evaluationDate: string;
  scaleType: ScaleType;
  maxScore?: number | null;
  notes?: string | null;
  resultsCount: number;
  averagePercentage?: number | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  results: EvaluationResultRecord[];
  raw: JsonObject;
}

export interface CreateEvaluationPayload {
  educationalCenterId: string;
  classGroupId: string;
  title: string;
  subject: string;
  evaluationType: EvaluationType;
  evaluationDate: string;
  scaleType: ScaleType;
  maxScore?: number | null;
  notes?: string | null;
  results?: Array<{
    studentId: string;
    score?: number | null;
    maxScore?: number | null;
    percentage?: number | null;
    level?: string | null;
    passFail?: boolean | null;
    observations?: string | null;
  }>;
}

