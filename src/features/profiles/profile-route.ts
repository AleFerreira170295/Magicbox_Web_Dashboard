export function buildProfilesOverviewHref({
  institutionId,
}: {
  institutionId?: string | null;
}) {
  const params = new URLSearchParams();

  if (institutionId) params.set("institutionId", institutionId);

  const query = params.toString();
  return query ? `/profiles?${query}` : "/profiles";
}

export function buildProfileDetailHref({
  kind,
  entityId,
  institutionId,
  classGroupId,
}: {
  kind: "home-profile" | "student";
  entityId: string;
  institutionId?: string | null;
  classGroupId?: string | null;
}) {
  const params = new URLSearchParams({ kind, entityId });

  if (institutionId) params.set("institutionId", institutionId);
  if (classGroupId) params.set("classGroupId", classGroupId);

  return `/profiles/detail?${params.toString()}`;
}
