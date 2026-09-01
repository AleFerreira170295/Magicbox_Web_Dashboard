import { describe, expect, it } from "vitest";
import { resolveRoles } from "@/features/auth/role-resolver";

describe("resolveRoles", () => {
  it("normaliza alias comunes del backend sin caer al rol por defecto", () => {
    expect(resolveRoles({ role: "institution_admin" })).toEqual(["institution-admin"]);
    expect(resolveRoles({ roles: ["super_admin", "government_viewer"] })).toEqual(["admin", "government-viewer"]);
  });

  it("deduce roles de bajo privilegio desde user_type cuando no hay rol explicito", () => {
    expect(resolveRoles({ user_type: "MOBILE_USER" })).toEqual(["family"]);
    expect(resolveRoles({ user_type: "WEB_USER" })).toEqual(["teacher"]);
  });
});
