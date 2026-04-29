export function buildInstitutionsOverviewHref({
  institutionId,
  groupId,
}: {
  institutionId?: string | null;
  groupId?: string | null;
}) {
  const params = new URLSearchParams();

  if (institutionId) params.set("institutionId", institutionId);
  if (groupId) params.set("groupId", groupId);

  const query = params.toString();
  return query ? `/institutions?${query}` : "/institutions";
}

export function buildInstitutionStudentDetailHref({
  institutionId,
  groupId,
  studentId,
}: {
  institutionId: string;
  groupId: string;
  studentId: string;
}) {
  const params = new URLSearchParams({ institutionId, groupId, studentId });
  return `/institutions/student?${params.toString()}`;
}
