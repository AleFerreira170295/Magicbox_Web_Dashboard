"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Building2, Clock3, Router, UserRound, Wifi } from "lucide-react";
import { DeleteRecordDialog } from "@/components/delete-record-dialog";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ListPaginationControls, useListPagination } from "@/components/ui/list-pagination-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { deleteDevice, useDevices } from "@/features/devices/api";
import { DeviceAvatar, DeviceEditorPanel, buildDeviceRelationHref, devicesMessages, locationLabel, scopeBadge, statusLabel } from "@/features/devices/devices-table";
import { buildDeviceDetailHref, buildDevicesOverviewHref, type DevicesOverviewRouteState } from "@/features/devices/device-route";
import type { DeviceRecord } from "@/features/devices/types";
import { useGames } from "@/features/games/api";
import { useLanguage } from "@/features/i18n/i18n-context";
import { useInstitutions } from "@/features/institutions/api";
import { useSyncSessions } from "@/features/syncs/api";
import { useUsers } from "@/features/users/api";
import { cn, formatDateTime, getErrorMessage } from "@/lib/utils";

type DeviceRow = DeviceRecord & {
  accessRelation: string;
  isOwnedByCurrentUser: boolean;
  isInstitutionVisible: boolean;
  hasUnresolvedAssociation: boolean;
  relatedSyncCount: number;
  relatedGameCount: number;
  lastSyncedAt: string | null;
  hasOperationalActivity: boolean;
  reviewReasons: string[];
  isReadyForClassroom: boolean;
};

