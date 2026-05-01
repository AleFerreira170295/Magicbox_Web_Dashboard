"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { register as registerAccount } from "@/features/auth/auth-api";
import { useLanguage } from "@/features/i18n/i18n-context";
import {
  validateEmail,
  validateName,
  validatePasswordConfirmation,
  validateSecureBackendPassword,
  validatePhoneNumberForCountry,
} from "@/features/auth/validators";
import { getErrorMessage } from "@/lib/utils";

const phoneCountries = [
  { isoCode: "UY", flag: "🇺🇾", name: "Uruguay", dialCode: "+598", minDigits: 8, maxDigits: 9 },
  { isoCode: "AR", flag: "🇦🇷", name: "Argentina", dialCode: "+54", minDigits: 8, maxDigits: 11 },
  { isoCode: "BO", flag: "🇧🇴", name: "Bolivia", dialCode: "+591", minDigits: 8, maxDigits: 8 },
  { isoCode: "BR", flag: "🇧🇷", name: "Brasil", dialCode: "+55", minDigits: 10, maxDigits: 11 },
  { isoCode: "CA", flag: "🇨🇦", name: "Canadá", dialCode: "+1", minDigits: 10, maxDigits: 10 },
  { isoCode: "CL", flag: "🇨🇱", name: "Chile", dialCode: "+56", minDigits: 8, maxDigits: 9 },
  { isoCode: "CO", flag: "🇨🇴", name: "Colombia", dialCode: "+57", minDigits: 10, maxDigits: 10 },
  { isoCode: "CR", flag: "🇨🇷", name: "Costa Rica", dialCode: "+506", minDigits: 8, maxDigits: 8 },
  { isoCode: "CU", flag: "🇨🇺", name: "Cuba", dialCode: "+53", minDigits: 8, maxDigits: 8 },
  { isoCode: "DO", flag: "🇩🇴", name: "República Dominicana", dialCode: "+1", minDigits: 10, maxDigits: 10 },
  { isoCode: "EC", flag: "🇪🇨", name: "Ecuador", dialCode: "+593", minDigits: 8, maxDigits: 9 },
  { isoCode: "SV", flag: "🇸🇻", name: "El Salvador", dialCode: "+503", minDigits: 8, maxDigits: 8 },
  { isoCode: "ES", flag: "🇪🇸", name: "España", dialCode: "+34", minDigits: 9, maxDigits: 9 },
  { isoCode: "US", flag: "🇺🇸", name: "Estados Unidos", dialCode: "+1", minDigits: 10, maxDigits: 10 },
  { isoCode: "GT", flag: "🇬🇹", name: "Guatemala", dialCode: "+502", minDigits: 8, maxDigits: 8 },
  { isoCode: "HN", flag: "🇭🇳", name: "Honduras", dialCode: "+504", minDigits: 8, maxDigits: 8 },
  { isoCode: "MX", flag: "🇲🇽", name: "México", dialCode: "+52", minDigits: 10, maxDigits: 10 },
  { isoCode: "NI", flag: "🇳🇮", name: "Nicaragua", dialCode: "+505", minDigits: 8, maxDigits: 8 },
  { isoCode: "PA", flag: "🇵🇦", name: "Panamá", dialCode: "+507", minDigits: 8, maxDigits: 8 },
  { isoCode: "PY", flag: "🇵🇾", name: "Paraguay", dialCode: "+595", minDigits: 9, maxDigits: 10 },
  { isoCode: "PE", flag: "🇵🇪", name: "Perú", dialCode: "+51", minDigits: 9, maxDigits: 9 },
  { isoCode: "PR", flag: "🇵🇷", name: "Puerto Rico", dialCode: "+1", minDigits: 10, maxDigits: 10 },
  { isoCode: "VE", flag: "🇻🇪", name: "Venezuela", dialCode: "+58", minDigits: 10, maxDigits: 10 },
] as const;

type RegisterFormValues = {
  firstName: string;
  lastName: string;
  email: string;
  countryCode: (typeof phoneCountries)[number]["isoCode"];
  phoneNumber: string;
  password: string;
  confirmPassword: string;
};

