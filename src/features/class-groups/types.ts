export interface ClassGroupRecord {
  id: string;
  educationalCenterId: string;
  userId?: string | null;
  name: string;
  code: string;
  createdAt?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
}

export interface CreateClassGroupPayload {
  educationalCenterId: string;
  userId?: string | null;
  name: string;
  code: string;
}

export interface ClassGroupStudentImportIssue {
  rowNumber: number;
  firstName?: string | null;
  lastName?: string | null;
  fileNumber?: string | null;
  message: string;
}

export interface ClassGroupStudentImportResult {
  classGroupId: string;
  educationalCenterId: string;
  groupName: string;
  totalRows: number;
  processedRows: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  issues: ClassGroupStudentImportIssue[];
}
