"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, KeyRound, Save, ShieldCheck, UserRound } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNotifications } from "@/components/ui/notifications";
import { Skeleton } from "@/components/ui/skeleton";
import {
  changeAccountPassword,
  getAccountProfile,
  updateAccountProfile,
  uploadAccountAvatar,
  type AccountProfile,
} from "@/features/account-profile/api";
import { useAuth } from "@/features/auth/auth-context";
import { useLanguage } from "@/features/i18n/i18n-context";
import type { UserAddress } from "@/features/users/types";
import { getErrorMessage } from "@/lib/utils";

type ProfileFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  imageUrl: string;
  addressFirstLine: string;
  addressSecondLine: string;
  countryCode: string;
  city: string;
  state: string;
  postalCode: string;
};

type PasswordFormState = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const emptyPasswordForm: PasswordFormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function formFromProfile(profile: AccountProfile): ProfileFormState {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    email: profile.email,
    phoneNumber: profile.phoneNumber,
    imageUrl: profile.imageUrl || "",
    addressFirstLine: profile.address?.addressFirstLine || "",
    addressSecondLine: profile.address?.addressSecondLine || "",
    countryCode: profile.address?.countryCode || "",
    city: profile.address?.city || "",
    state: profile.address?.state || "",
    postalCode: profile.address?.postalCode || "",
  };
}

function buildAddress(form: ProfileFormState): UserAddress | null {
  const touched = [
    form.addressFirstLine,
    form.addressSecondLine,
    form.countryCode,
    form.city,
    form.state,
    form.postalCode,
  ].some((value) => value.trim().length > 0);

  if (!touched) return null;

  return {
    addressFirstLine: form.addressFirstLine.trim(),
    addressSecondLine: form.addressSecondLine.trim() || null,
    countryCode: form.countryCode.trim().toUpperCase(),
    city: form.city.trim(),
    state: form.state.trim() || null,
    postalCode: form.postalCode.trim() || null,
  };
}

function initials(profile: AccountProfile | null) {
  const first = profile?.firstName?.slice(0, 1) || "";
  const last = profile?.lastName?.slice(0, 1) || "";
  return `${first}${last}`.toUpperCase() || "MB";
}

