import { describe, expect, it } from "vitest";
import {
  canAccessOwnedHomeResources,
  canReadFeature,
  canReadFeatureOrOwnedHome,
} from "@/features/auth/permission-contract";

describe("permission contract", () => {
  it("matches explicit feature permissions without role inference", () => {
    const user = { roles: ["researcher"], permissions: ["game_data:read"] };
    expect(canReadFeature(user, "game_data")).toBe(true);
    expect(canReadFeature(user, "ble_device")).toBe(false);
  });

  it("recognizes mobile within hybrid user types", () => {
    const user = { roles: ["teacher"], permissions: [], userType: "web|mobile" };
    expect(canAccessOwnedHomeResources(user)).toBe(true);
    expect(canReadFeatureOrOwnedHome(user, "game_data")).toBe(true);
  });

  it("keeps non-owner sessions closed when permission is absent", () => {
    const user = { roles: ["teacher"], permissions: [], userType: "web" };
    expect(canAccessOwnedHomeResources(user)).toBe(false);
    expect(canReadFeatureOrOwnedHome(user, "ble_device")).toBe(false);
  });

  it("accepts explicit any-scope capability keys", () => {
    const user = { roles: [], permissions: ["student:read:any"] };
    expect(canReadFeature(user, "student")).toBe(true);
  });
});