export function RegisterForm() {
  const router = useRouter();
  const { t } = useLanguage();
  const validation = t.auth.validation;
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const form = useForm<RegisterFormValues>({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      countryCode: "UY",
      phoneNumber: "",
      password: "",
      confirmPassword: "",
    },
  });

  const selectedCountryCode = form.watch("countryCode");
  const selectedCountry = phoneCountries.find((country) => country.isoCode === selectedCountryCode) ?? phoneCountries[0];

  async function onSubmit(values: RegisterFormValues) {
    setError(null);
    setDone(false);
    try {
      const country = phoneCountries.find((item) => item.isoCode === values.countryCode) ?? phoneCountries[0];
      const digits = values.phoneNumber.replace(/\D/g, "");
      await registerAccount({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        password: values.password,
        confirmPassword: values.confirmPassword,
        phoneNumber: `${country.dialCode}${digits}`,
      });
      setDone(true);
      form.reset({
        firstName: "",
        lastName: "",
        email: "",
        countryCode: "UY",
        phoneNumber: "",
        password: "",
        confirmPassword: "",
      });
    } catch (submitError) {
      setError(getErrorMessage(submitError));
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm leading-6 text-sky-900">
        {t.auth.registerForm.autonomousNotice}
      </div>

      {done ? (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-800">
          {t.auth.registerForm.success}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>
      ) : null}

      <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">{t.auth.registerForm.firstName}</Label>
            <Input id="firstName" autoComplete="given-name" {...form.register("firstName", { validate: (value) => validateName(value, validation) })} />
            {form.formState.errors.firstName ? <p className="text-sm text-destructive">{form.formState.errors.firstName.message}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">{t.auth.registerForm.lastName}</Label>
            <Input id="lastName" autoComplete="family-name" {...form.register("lastName", { validate: (value) => validateName(value, validation) })} />
            {form.formState.errors.lastName ? <p className="text-sm text-destructive">{form.formState.errors.lastName.message}</p> : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t.auth.registerForm.email}</Label>
          <Input id="email" type="email" autoComplete="email" {...form.register("email", { validate: (value) => validateEmail(value, validation) })} />
          {form.formState.errors.email ? <p className="text-sm text-destructive">{form.formState.errors.email.message}</p> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-[132px_minmax(0,1fr)]">
          <div className="space-y-2">
            <Label htmlFor="countryCode">{t.auth.registerForm.country}</Label>
            <select
              id="countryCode"
              className="flex h-11 w-full rounded-2xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              {...form.register("countryCode")}
            >
              {phoneCountries.map((country) => (
                <option key={country.isoCode} value={country.isoCode}>
                  {country.flag} {country.dialCode}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">{t.auth.registerForm.phone}</Label>
            <Input
              id="phoneNumber"
              autoComplete="tel"
              inputMode="tel"
              {...form.register("phoneNumber", {
                validate: (value) =>
                  validatePhoneNumberForCountry(
                    value,
                    selectedCountry.minDigits,
                    selectedCountry.maxDigits,
                    selectedCountry.name,
                    validation,
                  ),
              })}
            />
            <p className="text-xs text-muted-foreground">{t.auth.registerForm.phoneHelp}</p>
            {form.formState.errors.phoneNumber ? <p className="text-sm text-destructive">{form.formState.errors.phoneNumber.message}</p> : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">{t.auth.registerForm.password}</Label>
          <Input id="password" type="password" autoComplete="new-password" {...form.register("password", { validate: (value) => validateSecureBackendPassword(value, validation) })} />
          {form.formState.errors.password ? <p className="text-sm text-destructive">{form.formState.errors.password.message}</p> : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t.auth.registerForm.confirmPassword}</Label>
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...form.register("confirmPassword", {
              validate: (value) => validatePasswordConfirmation(value, form.getValues("password"), validation),
            })}
          />
          {form.formState.errors.confirmPassword ? <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p> : null}
        </div>

        <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t.auth.registerForm.submitting : t.auth.registerForm.submit}
        </Button>
      </form>

      <div className="flex items-center justify-between gap-3 text-sm">
        <Link href="/login" className="font-medium text-primary hover:underline">
          {t.auth.registerForm.alreadyHaveAccount}
        </Link>
        <button type="button" className="font-medium text-primary hover:underline" onClick={() => router.push("/login")}>
          {t.auth.registerForm.goToLogin}
        </button>
      </div>
    </div>
  );
}