export function AccountProfileScreen() {
  const { tokens, user, refreshProfile } = useAuth();
  const { language } = useLanguage();
  const { notify } = useNotifications();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ProfileFormState | null>(null);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(emptyPasswordForm);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const token = tokens?.accessToken;
  const profileQuery = useQuery({
    queryKey: ["account-profile", token],
    queryFn: async () => {
      const nextProfile = await getAccountProfile(token as string);
      setForm((current) => current || formFromProfile(nextProfile));
      return nextProfile;
    },
    enabled: Boolean(token),
  });

  const profile = profileQuery.data || null;
  const title = language === "en" ? "My Profile" : language === "pt" ? "Meu perfil" : "Mi perfil";

  const displayName = useMemo(() => {
    if (!profile) return user?.fullName || "MagicBox";
    return [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email;
  }, [profile, user?.fullName]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!token || !form) throw new Error("Sesión no disponible.");
      if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim() || !form.phoneNumber.trim()) {
        throw new Error("Completá nombre, apellido, email y teléfono.");
      }

      const addressTouched = Boolean(buildAddress(form));
      if (addressTouched && (!form.addressFirstLine.trim() || !form.city.trim() || !form.countryCode.trim())) {
        throw new Error("Si cargás dirección, completá calle, ciudad y país.");
      }

      let imageUrl = form.imageUrl || null;
      if (avatarFile) {
        imageUrl = await uploadAccountAvatar(token, avatarFile);
      }

      return updateAccountProfile(token, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        phoneNumber: form.phoneNumber.trim(),
        imageUrl,
        address: buildAddress(form),
      });
    },
    onSuccess: async (updatedProfile) => {
      setAvatarFile(null);
      setForm(formFromProfile(updatedProfile));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["account-profile"] }),
        refreshProfile(),
      ]);
      notify({ tone: "success", message: "Perfil actualizado correctamente." });
    },
    onError: (error) => {
      notify({ tone: "error", message: getErrorMessage(error) });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Sesión no disponible.");
      if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
        throw new Error("Completá los tres campos de contraseña.");
      }
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        throw new Error("La confirmación no coincide con la nueva contraseña.");
      }
      await changeAccountPassword(token, passwordForm);
    },
    onSuccess: () => {
      setPasswordForm(emptyPasswordForm);
      notify({ tone: "success", message: "Contraseña actualizada correctamente." });
    },
    onError: (error) => {
      notify({ tone: "error", message: getErrorMessage(error) });
    },
  });

  function updateField<K extends keyof ProfileFormState>(field: K, value: ProfileFormState[K]) {
    setForm((current) => current ? { ...current, [field]: value } : current);
  }

  const saving = updateMutation.isPending || passwordMutation.isPending;

  return (
    <div className="grid gap-8">
      <SectionHeader
        eyebrow="Cuenta"
        title={title}
        description="Ajustá tus datos personales, foto de perfil y contraseña sin cambiar roles, permisos ni alcance institucional."
      />

      {profileQuery.isLoading || !form ? (
        <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <Skeleton className="h-80 rounded-[24px]" />
          <Skeleton className="h-96 rounded-[24px]" />
        </div>
      ) : profileQuery.error ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">{getErrorMessage(profileQuery.error)}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserRound className="size-5 text-primary" />
                  Identidad
                </CardTitle>
                <CardDescription>Vista rápida de tu cuenta activa.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center gap-4">
                  <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white text-xl font-semibold text-primary">
                    {form.imageUrl ? <img src={form.imageUrl} alt={displayName} className="h-full w-full object-cover" /> : initials(profile)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-foreground">{displayName}</p>
                    <p className="truncate text-sm text-muted-foreground">{profile?.email}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(profile?.roles || []).map((role) => <Badge key={role} variant="secondary">{role}</Badge>)}
                      {profile?.userType ? <Badge variant="outline">{profile.userType}</Badge> : null}
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                  Roles, permisos, tipo de usuario e institución se administran desde el módulo Usuarios según alcance de administración.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="size-5 text-primary" />
                  Contraseña
                </CardTitle>
                <CardDescription>Actualizá tu clave usando tu contraseña actual.</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); passwordMutation.mutate(); }}>
                  <div className="grid gap-2">
                    <Label htmlFor="currentPassword">Contraseña actual</Label>
                    <Input id="currentPassword" type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="newPassword">Nueva contraseña</Label>
                    <Input id="newPassword" type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                    <Input id="confirmPassword" type="password" value={passwordForm.confirmPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))} />
                  </div>
                  <Button type="submit" disabled={saving}>
                    <ShieldCheck className="size-4" />
                    Actualizar contraseña
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="size-5 text-primary" />
                Datos personales
              </CardTitle>
              <CardDescription>Estos cambios actualizan tu cuenta sin modificar permisos ni alcance.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-5" onSubmit={(event) => { event.preventDefault(); updateMutation.mutate(); }}>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="firstName">Nombre</Label>
                    <Input id="firstName" value={form.firstName} onChange={(event) => updateField("firstName", event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lastName">Apellido</Label>
                    <Input id="lastName" value={form.lastName} onChange={(event) => updateField("lastName", event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phoneNumber">Teléfono</Label>
                    <Input id="phoneNumber" value={form.phoneNumber} onChange={(event) => updateField("phoneNumber", event.target.value)} />
                  </div>
                </div>

                <ImageUploadField
                  value={form.imageUrl}
                  file={avatarFile}
                  onFileChange={setAvatarFile}
                  onRemoveCurrent={() => {
                    updateField("imageUrl", "");
                    setAvatarFile(null);
                  }}
                  label="Foto de perfil"
                  description="Se guarda junto con los datos personales al confirmar el formulario."
                  disabled={saving}
                />

                <div className="rounded-2xl border border-border/70 bg-background/60 p-4">
                  <p className="text-sm font-medium text-foreground">Dirección</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2 md:col-span-2">
                      <Label htmlFor="addressFirstLine">Dirección</Label>
                      <Input id="addressFirstLine" value={form.addressFirstLine} onChange={(event) => updateField("addressFirstLine", event.target.value)} />
                    </div>
                    <div className="grid gap-2 md:col-span-2">
                      <Label htmlFor="addressSecondLine">Apartamento / referencia</Label>
                      <Input id="addressSecondLine" value={form.addressSecondLine} onChange={(event) => updateField("addressSecondLine", event.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="countryCode">País</Label>
                      <Input id="countryCode" value={form.countryCode} onChange={(event) => updateField("countryCode", event.target.value)} placeholder="UY" />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="city">Ciudad</Label>
                      <Input id="city" value={form.city} onChange={(event) => updateField("city", event.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="state">Departamento / estado</Label>
                      <Input id="state" value={form.state} onChange={(event) => updateField("state", event.target.value)} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="postalCode">Código postal</Label>
                      <Input id="postalCode" value={form.postalCode} onChange={(event) => updateField("postalCode", event.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-3">
                  <Button type="button" variant="outline" disabled={saving || !profile} onClick={() => profile && setForm(formFromProfile(profile))}>
                    Descartar
                  </Button>
                  <Button type="submit" disabled={saving}>
                    <Save className="size-4" />
                    Guardar perfil
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
