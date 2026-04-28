import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeTutorial, hasCompletedTutorial } from "@/features/tutorial/storage";
import { getWebTutorialSteps, WebOnboardingTour } from "@/features/tutorial/web-onboarding-tour";
import type { AuthUser } from "@/features/auth/types";

const storage = new Map<string, string>();

const localStorageMock = {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
  removeItem: (key: string) => {
    storage.delete(key);
  },
  clear: () => {
    storage.clear();
  },
};

const teacherUser: AuthUser = {
  id: "teacher-1",
  identityId: "identity-1",
  email: "teacher@example.com",
  firstName: "Teo",
  lastName: "Teacher",
  fullName: "Teo Teacher",
  imageUrl: null,
  userType: "teacher",
  educationalCenterId: null,
  roles: ["teacher"],
  permissions: ["game_data:read"],
  raw: {},
};

beforeEach(() => {
  storage.clear();
  Object.defineProperty(window, "localStorage", {
    value: localStorageMock,
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
});

describe("tutorial storage", () => {
  it("persists completion per user in localStorage", () => {
    expect(hasCompletedTutorial("teacher-1")).toBe(false);

    completeTutorial("teacher-1");

    expect(hasCompletedTutorial("teacher-1")).toBe(true);
    expect(hasCompletedTutorial("teacher-2")).toBe(false);
  });
});

describe("web onboarding tutorial", () => {
  it("builds teacher-focused steps", () => {
    const steps = getWebTutorialSteps(teacherUser);

    expect(steps).toHaveLength(4);
    expect(steps[0]?.title).toMatch(/bienvenido/i);
    expect(steps[1]?.href).toBe("/games");
    expect(steps[2]?.href).toBe("/devices");
    expect(steps[3]?.href).toBe("/syncs");
  });

  it("lets the user advance and complete the tutorial", () => {
    const onSkip = vi.fn();
    const onComplete = vi.fn();

    render(<WebOnboardingTour user={teacherUser} onSkip={onSkip} onComplete={onComplete} />);

    expect(screen.getByText(/bienvenido, teo/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    expect(screen.getByRole("heading", { name: /^Partidas$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    fireEvent.click(screen.getByRole("button", { name: /empezar a usar magicbox/i }));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onSkip).not.toHaveBeenCalled();
  });

  it("allows dismissing the tutorial immediately", () => {
    const onSkip = vi.fn();

    render(<WebOnboardingTour user={teacherUser} onSkip={onSkip} onComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /cerrar tutorial/i }));

    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
