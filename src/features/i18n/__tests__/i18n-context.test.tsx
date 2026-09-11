import { act, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider, useLanguage } from "@/features/i18n/i18n-context";

function LanguageProbe() {
  const { language } = useLanguage();
  return <span>{language}</span>;
}

const storage = new Map<string, string>();

const localStorageMock = {
  clear: () => storage.clear(),
  getItem: (key: string) => storage.get(key) ?? null,
  removeItem: (key: string) => storage.delete(key),
  setItem: (key: string, value: string) => storage.set(key, value),
};

describe("LanguageProvider hydration snapshot", () => {
  beforeEach(() => {
    storage.clear();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: localStorageMock,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the first rendered language deterministic even when the browser saved another preference", () => {
    window.localStorage.setItem("magicbox-language", "en");

    const html = renderToString(
      <LanguageProvider>
        <LanguageProbe />
      </LanguageProvider>,
    );

    expect(html).toContain(">es<");
  });

  it("applies and preserves the saved browser preference after hydration", () => {
    vi.useFakeTimers();
    window.localStorage.setItem("magicbox-language", "en");

    render(
      <LanguageProvider>
        <LanguageProbe />
      </LanguageProvider>,
    );

    expect(screen.getByText("es")).toBeInTheDocument();
    expect(window.localStorage.getItem("magicbox-language")).toBe("en");

    act(() => vi.runAllTimers());

    expect(screen.getByText("en")).toBeInTheDocument();
    expect(window.localStorage.getItem("magicbox-language")).toBe("en");
  });
});
