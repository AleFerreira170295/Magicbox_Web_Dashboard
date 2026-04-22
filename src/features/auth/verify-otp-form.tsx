"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { forgotPassword, verifyOtpCode } from "@/features/auth/auth-api";
import { getErrorMessage } from "@/lib/utils";

const OTP_LENGTH = 6;

export function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [digits, setDigits] = useState<string[]>(Array.from({ length: OTP_LENGTH }, () => ""));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (!email) {
      router.replace("/auth/forgot-password");
    }
  }, [email, router]);

  const complete = digits.every((digit) => digit.trim().length === 1);

  function updateDigit(index: number, value: string) {
    const cleaned = value.replace(/\D/g, "").slice(0, 1);
    setDigits((current) => {
      const next = [...current];
      next[index] = cleaned;
      return next;
    });
    if (cleaned && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  async function submit() {
    if (!email || !complete || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verifyOtpCode(email, digits.join(""));
      router.push(`/auth/reset-password?email=${encodeURIComponent(email)}`);
    } catch (submitError) {
      setDigits(Array.from({ length: OTP_LENGTH }, () => ""));
      inputRefs.current[0]?.focus();
      setError(getErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    if (!email || busy) return;
    setBusy(true);
    setError(null);
    try {
      await forgotPassword(email);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-sky-100 bg-sky-50 px-5 py-4 text-sm leading-6 text-sky-900">
        Si no lo ves en tu bandeja, revisá spam. El código expira rápido.
      </div>

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Enviamos un código a:</p>
        <p className="font-medium text-foreground">{email || "tu correo"}</p>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(node) => {
              inputRefs.current[index] = node;
            }}
            value={digit}
            onChange={(event) => updateDigit(index, event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !digits[index] && index > 0) {
                inputRefs.current[index - 1]?.focus();
              }
            }}
            maxLength={1}
            inputMode="numeric"
            className="h-12 rounded-2xl border border-input bg-background text-center text-lg font-medium shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        ))}
      </div>

      <div className="space-y-3">
        <Button className="w-full" type="button" onClick={submit} disabled={!complete || busy}>
          {busy ? "Continuando..." : "Continuar"}
        </Button>
        <Button className="w-full" type="button" variant="outline" onClick={resendCode} disabled={busy}>
          Reenviar código
        </Button>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm">
        <Link href="/auth/login" className="font-medium text-primary hover:underline">
          Volver al login
        </Link>
        <Link href="/auth/forgot-password" className="font-medium text-primary hover:underline">
          Cambiar email
        </Link>
      </div>
    </div>
  );
}
