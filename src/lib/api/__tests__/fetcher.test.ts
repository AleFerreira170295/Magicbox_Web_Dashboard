import { afterEach, describe, expect, it, vi } from "vitest";
import { apiRequest, AUTH_SESSION_EXPIRED_EVENT, normalizeImageUrl, resolveApiBaseUrl } from "@/lib/api/fetcher";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveApiBaseUrl", () => {
  it("mantiene bases relativas sobre el origin actual", () => {
    expect(resolveApiBaseUrl("/api/v1.0", "http://56.126.159.35")).toBe("http://56.126.159.35/api/v1.0/");
  });

  it("corrige una base absoluta privada cuando la app corre en un host público", () => {
    expect(resolveApiBaseUrl("http://192.168.1.4:3000/api/v1.0", "http://56.126.159.35")).toBe("http://56.126.159.35/api/v1.0/");
  });

  it("respeta la base absoluta cuando sigue siendo coherente con el entorno actual", () => {
    expect(resolveApiBaseUrl("http://192.168.1.4:3000/api/v1.0", "http://192.168.1.99:3000")).toBe("http://192.168.1.4:3000/api/v1.0/");
  });

  it("convierte placeholders externos viejos a null para evitar requests rotos", () => {
    expect(normalizeImageUrl("https://magicbox.academy/default-avatar.png")).toBeNull();
    expect(normalizeImageUrl("https://magicbox.academy/default-student.png")).toBeNull();
    expect(normalizeImageUrl("https://cdn.example.com/avatar.png")).toBe("https://cdn.example.com/avatar.png");
  });
});

describe("apiRequest", () => {
  it("emite evento de sesión expirada cuando la API responde 401", async () => {
    const listener = vi.fn();
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, listener);

    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: { message: "Access token expired" } }), {
      status: 401,
      headers: { "content-type": "application/json" },
    }));

    await expect(apiRequest("/student/")).rejects.toThrow("Access token expired");
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, listener);
  });
});
