export interface StudentRecord {
  id: string;
  classGroupId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  fileNumber: string;
  imageUrl?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  deletedAt?: string | null;
}

export interface ListStudentsParams {
  institutionId?: string | null;
  classGroupId?: string | null;
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: "asc" | "desc";
}
