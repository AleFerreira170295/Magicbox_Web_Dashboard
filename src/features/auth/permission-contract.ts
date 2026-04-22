const ACL_READ_KEYS = ["access_control:read", "access-control:read"] as const;
const FEATURE_READ_KEYS = ["feature:read", "feature:read:any"] as const;

type PermissionContractUser = {
  roles?: string[];
  permissions?: string[];
} | null | undefined;

function hasRole(user: PermissionContractUser, role: string) {
  return Boolean(user?.roles?.includes(role));
}

export function hasAnyUserPermission(
  user: PermissionContractUser,
  ...keys: readonly string[]
) {
  const granted = new Set(user?.permissions || []);
  return keys.some((key) => granted.has(key));
}

export function isAdminSession(user: PermissionContractUser) {
  return hasRole(user, "admin");
}

export function isInstitutionAdminSession(user: PermissionContractUser) {
  return hasRole(user, "institution-admin");
}

export function canAccessPermissionsModule(user: PermissionContractUser) {
  return isAdminSession(user) || isInstitutionAdminSession(user);
}

export function canReadAclContract(user: PermissionContractUser) {
  return isAdminSession(user) || hasAnyUserPermission(user, ...ACL_READ_KEYS);
}

export function canReadFeatureContract(user: PermissionContractUser) {
  return isAdminSession(user) || hasAnyUserPermission(user, ...FEATURE_READ_KEYS);
}

export function canLoadPermissionsGovernance(user: PermissionContractUser) {
  return canReadAclContract(user) && canReadFeatureContract(user);
}

export function hasInstitutionAdminPermissionsContractGap(user: PermissionContractUser) {
  return isInstitutionAdminSession(user) && !canLoadPermissionsGovernance(user);
}