export function DeviceDetailPage({
  deviceRecordId,
  overviewState,
}: {
  deviceRecordId?: string | null;
  overviewState: DevicesOverviewRouteState;
}) {
  const { language } = useLanguage();
  const t = devicesMessages[language];
  const { tokens, user: currentUser } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const devicesQuery = useDevices(tokens?.accessToken);
  const institutionsQuery = useInstitutions(tokens?.accessToken);
  const usersQuery = useUsers(tokens?.accessToken);
  const gamesQuery = useGames(tokens?.accessToken);
  const syncsQuery = useSyncSessions(tokens?.accessToken);

  const devices = useMemo(() => devicesQuery.data?.data ?? [], [devicesQuery.data?.data]);
  const institutions = useMemo(() => institutionsQuery.data?.data ?? [], [institutionsQuery.data?.data]);
  const users = useMemo(() => usersQuery.data?.data ?? [], [usersQuery.data?.data]);
  const games = useMemo(() => gamesQuery.data?.data ?? [], [gamesQuery.data?.data]);
  const syncs = useMemo(() => syncsQuery.data?.data ?? [], [syncsQuery.data?.data]);

  const currentPermissionKeys = useMemo(() => new Set(currentUser?.permissions || []), [currentUser?.permissions]);
  const hasGlobalAdminRole = currentUser?.roles.includes("admin") || false;
  const hasResolvedCapabilities = hasGlobalAdminRole || currentPermissionKeys.size > 0;
  const hasAnyPermission = (...keys: string[]) => {
    if (hasGlobalAdminRole) return true;
    if (!hasResolvedCapabilities) return true;
    return keys.some((key) => currentPermissionKeys.has(key));
  };

  const canUpdateDevices = hasAnyPermission("ble_device:update", "ble-device:update");
  const canDeleteDevices = hasAnyPermission("ble_device:delete", "ble-device:delete");
  const currentUserEmail = (currentUser?.email || "").trim().toLowerCase();
  const isTeacherView = currentUser?.roles.includes("teacher") || false;
  const isDirectorView = currentUser?.roles.includes("director") || false;
  const scopedInstitutionId = institutions.length === 1 ? institutions[0]?.id || null : null;

  const deviceRows = useMemo<DeviceRow[]>(() => {
    return devices.map((device) => {
      const relatedSyncs = syncs.filter(
        (sync) => sync.bleDeviceId === device.id || (sync.deviceId && sync.deviceId === device.deviceId),
      );
      const relatedGames = games.filter((game) => game.bleDeviceId === device.id);
      const isOwnedByCurrentUser = Boolean(
        (currentUser?.id && device.ownerUserId === currentUser.id)
        || (currentUserEmail && (device.ownerUserEmail || "").trim().toLowerCase() === currentUserEmail),
      );
      const isInstitutionVisible = Boolean(
        device.educationalCenterId
          && currentUser?.educationalCenterId
          && device.educationalCenterId === currentUser.educationalCenterId,
      );

      const accessRelation = isOwnedByCurrentUser
        ? t.filters.accessOwned.toLowerCase()
        : isInstitutionVisible
          ? t.filters.accessInstitution.toLowerCase()
          : device.ownerUserId || device.ownerUserEmail
            ? t.filters.accessShared.toLowerCase()
            : t.filters.accessUnresolved.toLowerCase();

      const lastSyncedAt = relatedSyncs
        .map((sync) => sync.syncedAt || sync.receivedAt || sync.startedAt || null)
        .filter(Boolean)
        .sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime())[0] || null;

      const hasUnresolvedAssociation = !device.ownerUserId && !device.ownerUserEmail && device.assignmentScope === "institution";
      const hasOperationalActivity = relatedSyncs.length > 0 || relatedGames.length > 0;
      const reviewReasons = [
        !device.ownerUserId && !device.ownerUserEmail ? (language === "en" ? "no clear owner" : language === "pt" ? "sem responsável claro" : "sin responsable claro") : null,
        !device.status ? (language === "en" ? "no operational status" : language === "pt" ? "sem status operacional" : "sin status operativo") : null,
        Object.keys(device.deviceMetadata || {}).length === 0 ? (language === "en" ? "no visible metadata" : language === "pt" ? "sem metadata visível" : "sin metadata visible") : null,
        relatedSyncs.length === 0 ? t.detail.noVisibleSync : null,
      ].filter((value): value is string => Boolean(value));

      return {
        ...device,
        accessRelation,
        isOwnedByCurrentUser,
        isInstitutionVisible,
        hasUnresolvedAssociation,
        relatedSyncCount: relatedSyncs.length,
        relatedGameCount: relatedGames.length,
        lastSyncedAt,
        hasOperationalActivity,
        reviewReasons,
        isReadyForClassroom: Boolean(device.status && !hasUnresolvedAssociation && hasOperationalActivity),
      };
    });
  }, [currentUser?.educationalCenterId, currentUser?.id, currentUserEmail, devices, games, language, syncs, t.detail.noVisibleSync, t.filters.accessInstitution, t.filters.accessOwned, t.filters.accessShared, t.filters.accessUnresolved]);

  const selectedDevice = useMemo(() => {
    if (!deviceRecordId) return null;
    return deviceRows.find((device) => device.id === deviceRecordId) ?? null;
  }, [deviceRecordId, deviceRows]);

  const siblingDevices = useMemo(() => {
    if (!selectedDevice) return [];
    return deviceRows.filter((device) => {
      if (device.id === selectedDevice.id) return false;
      if (selectedDevice.ownerUserId && device.ownerUserId === selectedDevice.ownerUserId) return true;
      if (selectedDevice.educationalCenterId && device.educationalCenterId === selectedDevice.educationalCenterId) return true;
      return false;
    });
  }, [deviceRows, selectedDevice]);

  const scopeDevices = useMemo(() => {
    if (!selectedDevice) return [];
    return deviceRows.filter((device) => device.id !== selectedDevice.id && device.assignmentScope === selectedDevice.assignmentScope);
  }, [deviceRows, selectedDevice]);

  const siblingPagination = useListPagination(siblingDevices, 10, 1);
  const scopePagination = useListPagination(scopeDevices, 10, 1);
  const backHref = buildDevicesOverviewHref(overviewState);
  const isLoading = devicesQuery.isLoading || institutionsQuery.isLoading || usersQuery.isLoading || gamesQuery.isLoading || syncsQuery.isLoading;
  const hasFatalError = devicesQuery.error || institutionsQuery.error || usersQuery.error || gamesQuery.error || syncsQuery.error;

  const deleteDeviceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDevice || !tokens?.accessToken) throw new Error(t.editor.noSelectedDevice);
      return deleteDevice(tokens.accessToken, selectedDevice.id);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["devices"] }),
        queryClient.invalidateQueries({ queryKey: ["games"] }),
        queryClient.invalidateQueries({ queryKey: ["sync-sessions"] }),
      ]);
      setIsDeleteDialogOpen(false);
      router.push(backHref);
    },
  });

  async function handleDeleteCurrentDevice() {
    if (!canDeleteDevices) return;
    await deleteDeviceMutation.mutateAsync();
  }

  const detailTitle = selectedDevice?.name || (language === "en" ? "Device detail" : language === "pt" ? "Detalhe do dispositivo" : "Detalle del dispositivo");
  const detailDescription = selectedDevice
    ? language === "en"
      ? "Dedicated page to review operational context, edit core data, and move through related devices without depending on the side panel."
      : language === "pt"
        ? "Página dedicada para revisar o contexto operacional, editar os dados principais e navegar entre dispositivos relacionados sem depender do painel lateral."
        : "Página dedicada para revisar el contexto operativo, editar los datos principales y navegar entre dispositivos relacionados sin depender del panel lateral."
    : language === "en"
      ? "Open the detail from Devices to keep context, editing, and related navigation on one screen."
      : language === "pt"
        ? "Abra o detalhe desde Dispositivos para manter contexto, edição e navegação relacionada em uma única tela."
        : "Abrí el detalle desde Dispositivos para mantener contexto, edición y navegación relacionada en una sola pantalla.";

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={language === "en" ? "Devices · detail" : language === "pt" ? "Dispositivos · detalhe" : "Dispositivos · detalle"}
        title={detailTitle}
        description={detailDescription}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {selectedDevice && canDeleteDevices ? (
              <button
                type="button"
                onClick={() => setIsDeleteDialogOpen(true)}
                className={cn(buttonVariants({ variant: "destructive" }))}
                disabled={deleteDeviceMutation.isPending}
              >
                {t.detail.deleteDevice}
              </button>
            ) : null}
            <Link href={backHref} className={cn(buttonVariants({ variant: "outline" }))}>
              <ArrowLeft className="size-4" />
              {language === "en" ? "Back to devices" : language === "pt" ? "Voltar para dispositivos" : "Volver a dispositivos"}
            </Link>
          </div>
        }
      />

      {!deviceRecordId ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {language === "en"
              ? "Missing context for this device. Go back to Devices and open it again from the list."
              : language === "pt"
                ? "Falta contexto para este dispositivo. Volte a Dispositivos e abra-o novamente a partir da lista."
                : "Falta contexto para este dispositivo. Volvé a Dispositivos y abrilo de nuevo desde el listado."}
          </CardContent>
        </Card>
      ) : hasFatalError ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="p-6 text-sm text-destructive">
            {language === "en" ? "Couldn't prepare the device view." : language === "pt" ? "Não consegui preparar a visualização do dispositivo." : "No pude preparar la vista del dispositivo."} {getErrorMessage(hasFatalError)}
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid gap-4">
          <Skeleton className="h-40 rounded-[28px]" />
          <Skeleton className="h-80 rounded-[28px]" />
        </div>
      ) : !selectedDevice ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="p-6 text-sm text-muted-foreground">
            {language === "en"
              ? "I couldn't find the requested device with the current permissions."
              : language === "pt"
                ? "Não encontrei o dispositivo solicitado com as permissões atuais."
                : "No encontré el dispositivo solicitado con los permisos actuales."}
          </CardContent>
        </Card>
      ) : (
        <>
          {deleteDeviceMutation.error ? (
            <Card className="border-destructive/30 bg-destructive/5 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
              <CardContent className="p-6 text-sm text-destructive">
                {t.detail.deleteError(getErrorMessage(deleteDeviceMutation.error))}
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <DeviceAvatar device={selectedDevice} className="size-16" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-2xl font-semibold tracking-[-0.03em] text-foreground">{selectedDevice.name}</h2>
                      <Badge variant="outline">{selectedDevice.deviceId}</Badge>
                      <Badge variant={selectedDevice.hasUnresolvedAssociation ? "warning" : "success"}>
                        {selectedDevice.hasUnresolvedAssociation
                          ? (language === "en" ? "review association" : language === "pt" ? "revisar associação" : "revisar asociación")
                          : (language === "en" ? "association resolved" : language === "pt" ? "associação resolvida" : "asociación resuelta")}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {scopeBadge(selectedDevice)}
                      <Badge variant="outline"><Building2 className="mr-1 size-3" />{locationLabel(selectedDevice)}</Badge>
                      <Badge variant="outline"><UserRound className="mr-1 size-3" />{selectedDevice.ownerUserName || selectedDevice.ownerUserEmail || t.detail.noOwner}</Badge>
                      <Badge variant="outline">{statusLabel(selectedDevice.status, t.editor.noStatus)}</Badge>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-muted-foreground">
                      {language === "en"
                        ? "This screen keeps the device in the foreground and brings editing plus related navigation together, so you no longer need to scroll down inside the fleet page."
                        : language === "pt"
                          ? "Esta tela mantém o dispositivo em primeiro plano e reúne edição com navegação relacionada, sem precisar rolar dentro da página do parque."
                          : "Esta pantalla deja el dispositivo en primer plano y junta edición con navegación relacionada, sin tener que scrollear dentro de la página del parque."}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <div className="rounded-2xl bg-background/70 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{language === "en" ? "Syncs" : "Syncs"}</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{selectedDevice.relatedSyncCount}</p>
                  </div>
                  <div className="rounded-2xl bg-background/70 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{language === "en" ? "Games" : language === "pt" ? "Partidas" : "Partidas"}</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{selectedDevice.relatedGameCount}</p>
                  </div>
                  <div className="rounded-2xl bg-background/70 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{language === "en" ? "Last sync" : language === "pt" ? "Última sync" : "Última sync"}</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{formatDateTime(selectedDevice.lastSyncedAt)}</p>
                  </div>
                  <div className="rounded-2xl bg-background/70 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{language === "en" ? "Readiness" : language === "pt" ? "Prontidão" : "Readiness"}</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{selectedDevice.isReadyForClassroom ? t.detail.readyForClassroom : t.detail.reviewRecommended}</p>
                  </div>
                  <div className="rounded-2xl bg-background/70 p-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{language === "en" ? "Context" : language === "pt" ? "Contexto" : "Contexto"}</p>
                    <p className="mt-2 text-sm font-semibold text-foreground">{selectedDevice.isOwnedByCurrentUser ? t.detail.contextOwner : selectedDevice.isInstitutionVisible ? t.detail.contextInstitution : selectedDevice.hasUnresolvedAssociation ? t.detail.contextMissing : t.detail.contextShared}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Router className="size-5 text-primary" />
                  {language === "en" ? "Contextual navigation" : language === "pt" ? "Navegação contextual" : "Navegación contextual"}
                </CardTitle>
                <CardDescription>
                  {language === "en"
                    ? "Jump to related modules or other nearby devices without losing operational context."
                    : language === "pt"
                      ? "Salte para módulos relacionados ou outros dispositivos próximos sem perder o contexto operacional."
                      : "Saltá a módulos relacionados u otros dispositivos cercanos sin perder el contexto operativo."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl bg-background/70 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t.detail.quickLinks}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t.detail.quickLinksHint(selectedDevice.name)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={buildDeviceRelationHref("/games", selectedDevice)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      {t.detail.gamesLink}
                    </Link>
                    <Link href={buildDeviceRelationHref("/syncs", selectedDevice)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                      {t.detail.syncsLink}
                    </Link>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-white/80 p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{isTeacherView ? t.detail.whatToCheckFirst : isDirectorView ? t.detail.coordinationSignals : (language === "en" ? "Operational notes" : language === "pt" ? "Notas operacionais" : "Notas operativas")}</p>
                  {selectedDevice.reviewReasons.length ? (
                    <ul className="mt-2 space-y-1">
                      {selectedDevice.reviewReasons.map((reason) => (
                        <li key={reason}>• {reason}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2">{isTeacherView ? t.detail.teacherOk : isDirectorView ? t.detail.directorOk : (language === "en" ? "No strong soft signals appear for this device right now." : language === "pt" ? "Nenhum sinal suave forte aparece para este dispositivo agora." : "No aparecen señales blandas fuertes para este dispositivo ahora mismo.")}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>{language === "en" ? "Nearby devices" : language === "pt" ? "Dispositivos relacionados" : "Dispositivos relacionados"}</CardTitle>
                    <CardDescription>
                      {language === "en"
                        ? "Same owner or institution to keep navigating with real context."
                        : language === "pt"
                          ? "Mesmo owner ou instituição para seguir navegando com contexto real."
                          : "Mismo owner o institución para seguir navegando con contexto real."}
                    </CardDescription>
                  </div>
                  <ListPaginationControls
                    pageSize={siblingPagination.pageSize}
                    setPageSize={siblingPagination.setPageSize}
                    currentPage={siblingPagination.currentPage}
                    totalPages={siblingPagination.totalPages}
                    totalItems={siblingPagination.totalItems}
                    paginationStart={siblingPagination.paginationStart}
                    paginationEnd={siblingPagination.paginationEnd}
                    goToPreviousPage={siblingPagination.goToPreviousPage}
                    goToNextPage={siblingPagination.goToNextPage}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {siblingPagination.totalItems === 0 ? (
                  <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
                    {language === "en" ? "No related devices appeared with the current access." : language === "pt" ? "Nenhum dispositivo relacionado apareceu com o acesso atual." : "No aparecieron otros dispositivos relacionados con el acceso actual."}
                  </div>
                ) : (
                  siblingPagination.paginatedItems.map((device) => (
                    <Link
                      key={device.id}
                      href={buildDeviceDetailHref({ deviceRecordId: device.id, ...overviewState })}
                      className="block rounded-2xl border border-border/70 bg-white/85 px-4 py-3 transition hover:border-primary/30 hover:bg-primary/5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{device.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{device.deviceId} · {locationLabel(device)}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {scopeBadge(device)}
                          <Badge variant="outline">{device.ownerUserName || device.ownerUserEmail || t.detail.noOwner}</Badge>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle>{language === "en" ? "Same scope" : language === "pt" ? "Mesmo escopo" : "Mismo alcance"}</CardTitle>
                    <CardDescription>
                      {language === "en"
                        ? "Move through Home or institution devices without returning to the fleet."
                        : language === "pt"
                          ? "Percorra dispositivos Home ou de instituição sem voltar ao parque."
                          : "Recorré dispositivos Home o de institución sin volver al parque."}
                    </CardDescription>
                  </div>
                  <ListPaginationControls
                    pageSize={scopePagination.pageSize}
                    setPageSize={scopePagination.setPageSize}
                    currentPage={scopePagination.currentPage}
                    totalPages={scopePagination.totalPages}
                    totalItems={scopePagination.totalItems}
                    paginationStart={scopePagination.paginationStart}
                    paginationEnd={scopePagination.paginationEnd}
                    goToPreviousPage={scopePagination.goToPreviousPage}
                    goToNextPage={scopePagination.goToNextPage}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {scopePagination.totalItems === 0 ? (
                  <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
                    {language === "en" ? "No other devices with the same scope appeared." : language === "pt" ? "Não apareceram outros dispositivos com o mesmo escopo." : "No aparecieron otros dispositivos con el mismo alcance."}
                  </div>
                ) : (
                  scopePagination.paginatedItems.map((device) => (
                    <Link
                      key={device.id}
                      href={buildDeviceDetailHref({ deviceRecordId: device.id, ...overviewState })}
                      className="block rounded-2xl border border-border/70 bg-white/85 px-4 py-3 transition hover:border-primary/30 hover:bg-primary/5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{device.name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{device.deviceId} · {statusLabel(device.status, t.editor.noStatus)}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {device.hasOperationalActivity ? <Badge variant="secondary"><Wifi className="mr-1 size-3" />{t.summaries.withActivity}</Badge> : null}
                          {!device.hasOperationalActivity ? <Badge variant="outline"><Clock3 className="mr-1 size-3" />{t.summaries.withoutSync}</Badge> : null}
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
            <CardHeader>
              <CardTitle>{isTeacherView ? t.detail.titleTeacher : isDirectorView ? t.detail.titleDirector : t.detail.titleDefault}</CardTitle>
              <CardDescription>
                {isTeacherView ? t.detail.descriptionTeacher : isDirectorView ? t.detail.descriptionDirector : t.detail.descriptionDefault}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <DeviceEditorPanel
                key={`${selectedDevice.id}:${scopedInstitutionId || "global"}`}
                selectedDevice={selectedDevice}
                scopedInstitutionId={scopedInstitutionId}
                institutions={institutions.map((institution) => ({ id: institution.id, name: institution.name }))}
                users={users.map((user) => ({
                  id: user.id,
                  fullName: user.fullName,
                  email: user.email,
                  educationalCenterId: user.educationalCenterId,
                }))}
                token={tokens?.accessToken}
                canUpdateDevices={canUpdateDevices}
                onUpdated={() => undefined}
              />
            </CardContent>
          </Card>
        </>
      )}

      <DeleteRecordDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteCurrentDevice}
        isPending={deleteDeviceMutation.isPending}
        title={selectedDevice ? `${t.detail.deleteDevice} ${selectedDevice.name}` : t.detail.deleteDevice}
        description={selectedDevice
          ? language === "en"
            ? "The selected device will stop appearing in visible modules and related cross-links. Confirm only if you want to execute the real deletion."
            : language === "pt"
              ? "O dispositivo selecionado deixará de aparecer nos módulos visíveis e em seus cruzamentos relacionados. Confirme apenas se quiser executar a exclusão real."
              : "El dispositivo seleccionado dejará de aparecer en los módulos visibles y en sus cruces relacionados. Confirmá solo si querés ejecutar la eliminación real."
          : language === "en"
            ? "Confirm deletion of the selected device."
            : language === "pt"
              ? "Confirme a exclusão do dispositivo selecionado."
              : "Confirmá la eliminación del dispositivo seleccionado."}
        confirmLabel={language === "en" ? "Yes, delete device" : language === "pt" ? "Sim, excluir dispositivo" : "Sí, eliminar dispositivo"}
      />
    </div>
  );
}
