import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SyncNavigation } from "@/features/syncs/sync-navigation";

const useAuthMock = vi.fn();
const usePathnameMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

vi.mock("@/features/auth/auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/features/i18n/i18n-context", () => ({
  useLanguage: () => ({ language: "es" }),
}));

describe("SyncNavigation", () => {
  afterEach(() => cleanup());

  it("links cable-capable users to the cable sync inside Sync", () => {
    usePathnameMock.mockReturnValue("/syncs/cable");
    useAuthMock.mockReturnValue({ user: { roles: ["teacher"] } });

    render(<SyncNavigation />);

    expect(screen.getByRole("link", { name: "Historial de syncs" })).toHaveAttribute("href", "/syncs");
    expect(screen.getByRole("link", { name: "Sync por cable" })).toHaveAttribute("href", "/syncs/cable");
  });

  it("keeps cable sync hidden for researcher-only access", () => {
    usePathnameMock.mockReturnValue("/syncs");
    useAuthMock.mockReturnValue({ user: { roles: ["researcher"] } });

    render(<SyncNavigation />);

    expect(screen.queryByRole("link", { name: "Sync por cable" })).not.toBeInTheDocument();
  });
});
