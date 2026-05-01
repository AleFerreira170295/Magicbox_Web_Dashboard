"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Home, Search, ShieldCheck, Smartphone, University, UserRound, Wifi } from "lucide-react";
import { DeleteRecordDialog } from "@/components/delete-record-dialog";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListPaginationControls, useListPagination } from "@/components/ui/list-pagination-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-context";
import { deleteDevice, updateDevice, useDevices } from "@/features/devices/api";
import type { DeviceRecord, UpdateDevicePayload } from "@/features/devices/types";
import { useGames } from "@/features/games/api";
import { useLanguage, type AppLanguage } from "@/features/i18n/i18n-context";
import { useInstitutions } from "@/features/institutions/api";
import { useSyncSessions } from "@/features/syncs/api";
import { useUsers } from "@/features/users/api";
import { cn, formatDateTime, getErrorMessage } from "@/lib/utils";

const devicesMessages: Record<AppLanguage, {
  eyebrow: { default: string; teacher: string; director: string; institutionAdmin: string };
  title: string;
  description: { default: string; teacher: string; director: (name: string) => string; institutionAdmin: (name: string) => string };
  actions: { focus: string; active: string; filter: string; viewAll: string };
  filters: {
    searchPlaceholder: string;
    scopeAll: string;
    scopeHome: string;
    scopeInstitution: string;
    allInstitutions: string;
    accessAll: string;
    accessOwned: string;
    accessInstitution: string;
    accessShared: string;
    accessUnresolved: string;
    clearFilters: string;
    clearUserFilter: string;
  };
  chips: { activeInstitution: (name: string) => string; filteredUser: (name: string) => string; overview: string; clear: string };
  accessPanel: { title: string; hint: string; results: (count: number) => string };
  summaries: {
    devices: string;
    home: string;
    institution: string;
    online: string;
    withActivity: string;
    withoutSync: string;
    withoutOwner: string;
    review: string;
    withOwner: string;
    withMetadata: string;
  };
  results: { title: string; summary: (filtered: number, total: number) => string };
  focus: { title: string; hint: string; clear: string };
  list: { title: string; descriptionDefault: string; descriptionTeacher: string; descriptionDirector: string };
  table: {
    name: string; scope: string; location: string; owner: string; access: string; state: string; empty: string;
    home: string; institution: string; noOwner: string; syncsGames: (syncs: number, games: number) => string;
  };
  detail: {
    titleDefault: string; titleTeacher: string; titleDirector: string;
    descriptionDefault: string; descriptionTeacher: string; descriptionDirector: string;
    selectDevice: string;
    visibleActivity: string; noVisibleActivity: string; hasVisibleSync: string; noVisibleSync: string; readyForClassroom: string; reviewRecommended: string; stable: string; needsFollowUp: string;
    visibleSyncs: (count: number) => string; visibleGames: (count: number) => string; lastVisibleSync: (value: string) => string;
    contextOwner: string; contextInstitution: string; contextMissing: string; contextShared: string; context: (value: string) => string;
    noOwner: string; noFirmware: string; deleteDevice: string; deleteError: (message: string) => string;
    removeSelection: string; quickLinks: string; quickLinksHint: (name: string) => string; gamesLink: string; syncsLink: string;
    whatToCheckFirst: string; coordinationSignals: string; teacherOk: string; directorOk: string;
  };
  editor: {
    noSelectedDevice: string; updated: string; noSelectedDeviceError: string; noPermission: string; nameRequired: string; institutionRequired: string;
    currentLocation: (value: string) => string; updatedAt: (value: string) => string; currentOwner: (value: string) => string; currentFirmware: (value: string) => string;
    contextVisible: string; name: string; scope: string; institution: string; owner: string; status: string; firmware: string;
    selectInstitution: string; noOwner: string; statusPlaceholder: string; institutionLockHint: string; readOnlyHint: string;
    homeHint: string; institutionHint: string; saving: string; saveChanges: string; editingBlocked: string; visibleMetadata: string;
    noStatus: string; homeLocation: string; homeLocationLong: string; noFirmware: string;
  };
}> = {
  es: {
    eyebrow: { default: "Operación", teacher: "Teacher", director: "Director", institutionAdmin: "Institution admin" },
    title: "Dispositivos",
    description: {
      default: "Pantalla operativa de hardware conectada al contrato real de /ble-device, distinguiendo dispositivos Home y de institución.",
      teacher: "Vista operativa de dispositivos visibles para el docente, aclarando si el hardware entra por ownership directo, alcance institucional o asociaciones compartidas.",
      director: (name) => `Vista de coordinación del parque para ${name}, priorizando readiness, ownership y señales de seguimiento.`,
      institutionAdmin: (name) => `Vista operativa de hardware para ${name}, con edición controlada para ownership, alcance y estado.`,
    },
    actions: { focus: "Ver foco", active: "Foco activo", filter: "Filtrar", viewAll: "Ver todos" },
    filters: {
      searchPlaceholder: "Filtrar por deviceId, nombre, Home, institución o responsable",
      scopeAll: "Todos los alcances",
      scopeHome: "Solo Home",
      scopeInstitution: "Solo institución",
      allInstitutions: "Todas las instituciones",
      accessAll: "Todos los accesos",
      accessOwned: "Mis dispositivos",
      accessInstitution: "Institución visible",
      accessShared: "Compartidos",
      accessUnresolved: "Sin asociación resuelta",
      clearFilters: "Limpiar filtros",
      clearUserFilter: "Quitar filtro de usuario",
    },
    chips: { activeInstitution: (name) => `Institución activa: ${name}`, filteredUser: (name) => `Usuario filtrado: ${name}`, overview: "Vista general", clear: "Limpiar" },
    accessPanel: { title: "Acceso disponible", hint: "Filtrá por relación de acceso para entender por qué aparece cada dispositivo.", results: (count) => `${count} resultados` },
    summaries: { devices: "Dispositivos", home: "Home", institution: "Institución", online: "Online", withActivity: "Con actividad", withoutSync: "Sin sync visible", withoutOwner: "Sin responsable", review: "Conviene revisar", withOwner: "Con responsable", withMetadata: "Con metadata" },
    results: { title: "Resultados", summary: (filtered, total) => `${filtered} de ${total} dispositivos con el recorte actual.` },
    focus: { title: "Enfocar revisión", hint: "Recortá el parque por señales blandas antes de abrir el detalle.", clear: "Limpiar foco" },
    list: {
      title: "Parque de dispositivos",
      descriptionDefault: "Seleccioná un dispositivo para revisar y editar su alcance, ownership y estado operativo.",
      descriptionTeacher: "Seleccioná un dispositivo para entender por qué lo ves, si tuvo actividad reciente y qué conviene revisar antes de usarlo en aula.",
      descriptionDirector: "Seleccioná un dispositivo para revisar ownership, actividad y señales de seguimiento antes de coordinar con soporte o con el equipo docente.",
    },
    table: {
      name: "Nombre", scope: "Alcance", location: "Ubicación", owner: "Responsable", access: "Acceso", state: "Estado", empty: "No hay dispositivos para mostrar.",
      home: "Home", institution: "Institución", noOwner: "sin responsable", syncsGames: (syncs, games) => `${syncs} syncs, ${games} partidas`,
    },
    detail: {
      titleDefault: "Detalle y edición", titleTeacher: "Detalle operativo para aula", titleDirector: "Detalle de coordinación",
      descriptionDefault: "Revisá el contexto visible del dispositivo y editá los datos operativos básicos desde el mismo panel.",
      descriptionTeacher: "Para docente, este panel resume ownership, actividad visible y señales de revisión para decidir rápido qué dispositivo conviene usar o escalar.",
      descriptionDirector: "Para dirección, este panel resume señales de seguimiento y si el dispositivo parece estable o necesita coordinación.",
      selectDevice: "Elegí un dispositivo para revisar y editar su contexto operativo.",
      visibleActivity: "actividad visible", noVisibleActivity: "sin actividad visible", hasVisibleSync: "con sync visible", noVisibleSync: "sin sync visible", readyForClassroom: "listo para aula", reviewRecommended: "conviene revisar", stable: "estable para coordinar", needsFollowUp: "requiere seguimiento",
      visibleSyncs: (count) => `Syncs visibles: ${count}`, visibleGames: (count) => `Partidas visibles: ${count}`, lastVisibleSync: (value) => `Última sync visible: ${value}`,
      contextOwner: "owner directo", contextInstitution: "institución visible", contextMissing: "falta asociación", contextShared: "acceso compartido", context: (value) => `Contexto: ${value}`,
      noOwner: "Sin responsable", noFirmware: "Sin firmware", deleteDevice: "Eliminar dispositivo", deleteError: (message) => `No pude eliminar el dispositivo. ${message}`,
      removeSelection: "Quitar selección", quickLinks: "Cruces rápidos", quickLinksHint: (name) => `Abrí partidas y syncs ya filtradas por ${name} para seguir actividad sin rehacer la búsqueda.`, gamesLink: "Ver partidas del dispositivo", syncsLink: "Ver syncs del dispositivo",
      whatToCheckFirst: "Qué mirar primero", coordinationSignals: "Señales de coordinación", teacherOk: "No aparece ninguna señal blanda fuerte. Si además respondió en la última sync visible, debería estar listo para la jornada.", directorOk: "No aparecen señales blandas fuertes. Desde dirección, este dispositivo se ve estable para seguimiento normal sin escalamiento inmediato.",
    },
    editor: {
      noSelectedDevice: "No hay dispositivo seleccionado.", updated: "Dispositivo actualizado correctamente.", noSelectedDeviceError: "Seleccioná un dispositivo primero.", noPermission: "Tu acceso actual no permite editar dispositivos.", nameRequired: "El nombre es obligatorio.", institutionRequired: "Elegí una institución para el dispositivo.",
      currentLocation: (value) => `Ubicación actual: ${value}`, updatedAt: (value) => `Actualizado: ${value}`, currentOwner: (value) => `Owner actual: ${value}`, currentFirmware: (value) => `Firmware actual: ${value}`,
      contextVisible: "Contexto visible", name: "Nombre", scope: "Alcance", institution: "Institución", owner: "Responsable", status: "Status", firmware: "Firmware",
      selectInstitution: "Seleccionar institución", noOwner: "Sin owner", statusPlaceholder: "online, offline, active...", institutionLockHint: "Tu vista está anclada a una única institución, así que no podés mover este dispositivo a Home desde aquí.", readOnlyHint: "Tu acceso actual es de solo lectura para dispositivos.",
      homeHint: "Home es válido. El dispositivo queda sin centro educativo asociado.", institutionHint: "En modo institución, el dispositivo debe quedar asociado a un centro concreto.", saving: "Guardando...", saveChanges: "Guardar cambios", editingBlocked: "Edición bloqueada", visibleMetadata: "Metadata visible",
      noStatus: "Sin status", homeLocation: "Home", homeLocationLong: "Home, sin centro educativo asociado", noFirmware: "sin firmware",
    },
  },
  en: {
    eyebrow: { default: "Operations", teacher: "Teacher", director: "Director", institutionAdmin: "Institution admin" },
    title: "Devices",
    description: {
      default: "Operational hardware screen connected to the real /ble-device contract, distinguishing Home and institution devices.",
      teacher: "Operational view of the devices visible to the teacher, clarifying whether the hardware appears through direct ownership, institution scope, or shared associations.",
      director: (name) => `Fleet coordination view for ${name}, prioritizing readiness, ownership, and follow-up signals.`,
      institutionAdmin: (name) => `Operational hardware view for ${name}, with controlled editing for ownership, scope, and state.`,
    },
    actions: { focus: "View focus", active: "Active focus", filter: "Filter", viewAll: "View all" },
    filters: {
      searchPlaceholder: "Filter by deviceId, name, Home, institution, or owner",
      scopeAll: "All scopes", scopeHome: "Home only", scopeInstitution: "Institution only", allInstitutions: "All institutions",
      accessAll: "All access", accessOwned: "My devices", accessInstitution: "Institution-visible", accessShared: "Shared", accessUnresolved: "Unresolved association",
      clearFilters: "Clear filters", clearUserFilter: "Clear user filter",
    },
    chips: { activeInstitution: (name) => `Active institution: ${name}`, filteredUser: (name) => `Filtered user: ${name}`, overview: "Overview", clear: "Clear" },
    accessPanel: { title: "Available access", hint: "Filter by access relation to understand why each device appears.", results: (count) => `${count} results` },
    summaries: { devices: "Devices", home: "Home", institution: "Institution", online: "Online", withActivity: "With activity", withoutSync: "Without visible sync", withoutOwner: "Without owner", review: "Needs review", withOwner: "With owner", withMetadata: "With metadata" },
    results: { title: "Results", summary: (filtered, total) => `${filtered} of ${total} devices match the current view.` },
    focus: { title: "Focus review", hint: "Trim the fleet by soft signals before opening details.", clear: "Clear focus" },
    list: {
      title: "Device fleet",
      descriptionDefault: "Select a device to review and edit its scope, ownership, and operational state.",
      descriptionTeacher: "Select a device to understand why you can see it, whether it had recent activity, and what should be reviewed before using it in class.",
      descriptionDirector: "Select a device to review ownership, activity, and follow-up signals before coordinating with support or the teaching team.",
    },
    table: { name: "Name", scope: "Scope", location: "Location", owner: "Owner", access: "Access", state: "State", empty: "No devices to show.", home: "Home", institution: "Institution", noOwner: "no owner", syncsGames: (syncs, games) => `${syncs} syncs, ${games} games` },
    detail: {
      titleDefault: "Detail and editing", titleTeacher: "Operational classroom detail", titleDirector: "Coordination detail",
      descriptionDefault: "Review the device's visible context and edit its basic operational data from the same panel.", descriptionTeacher: "For teachers, this panel summarizes ownership, visible activity, and review signals to decide quickly which device to use or escalate.", descriptionDirector: "For directors, this panel summarizes follow-up signals and whether the device looks stable or needs coordination.", selectDevice: "Choose a device to review and edit its operational context.", visibleActivity: "visible activity", noVisibleActivity: "no visible activity", hasVisibleSync: "with visible sync", noVisibleSync: "without visible sync", readyForClassroom: "ready for classroom", reviewRecommended: "worth reviewing", stable: "stable for coordination", needsFollowUp: "needs follow-up", visibleSyncs: (count) => `Visible syncs: ${count}`, visibleGames: (count) => `Visible games: ${count}`, lastVisibleSync: (value) => `Last visible sync: ${value}`, contextOwner: "direct owner", contextInstitution: "institution-visible", contextMissing: "missing association", contextShared: "shared access", context: (value) => `Context: ${value}`, noOwner: "No owner", noFirmware: "No firmware", deleteDevice: "Delete device", deleteError: (message) => `Couldn't delete the device. ${message}`, removeSelection: "Clear selection", quickLinks: "Quick links", quickLinksHint: (name) => `Open games and syncs already filtered by ${name} to follow activity without rebuilding the search.`, gamesLink: "View device games", syncsLink: "View device syncs", whatToCheckFirst: "What to check first", coordinationSignals: "Coordination signals", teacherOk: "No strong soft signal appears. If it also responded in the latest visible sync, it should be ready for the day.", directorOk: "No strong soft signals appear. From the director view, this device looks stable for normal follow-up without immediate escalation.",
    },
    editor: {
      noSelectedDevice: "No device selected.", updated: "Device updated successfully.", noSelectedDeviceError: "Select a device first.", noPermission: "Your current access does not allow editing devices.", nameRequired: "Name is required.", institutionRequired: "Choose an institution for the device.",
      currentLocation: (value) => `Current location: ${value}`, updatedAt: (value) => `Updated: ${value}`, currentOwner: (value) => `Current owner: ${value}`, currentFirmware: (value) => `Current firmware: ${value}`,
      contextVisible: "Visible context", name: "Name", scope: "Scope", institution: "Institution", owner: "Owner", status: "Status", firmware: "Firmware",
      selectInstitution: "Select institution", noOwner: "No owner", statusPlaceholder: "online, offline, active...", institutionLockHint: "Your view is locked to a single institution, so you can't move this device to Home from here.", readOnlyHint: "Your current access is read-only for devices.",
      homeHint: "Home is valid. The device remains without an associated educational center.", institutionHint: "In institution mode, the device must remain linked to a specific center.", saving: "Saving...", saveChanges: "Save changes", editingBlocked: "Editing blocked", visibleMetadata: "Visible metadata",
      noStatus: "No status", homeLocation: "Home", homeLocationLong: "Home, no associated educational center", noFirmware: "no firmware",
    },
  },
  pt: {
    eyebrow: { default: "Operação", teacher: "Teacher", director: "Director", institutionAdmin: "Institution admin" },
    title: "Dispositivos",
    description: {
      default: "Tela operacional de hardware conectada ao contrato real de /ble-device, distinguindo dispositivos Home e de instituição.",
      teacher: "Visão operacional dos dispositivos visíveis para o docente, deixando claro se o hardware entra por ownership direto, alcance institucional ou associações compartilhadas.",
      director: (name) => `Visão de coordenação do parque para ${name}, priorizando prontidão, ownership e sinais de acompanhamento.`,
      institutionAdmin: (name) => `Visão operacional de hardware para ${name}, com edição controlada de ownership, alcance e estado.`,
    },
    actions: { focus: "Ver foco", active: "Foco ativo", filter: "Filtrar", viewAll: "Ver todos" },
    filters: {
      searchPlaceholder: "Filtrar por deviceId, nome, Home, instituição ou responsável",
      scopeAll: "Todos os escopos", scopeHome: "Só Home", scopeInstitution: "Só instituição", allInstitutions: "Todas as instituições",
      accessAll: "Todos os acessos", accessOwned: "Meus dispositivos", accessInstitution: "Instituição visível", accessShared: "Compartilhados", accessUnresolved: "Sem associação resolvida",
      clearFilters: "Limpar filtros", clearUserFilter: "Remover filtro de usuário",
    },
    chips: { activeInstitution: (name) => `Instituição ativa: ${name}`, filteredUser: (name) => `Usuário filtrado: ${name}`, overview: "Visão geral", clear: "Limpar" },
    accessPanel: { title: "Acesso disponível", hint: "Filtre por relação de acesso para entender por que cada dispositivo aparece.", results: (count) => `${count} resultados` },
    summaries: { devices: "Dispositivos", home: "Home", institution: "Instituição", online: "Online", withActivity: "Com atividade", withoutSync: "Sem sync visível", withoutOwner: "Sem responsável", review: "Convém revisar", withOwner: "Com responsável", withMetadata: "Com metadata" },
    results: { title: "Resultados", summary: (filtered, total) => `${filtered} de ${total} dispositivos com o recorte atual.` },
    focus: { title: "Focar revisão", hint: "Recorte o parque por sinais suaves antes de abrir o detalhe.", clear: "Limpar foco" },
    list: {
      title: "Parque de dispositivos",
      descriptionDefault: "Selecione um dispositivo para revisar e editar seu alcance, ownership e estado operacional.",
      descriptionTeacher: "Selecione um dispositivo para entender por que você o vê, se teve atividade recente e o que convém revisar antes de usá-lo em sala.",
      descriptionDirector: "Selecione um dispositivo para revisar ownership, atividade e sinais de acompanhamento antes de coordenar com suporte ou com a equipe docente.",
    },
    table: { name: "Nome", scope: "Escopo", location: "Localização", owner: "Responsável", access: "Acesso", state: "Estado", empty: "Não há dispositivos para mostrar.", home: "Home", institution: "Instituição", noOwner: "sem responsável", syncsGames: (syncs, games) => `${syncs} syncs, ${games} partidas` },
    detail: {
      titleDefault: "Detalhe e edição", titleTeacher: "Detalhe operacional para sala", titleDirector: "Detalhe de coordenação",
      descriptionDefault: "Revise o contexto visível do dispositivo e edite os dados operacionais básicos no mesmo painel.", descriptionTeacher: "Para docentes, este painel resume ownership, atividade visível e sinais de revisão para decidir rapidamente qual dispositivo usar ou escalar.", descriptionDirector: "Para direção, este painel resume sinais de acompanhamento e se o dispositivo parece estável ou precisa de coordenação.", selectDevice: "Escolha um dispositivo para revisar e editar seu contexto operacional.", visibleActivity: "atividade visível", noVisibleActivity: "sem atividade visível", hasVisibleSync: "com sync visível", noVisibleSync: "sem sync visível", readyForClassroom: "pronto para sala", reviewRecommended: "convém revisar", stable: "estável para coordenar", needsFollowUp: "requer acompanhamento", visibleSyncs: (count) => `Syncs visíveis: ${count}`, visibleGames: (count) => `Partidas visíveis: ${count}`, lastVisibleSync: (value) => `Última sync visível: ${value}`, contextOwner: "owner direto", contextInstitution: "instituição visível", contextMissing: "falta associação", contextShared: "acesso compartilhado", context: (value) => `Contexto: ${value}`, noOwner: "Sem responsável", noFirmware: "Sem firmware", deleteDevice: "Excluir dispositivo", deleteError: (message) => `Não consegui excluir o dispositivo. ${message}`, removeSelection: "Remover seleção", quickLinks: "Links rápidos", quickLinksHint: (name) => `Abra partidas e syncs já filtradas por ${name} para acompanhar a atividade sem refazer a busca.`, gamesLink: "Ver partidas do dispositivo", syncsLink: "Ver syncs do dispositivo", whatToCheckFirst: "O que olhar primeiro", coordinationSignals: "Sinais de coordenação", teacherOk: "Não aparece nenhum sinal suave forte. Se também respondeu na última sync visível, deve estar pronto para a jornada.", directorOk: "Não aparecem sinais suaves fortes. Da visão de direção, este dispositivo parece estável para acompanhamento normal sem escalonamento imediato.",
    },
    editor: {
      noSelectedDevice: "Nenhum dispositivo selecionado.", updated: "Dispositivo atualizado com sucesso.", noSelectedDeviceError: "Selecione um dispositivo primeiro.", noPermission: "Seu acesso atual não permite editar dispositivos.", nameRequired: "O nome é obrigatório.", institutionRequired: "Escolha uma instituição para o dispositivo.",
      currentLocation: (value) => `Localização atual: ${value}`, updatedAt: (value) => `Atualizado: ${value}`, currentOwner: (value) => `Owner atual: ${value}`, currentFirmware: (value) => `Firmware atual: ${value}`,
      contextVisible: "Contexto visível", name: "Nome", scope: "Escopo", institution: "Instituição", owner: "Responsável", status: "Status", firmware: "Firmware",
      selectInstitution: "Selecionar instituição", noOwner: "Sem owner", statusPlaceholder: "online, offline, active...", institutionLockHint: "Sua visão está presa a uma única instituição, então você não pode mover este dispositivo para Home daqui.", readOnlyHint: "Seu acesso atual é somente leitura para dispositivos.",
      homeHint: "Home é válido. O dispositivo fica sem centro educacional associado.", institutionHint: "No modo instituição, o dispositivo deve ficar associado a um centro específico.", saving: "Salvando...", saveChanges: "Salvar alterações", editingBlocked: "Edição bloqueada", visibleMetadata: "Metadata visível",
      noStatus: "Sem status", homeLocation: "Home", homeLocationLong: "Home, sem centro educacional associado", noFirmware: "sem firmware",
    },
  },
};

type DeviceFormState = {
  name: string;
  assignmentScope: "home" | "institution";
  educationalCenterId: string;
  ownerUserId: string;
  firmwareVersion: string;
  status: string;
};

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
  onSelect,
  isActive = false,
  actionLabel,
  activeLabel,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  onSelect?: () => void;
  isActive?: boolean;
  actionLabel: string;
  activeLabel: string;
}) {
  return (
    <Card className={cn("border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]", isActive && "ring-2 ring-primary/20")}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
            {hint ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{hint}</p> : null}
          </div>
          <div className="rounded-2xl bg-primary/12 p-3 text-primary">
            <Icon className="size-5" />
          </div>
        </div>
        {onSelect ? (
          <button
            type="button"
            onClick={onSelect}
            aria-label={`${isActive ? activeLabel : actionLabel} ${label}`}
            className={cn(
              "mt-4 inline-flex rounded-full border px-3 py-1.5 text-xs font-medium transition",
              isActive
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border/70 bg-white/80 text-foreground hover:border-primary/30 hover:bg-primary/5",
            )}
          >
            {isActive ? activeLabel : actionLabel}
          </button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function statusLabel(status?: string | null, fallback = "sin estado") {
  if (!status) return fallback;
  return status.replaceAll("_", " ");
}

function scopeBadge(device: { assignmentScope: "home" | "institution"; educationalCenterName?: string | null }) {
  if (device.assignmentScope === "home") return <Badge variant="secondary">Home</Badge>;
  return <Badge variant="outline">{device.educationalCenterName || "Institución"}</Badge>;
}

function locationLabel(device: {
  assignmentScope: "home" | "institution";
  educationalCenterName?: string | null;
  educationalCenterId?: string | null;
}) {
  if (device.assignmentScope === "home") return "Home";
  return device.educationalCenterName || device.educationalCenterId || "Institución";
}

function buildDeviceRelationHref(pathname: string, device: Pick<DeviceRecord, "id" | "deviceId" | "name">) {
  const params = new URLSearchParams();
  params.set("bleDeviceId", device.id);
  params.set("deviceId", device.deviceId);
  params.set("deviceName", device.name);
  return `${pathname}?${params.toString()}`;
}

function buildFormState(device: DeviceRecord | null, scopedInstitutionId?: string | null): DeviceFormState {
  if (!device) {
    return {
      name: "",
      assignmentScope: scopedInstitutionId ? "institution" : "home",
      educationalCenterId: scopedInstitutionId || "",
      ownerUserId: "",
      firmwareVersion: "",
      status: "",
    };
  }

  return {
    name: device.name,
    assignmentScope: device.assignmentScope,
    educationalCenterId: device.educationalCenterId || scopedInstitutionId || "",
    ownerUserId: device.ownerUserId || "",
    firmwareVersion: device.firmwareVersion || "",
    status: device.status || "",
  };
}

function getDeviceInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("") || "DV";
}

function DeviceAvatar({
  device,
  className,
}: {
  device: Pick<DeviceRecord, "name" | "assignmentScope">;
  className?: string;
}) {
  const Icon = device.assignmentScope === "home" ? Home : Smartphone;

  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-white text-primary", className)}>
      <div className="flex flex-col items-center justify-center leading-none">
        <Icon className="size-4" />
        <span className="mt-1 text-[10px] font-semibold tracking-[0.12em] text-primary/80">{getDeviceInitials(device.name)}</span>
      </div>
    </div>
  );
}

function DeviceEditorPanel({
  selectedDevice,
  scopedInstitutionId,
  institutions,
  users,
  token,
  canUpdateDevices,
  onUpdated,
}: {
  selectedDevice: DeviceRecord & { relatedSyncCount: number };
  scopedInstitutionId?: string | null;
  institutions: Array<{ id: string; name: string }>;
  users: Array<{ id: string; fullName: string; email: string; educationalCenterId?: string | null }>;
  token?: string;
  canUpdateDevices: boolean;
  onUpdated: (deviceId: string) => void;
}) {
  const { language } = useLanguage();
  const t = devicesMessages[language];
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState<DeviceFormState>(() => buildFormState(selectedDevice, scopedInstitutionId));
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const assignmentLockedToInstitution = Boolean(scopedInstitutionId);
  const deviceContextBadges = [
    selectedDevice.assignmentScope === "home" ? t.editor.homeLocation : locationLabel(selectedDevice),
    selectedDevice.ownerUserName || selectedDevice.ownerUserEmail || t.detail.noOwner,
    selectedDevice.firmwareVersion || t.detail.noFirmware,
    statusLabel(selectedDevice.status, t.editor.noStatus),
  ];

  const availableOwners = useMemo(() => {
    if (formState.assignmentScope === "home") return users;
    if (!formState.educationalCenterId) return users;
    return users.filter((user) => !user.educationalCenterId || user.educationalCenterId === formState.educationalCenterId);
  }, [formState.assignmentScope, formState.educationalCenterId, users]);

  const updateDeviceMutation = useMutation({
    mutationFn: async (payload: UpdateDevicePayload) => {
      if (!token || !selectedDevice) throw new Error(t.editor.noSelectedDevice);
      return updateDevice(token, selectedDevice.id, payload);
    },
    onSuccess: async (updatedDevice) => {
      setFeedback({ tone: "success", text: t.editor.updated });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["devices"] }),
        queryClient.invalidateQueries({ queryKey: ["institutions"] }),
      ]);
      onUpdated(updatedDevice.id);
    },
    onError: (error) => {
      setFeedback({ tone: "error", text: getErrorMessage(error) });
    },
  });

  const handleFieldChange = <K extends keyof DeviceFormState>(key: K, value: DeviceFormState[K]) => {
    setFormState((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!selectedDevice) {
      setFeedback({ tone: "error", text: t.editor.noSelectedDeviceError });
      return;
    }

    if (!canUpdateDevices) {
      setFeedback({ tone: "error", text: t.editor.noPermission });
      return;
    }

    if (!formState.name.trim()) {
      setFeedback({ tone: "error", text: t.editor.nameRequired });
      return;
    }

    if (formState.assignmentScope === "institution" && !formState.educationalCenterId) {
      setFeedback({ tone: "error", text: t.editor.institutionRequired });
      return;
    }

    await updateDeviceMutation.mutateAsync({
      name: formState.name.trim(),
      educationalCenterId: formState.assignmentScope === "home" ? null : formState.educationalCenterId,
      ownerUserId: formState.ownerUserId || null,
      firmwareVersion: formState.firmwareVersion || null,
      status: formState.status || null,
    });
  };

  return (
    <>
      <div className="rounded-2xl bg-background/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <DeviceAvatar device={selectedDevice} className="size-14" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{selectedDevice.name}</p>
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{selectedDevice.deviceId}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {scopeBadge(selectedDevice)}
            <Badge variant={selectedDevice.status ? "secondary" : "outline"}>{statusLabel(selectedDevice.status, t.editor.noStatus)}</Badge>
            <Badge variant={selectedDevice.relatedSyncCount > 0 ? "secondary" : "outline"}>
              {selectedDevice.relatedSyncCount > 0 ? t.detail.hasVisibleSync : t.detail.noVisibleSync}
            </Badge>
          </div>
        </div>
        <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
          <p>{t.editor.currentLocation(selectedDevice.assignmentScope === "home" ? t.editor.homeLocationLong : locationLabel(selectedDevice))}</p>
          <p>{t.editor.updatedAt(formatDateTime(selectedDevice.updatedAt))}</p>
          <p>{t.editor.currentOwner(selectedDevice.ownerUserName || selectedDevice.ownerUserEmail || t.editor.noOwner)}</p>
          <p>{t.editor.currentFirmware(selectedDevice.firmwareVersion || t.editor.noFirmware)}</p>
        </div>
      </div>

      {feedback ? (
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-sm",
            feedback.tone === "error" ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-700",
          )}
        >
          {feedback.text}
        </div>
      ) : null}

      <div className="rounded-2xl border border-border/70 bg-white/80 p-4">
        <p className="text-sm font-medium text-foreground">{t.editor.contextVisible}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {deviceContextBadges.map((badge) => (
            <Badge key={badge} variant="outline">{badge}</Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-foreground">{t.editor.name}</label>
          <Input value={formState.name} onChange={(event) => handleFieldChange("name", event.target.value)} disabled={!canUpdateDevices} />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">{t.editor.scope}</label>
          <select
            value={formState.assignmentScope}
            onChange={(event) => handleFieldChange("assignmentScope", event.target.value as "home" | "institution")}
            disabled={assignmentLockedToInstitution || !canUpdateDevices}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="home">{t.editor.homeLocation}</option>
            <option value="institution">{t.editor.institution}</option>
          </select>
          {assignmentLockedToInstitution ? (
            <p className="text-xs text-muted-foreground">{t.editor.institutionLockHint}</p>
          ) : !canUpdateDevices ? (
            <p className="text-xs text-muted-foreground">{t.editor.readOnlyHint}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">{t.editor.institution}</label>
          <select
            value={formState.educationalCenterId}
            onChange={(event) => handleFieldChange("educationalCenterId", event.target.value)}
            disabled={formState.assignmentScope === "home" || !canUpdateDevices}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">{t.editor.selectInstitution}</option>
            {institutions.map((institution) => (
              <option key={institution.id} value={institution.id}>
                {institution.name}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">{t.editor.owner}</label>
          <select
            value={formState.ownerUserId}
            onChange={(event) => handleFieldChange("ownerUserId", event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            disabled={!canUpdateDevices}
          >
            <option value="">{t.editor.noOwner}</option>
            {availableOwners.map((user) => (
              <option key={user.id} value={user.id}>
                {user.fullName} · {user.email}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">{t.editor.status}</label>
          <Input value={formState.status} onChange={(event) => handleFieldChange("status", event.target.value)} placeholder={t.editor.statusPlaceholder} disabled={!canUpdateDevices} />
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-foreground">{t.editor.firmware}</label>
          <Input value={formState.firmwareVersion} onChange={(event) => handleFieldChange("firmwareVersion", event.target.value)} placeholder="V2.2" disabled={!canUpdateDevices} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
        <div>
          {formState.assignmentScope === "home" ? t.editor.homeHint : t.editor.institutionHint}
        </div>
        <Button onClick={handleSubmit} disabled={updateDeviceMutation.isPending || !canUpdateDevices}>
          {updateDeviceMutation.isPending ? t.editor.saving : canUpdateDevices ? t.editor.saveChanges : t.editor.editingBlocked}
        </Button>
      </div>

      <div>
        <p className="text-sm font-medium text-foreground">{t.editor.visibleMetadata}</p>
        <div className="mt-3 max-h-[280px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
          <pre className="overflow-x-auto whitespace-pre-wrap">{JSON.stringify(selectedDevice.deviceMetadata || {}, null, 2)}</pre>
        </div>
      </div>
    </>
  );
}

type DeviceFocusFilter = "all" | "review" | "no_owner" | "with_owner" | "no_status" | "no_metadata" | "with_metadata" | "online" | "with_activity" | "without_sync";

export function DevicesTable() {
  const { language } = useLanguage();
  const t = devicesMessages[language];
  const { tokens, user: currentUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [institutionFilter, setInstitutionFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | "home" | "institution">("all");
  const [focusFilter, setFocusFilter] = useState<DeviceFocusFilter>("all");
  const [accessFilter, setAccessFilter] = useState<"all" | "owned" | "institution" | "shared" | "unresolved">("all");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const linkedOwnerUserId = searchParams.get("ownerUserId")?.trim() || "";
  const linkedOwnerUserName = searchParams.get("ownerUserName")?.trim() || "";
  const queryClient = useQueryClient();

  const devicesQuery = useDevices(tokens?.accessToken);
  const institutionsQuery = useInstitutions(tokens?.accessToken);
  const usersQuery = useUsers(tokens?.accessToken);
  const gamesQuery = useGames(tokens?.accessToken);
  const syncsQuery = useSyncSessions(tokens?.accessToken);

  const devices = useMemo(() => devicesQuery.data?.data || [], [devicesQuery.data]);
  const institutions = useMemo(() => institutionsQuery.data?.data || [], [institutionsQuery.data]);
  const users = useMemo(() => usersQuery.data?.data || [], [usersQuery.data]);
  const games = useMemo(() => gamesQuery.data?.data || [], [gamesQuery.data]);
  const syncs = useMemo(() => syncsQuery.data?.data || [], [syncsQuery.data]);

  const scopedInstitutionId = institutions.length === 1 ? institutions[0]?.id || null : null;
  const scopedInstitutionName = scopedInstitutionId ? institutions[0]?.name || scopedInstitutionId : null;
  const isInstitutionScopedView = Boolean(scopedInstitutionId && currentUser?.educationalCenterId === scopedInstitutionId);

  const currentPermissionKeys = useMemo(() => new Set(currentUser?.permissions || []), [currentUser?.permissions]);
  const hasGlobalAdminRole = currentUser?.roles.includes("admin") || false;
  const hasResolvedCapabilities = hasGlobalAdminRole || currentPermissionKeys.size > 0;

  function hasAnyPermission(...keys: string[]) {
    if (hasGlobalAdminRole) return true;
    if (!hasResolvedCapabilities) return true;
    return keys.some((key) => currentPermissionKeys.has(key));
  }

  const canUpdateDevices = hasAnyPermission("ble_device:update", "ble-device:update");
  const canDeleteDevices = hasAnyPermission("ble_device:delete", "ble-device:delete");
  const currentUserEmail = (currentUser?.email || "").trim().toLowerCase();
  const isTeacherView = currentUser?.roles.includes("teacher") || false;
  const isDirectorView = currentUser?.roles.includes("director") || false;

  const deleteDeviceMutation = useMutation({
    mutationFn: (deviceId: string) => deleteDevice(tokens?.accessToken as string, deviceId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["devices"] }),
        queryClient.invalidateQueries({ queryKey: ["games"] }),
        queryClient.invalidateQueries({ queryKey: ["sync-sessions"] }),
      ]);
      setSelectedDeviceId(null);
    },
  });

  const deviceRows = useMemo(() => {
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
        isReadyForClassroom: Boolean(
          device.status &&
          !hasUnresolvedAssociation &&
          hasOperationalActivity,
        ),
      };
    });
  }, [currentUser, currentUserEmail, devices, games, language, syncs, t.detail.noVisibleSync, t.filters.accessInstitution, t.filters.accessOwned, t.filters.accessShared, t.filters.accessUnresolved]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const effectiveInstitutionFilter = institutionFilter === "all" && scopedInstitutionId ? scopedInstitutionId : institutionFilter;

    return deviceRows.filter((device) => {
      if (linkedOwnerUserId && device.ownerUserId !== linkedOwnerUserId) return false;
      if (scopeFilter !== "all" && device.assignmentScope !== scopeFilter) return false;
      if (
        effectiveInstitutionFilter !== "all" &&
        (device.assignmentScope !== "institution" || device.educationalCenterId !== effectiveInstitutionFilter)
      ) {
        return false;
      }
      if (accessFilter === "owned" && !device.isOwnedByCurrentUser) return false;
      if (accessFilter === "institution" && !device.isInstitutionVisible) return false;
      if (accessFilter === "shared" && device.accessRelation !== t.filters.accessShared.toLowerCase()) return false;
      if (accessFilter === "unresolved" && !device.hasUnresolvedAssociation) return false;
      const matchesFocus = (() => {
        switch (focusFilter) {
          case "review":
            return !device.ownerUserId || !device.status || Object.keys(device.deviceMetadata || {}).length === 0;
          case "no_owner":
            return !device.ownerUserId;
          case "with_owner":
            return Boolean(device.ownerUserId);
          case "no_status":
            return !device.status;
          case "no_metadata":
            return Object.keys(device.deviceMetadata || {}).length === 0;
          case "with_metadata":
            return Object.keys(device.deviceMetadata || {}).length > 0;
          case "online":
            return (device.status || "").toLowerCase().includes("online") || (device.status || "").toLowerCase().includes("active");
          case "with_activity":
            return device.hasOperationalActivity;
          case "without_sync":
            return device.relatedSyncCount === 0;
          default:
            return true;
        }
      })();
      if (!matchesFocus) return false;
      if (!normalized) return true;

      return [
        device.deviceId,
        device.name,
        device.assignmentScope === "home" ? "home" : device.educationalCenterName,
        device.ownerUserName,
        device.ownerUserEmail,
        device.firmwareVersion,
        device.status,
        device.accessRelation,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [accessFilter, deviceRows, focusFilter, institutionFilter, linkedOwnerUserId, query, scopeFilter, scopedInstitutionId, t.filters.accessShared]);

  const selectedDevice = useMemo(
    () => filtered.find((device) => device.id === selectedDeviceId) || deviceRows.find((device) => device.id === selectedDeviceId) || null,
    [deviceRows, filtered, selectedDeviceId],
  );

  async function handleDeleteSelectedDevice() {
    if (!selectedDevice) return;
    if (!canDeleteDevices) return;
    await deleteDeviceMutation.mutateAsync(selectedDevice.id);
    setIsDeleteDialogOpen(false);
  }

  function resetFilters() {
    setQuery("");
    setScopeFilter("all");
    setInstitutionFilter(scopedInstitutionId || "all");
    setFocusFilter("all");
    setAccessFilter("all");
  }

  const pagination = useListPagination(filtered);

  const metrics = useMemo(() => {
    const onlineDevices = deviceRows.filter((device) => (device.status || "").toLowerCase().includes("online") || (device.status || "").toLowerCase().includes("active")).length;
    const homeDevices = deviceRows.filter((device) => device.assignmentScope === "home").length;
    const institutionDevices = deviceRows.filter((device) => device.assignmentScope === "institution").length;
    const devicesWithOwner = deviceRows.filter((device) => Boolean(device.ownerUserId)).length;
    const devicesWithMetadata = deviceRows.filter((device) => Object.keys(device.deviceMetadata || {}).length > 0).length;
    const devicesWithoutOwner = deviceRows.filter((device) => !device.ownerUserId).length;
    const devicesWithoutStatus = deviceRows.filter((device) => !device.status).length;
    const devicesWithoutMetadata = deviceRows.filter((device) => Object.keys(device.deviceMetadata || {}).length === 0).length;
    const reviewDevices = deviceRows.filter((device) => !device.ownerUserId || !device.status || Object.keys(device.deviceMetadata || {}).length === 0).length;

    return {
      total: deviceRows.length,
      onlineDevices,
      homeDevices,
      institutionDevices,
      devicesWithOwner,
      devicesWithMetadata,
      devicesWithoutOwner,
      devicesWithoutStatus,
      devicesWithoutMetadata,
      reviewDevices,
      ownedDevices: deviceRows.filter((device) => device.isOwnedByCurrentUser).length,
      institutionVisibleDevices: deviceRows.filter((device) => device.isInstitutionVisible).length,
      sharedDevices: deviceRows.filter((device) => device.accessRelation === t.filters.accessShared.toLowerCase()).length,
      unresolvedDevices: deviceRows.filter((device) => device.hasUnresolvedAssociation).length,
      devicesWithActivity: deviceRows.filter((device) => device.hasOperationalActivity).length,
      devicesWithoutSync: deviceRows.filter((device) => device.relatedSyncCount === 0).length,
    };
  }, [deviceRows, t.filters.accessShared]);

  const focusSegments = useMemo(
    () => [
      { key: "all" as const, label: language === "en" ? "All" : language === "pt" ? "Todos" : "Todos", count: metrics.total },
      { key: "review" as const, label: t.summaries.review, count: metrics.reviewDevices },
      { key: "no_owner" as const, label: t.summaries.withoutOwner, count: metrics.devicesWithoutOwner },
      { key: "with_owner" as const, label: t.summaries.withOwner, count: metrics.devicesWithOwner },
      { key: "no_status" as const, label: language === "en" ? "No status" : language === "pt" ? "Sem status" : "Sin status", count: metrics.devicesWithoutStatus },
      { key: "no_metadata" as const, label: language === "en" ? "No metadata" : language === "pt" ? "Sem metadata" : "Sin metadata", count: metrics.devicesWithoutMetadata },
      { key: "with_metadata" as const, label: t.summaries.withMetadata, count: metrics.devicesWithMetadata },
      { key: "online" as const, label: t.summaries.online, count: metrics.onlineDevices },
      { key: "with_activity" as const, label: t.summaries.withActivity, count: metrics.devicesWithActivity },
      { key: "without_sync" as const, label: t.summaries.withoutSync, count: metrics.devicesWithoutSync },
    ],
    [language, metrics.devicesWithActivity, metrics.devicesWithMetadata, metrics.devicesWithOwner, metrics.devicesWithoutMetadata, metrics.devicesWithoutOwner, metrics.devicesWithoutStatus, metrics.devicesWithoutSync, metrics.onlineDevices, metrics.reviewDevices, metrics.total, t.summaries.online, t.summaries.review, t.summaries.withActivity, t.summaries.withMetadata, t.summaries.withOwner, t.summaries.withoutOwner, t.summaries.withoutSync],
  );

  const accessSegments = useMemo(
    () => [
      { key: "all" as const, label: language === "en" ? "All" : language === "pt" ? "Todos" : "Todos", count: metrics.total },
      { key: "owned" as const, label: t.filters.accessOwned, count: metrics.ownedDevices },
      { key: "institution" as const, label: t.filters.accessInstitution, count: metrics.institutionVisibleDevices },
      { key: "shared" as const, label: t.filters.accessShared, count: metrics.sharedDevices },
      { key: "unresolved" as const, label: t.filters.accessUnresolved, count: metrics.unresolvedDevices },
    ],
    [language, metrics.institutionVisibleDevices, metrics.ownedDevices, metrics.sharedDevices, metrics.total, metrics.unresolvedDevices, t.filters.accessInstitution, t.filters.accessOwned, t.filters.accessShared, t.filters.accessUnresolved],
  );

  const activeFilterChips = useMemo(
    () => [
      query.trim() ? `${language === "en" ? "Search" : language === "pt" ? "Busca" : "Búsqueda"} · ${query.trim()}` : null,
      scopeFilter !== "all" ? `${t.editor.scope} · ${scopeFilter === "home" ? t.editor.homeLocation : t.editor.institution}` : null,
      institutionFilter !== "all" ? `${t.editor.institution} · ${institutions.find((institution) => institution.id === institutionFilter)?.name || institutionFilter}` : null,
      accessFilter !== "all" ? `${t.table.access} · ${accessSegments.find((segment) => segment.key === accessFilter)?.label || accessFilter}` : null,
      focusFilter !== "all" ? `${language === "en" ? "Focus" : language === "pt" ? "Foco" : "Enfoque"} · ${focusSegments.find((segment) => segment.key === focusFilter)?.label || focusFilter}` : null,
      linkedOwnerUserId ? `${language === "en" ? "User" : language === "pt" ? "Usuário" : "Usuario"} · ${linkedOwnerUserName || linkedOwnerUserId}` : null,
    ].filter((value): value is string => Boolean(value)),
    [accessFilter, accessSegments, focusFilter, focusSegments, institutionFilter, institutions, linkedOwnerUserId, linkedOwnerUserName, query, scopeFilter],
  );

  const institutionFilterDisabled = Boolean(scopedInstitutionId) || scopeFilter === "home";

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={isTeacherView ? t.eyebrow.teacher : isDirectorView ? t.eyebrow.director : isInstitutionScopedView ? t.eyebrow.institutionAdmin : t.eyebrow.default}
        title={t.title}
        description={
          isTeacherView
            ? t.description.teacher
            : isDirectorView
            ? t.description.director(scopedInstitutionName || (language === "en" ? "the institution" : language === "pt" ? "a instituição" : "la institución"))
            : isInstitutionScopedView
            ? t.description.institutionAdmin(scopedInstitutionName || (language === "en" ? "the institution" : language === "pt" ? "a instituição" : "la institución"))
            : t.description.default
        }
        actions={
          <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center md:flex-wrap">
            <div className="relative min-w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.filters.searchPlaceholder}
                className="pl-9"
              />
            </div>
            <select
              value={scopeFilter}
              onChange={(event) => setScopeFilter(event.target.value as "all" | "home" | "institution")}
              className="h-10 min-w-44 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">{t.filters.scopeAll}</option>
              <option value="home">{t.filters.scopeHome}</option>
              <option value="institution">{t.filters.scopeInstitution}</option>
            </select>
            <select
              value={institutionFilter}
              onChange={(event) => setInstitutionFilter(event.target.value)}
              className="h-10 min-w-56 rounded-md border border-input bg-background px-3 text-sm"
              disabled={institutionFilterDisabled}
            >
              <option value="all">{t.filters.allInstitutions}</option>
              {institutions.map((institution) => (
                <option key={institution.id} value={institution.id}>
                  {institution.name}
                </option>
              ))}
            </select>
            <select
              value={accessFilter}
              onChange={(event) => setAccessFilter(event.target.value as "all" | "owned" | "institution" | "shared" | "unresolved")}
              className="h-10 min-w-56 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">{t.filters.accessAll}</option>
              <option value="owned">{t.filters.accessOwned}</option>
              <option value="institution">{t.filters.accessInstitution}</option>
              <option value="shared">{t.filters.accessShared}</option>
              <option value="unresolved">{t.filters.accessUnresolved}</option>
            </select>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground transition hover:bg-accent"
            >
              {t.filters.clearFilters}
            </button>
            {linkedOwnerUserId ? (
              <button
                type="button"
                onClick={() => router.push(pathname)}
                className="inline-flex h-10 items-center justify-center rounded-md border border-primary/20 bg-primary/5 px-4 text-sm font-medium text-primary transition hover:bg-primary/10"
              >
                {t.filters.clearUserFilter}
              </button>
            ) : null}
          </div>
        }
      />

      {(scopedInstitutionName || linkedOwnerUserId) ? (
        <div className="flex flex-wrap gap-2">
          {scopedInstitutionName ? <Badge variant="outline">{t.chips.activeInstitution(scopedInstitutionName)}</Badge> : null}
          {linkedOwnerUserId ? <Badge variant="outline">{t.chips.filteredUser(linkedOwnerUserName || linkedOwnerUserId)}</Badge> : null}
        </div>
      ) : null}

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{t.accessPanel.title}</p>
              <p className="text-sm text-muted-foreground">{t.accessPanel.hint}</p>
            </div>
            <Badge variant="outline">{t.accessPanel.results(filtered.length)}</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
          {accessSegments.map((segment) => (
            <button
              key={segment.key}
              type="button"
              onClick={() => setAccessFilter(segment.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                accessFilter === segment.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-accent",
              )}
            >
              <span>{segment.label}</span>
              <Badge variant={accessFilter === segment.key ? "secondary" : "outline"} className={accessFilter === segment.key ? "bg-white/90 text-foreground" : ""}>
                {segment.count}
              </Badge>
            </button>
          ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {devicesQuery.isLoading ? (
          Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            {isDirectorView ? (
              <>
                <SummaryCard label={t.summaries.devices} value={String(metrics.total)} icon={Smartphone} onSelect={resetFilters} isActive={focusFilter === "all" && accessFilter === "all" && scopeFilter === "all" && institutionFilter === (scopedInstitutionId || "all") && !query.trim()} actionLabel={t.actions.viewAll} activeLabel={t.actions.active} />
                <SummaryCard label={t.summaries.institution} value={String(metrics.institutionDevices)} icon={University} onSelect={() => setScopeFilter("institution")} isActive={scopeFilter === "institution"} actionLabel={t.actions.filter} activeLabel={t.actions.active} />
                <SummaryCard label={t.summaries.online} value={String(metrics.onlineDevices)} icon={Wifi} onSelect={() => setFocusFilter("online")} isActive={focusFilter === "online"} actionLabel={t.actions.focus} activeLabel={t.actions.active} />
                <SummaryCard label={t.summaries.withActivity} value={String(metrics.devicesWithActivity)} icon={ShieldCheck} onSelect={() => setFocusFilter("with_activity")} isActive={focusFilter === "with_activity"} actionLabel={t.actions.focus} activeLabel={t.actions.active} />
                <SummaryCard label={t.summaries.withoutSync} value={String(metrics.devicesWithoutSync)} icon={Wifi} onSelect={() => setFocusFilter("without_sync")} isActive={focusFilter === "without_sync"} actionLabel={t.actions.focus} activeLabel={t.actions.active} />
                <SummaryCard label={t.summaries.withoutOwner} value={String(metrics.devicesWithoutOwner)} icon={UserRound} onSelect={() => setFocusFilter("no_owner")} isActive={focusFilter === "no_owner"} actionLabel={t.actions.focus} activeLabel={t.actions.active} />
                <SummaryCard label={t.summaries.review} value={String(metrics.reviewDevices)} icon={Home} onSelect={() => setFocusFilter("review")} isActive={focusFilter === "review"} actionLabel={t.actions.focus} activeLabel={t.actions.active} />
              </>
            ) : (
              <>
                <SummaryCard label={t.summaries.devices} value={String(metrics.total)} icon={Smartphone} onSelect={resetFilters} isActive={focusFilter === "all" && accessFilter === "all" && scopeFilter === "all" && institutionFilter === (scopedInstitutionId || "all") && !query.trim()} actionLabel={t.actions.viewAll} activeLabel={t.actions.active} />
                <SummaryCard label={t.summaries.home} value={String(metrics.homeDevices)} icon={Home} onSelect={() => setScopeFilter("home")} isActive={scopeFilter === "home"} actionLabel={t.actions.filter} activeLabel={t.actions.active} />
                <SummaryCard label={t.summaries.institution} value={String(metrics.institutionDevices)} icon={University} onSelect={() => setScopeFilter("institution")} isActive={scopeFilter === "institution"} actionLabel={t.actions.filter} activeLabel={t.actions.active} />
                <SummaryCard label={t.summaries.online} value={String(metrics.onlineDevices)} icon={Wifi} onSelect={() => setFocusFilter("online")} isActive={focusFilter === "online"} actionLabel={t.actions.focus} activeLabel={t.actions.active} />
                <SummaryCard label={t.summaries.withoutSync} value={String(metrics.devicesWithoutSync)} icon={Wifi} onSelect={() => setFocusFilter("without_sync")} isActive={focusFilter === "without_sync"} actionLabel={t.actions.focus} activeLabel={t.actions.active} />
                <SummaryCard label={t.summaries.withOwner} value={String(metrics.devicesWithOwner)} icon={UserRound} onSelect={() => setFocusFilter("with_owner")} isActive={focusFilter === "with_owner"} actionLabel={t.actions.focus} activeLabel={t.actions.active} />
                <SummaryCard label={t.summaries.withMetadata} value={String(metrics.devicesWithMetadata)} icon={ShieldCheck} onSelect={() => setFocusFilter("with_metadata")} isActive={focusFilter === "with_metadata"} actionLabel={t.actions.focus} activeLabel={t.actions.active} />
              </>
            )}
          </>
        )}
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm font-medium text-foreground">{t.results.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t.results.summary(filtered.length, metrics.total)}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {activeFilterChips.length > 0 ? activeFilterChips.map((chip) => <Badge key={chip} variant="outline">{chip}</Badge>) : <Badge variant="outline">{t.chips.overview}</Badge>}
            {activeFilterChips.length > 0 ? (
              <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                {t.chips.clear}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{t.focus.title}</p>
              <p className="text-sm text-muted-foreground">{t.focus.hint}</p>
            </div>
            <Button type="button" size="sm" variant="ghost" onClick={() => setFocusFilter("all")}>
              {t.focus.clear}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
          {focusSegments.map((segment) => (
            <button
              key={segment.key}
              type="button"
              onClick={() => setFocusFilter(segment.key)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition",
                focusFilter === segment.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-foreground hover:bg-accent",
              )}
            >
              <span>{segment.label}</span>
              <Badge variant={focusFilter === segment.key ? "secondary" : "outline"} className={focusFilter === segment.key ? "bg-white/90 text-foreground" : ""}>
                {segment.count}
              </Badge>
            </button>
          ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.35fr)_420px]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle>{t.list.title}</CardTitle>
                <CardDescription>
                  {isTeacherView
                    ? t.list.descriptionTeacher
                    : isDirectorView
                    ? t.list.descriptionDirector
                    : t.list.descriptionDefault}
                </CardDescription>
              </div>
              <ListPaginationControls
                pageSize={pagination.pageSize}
                setPageSize={pagination.setPageSize}
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalItems}
                paginationStart={pagination.paginationStart}
                paginationEnd={pagination.paginationEnd}
                goToPreviousPage={pagination.goToPreviousPage}
                goToNextPage={pagination.goToNextPage}
              />
            </div>
          </CardHeader>
          <CardContent className="max-h-[720px] overflow-auto p-0">
            {devicesQuery.isLoading ? (
              <div className="p-6">
                <Skeleton className="h-72 w-full rounded-none" />
              </div>
            ) : devicesQuery.error ? (
              <div className="p-6 text-sm text-destructive">{getErrorMessage(devicesQuery.error)}</div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm">
                  <TableRow>
                    <TableHead>{t.table.name}</TableHead>
                    <TableHead>Device ID</TableHead>
                    <TableHead>{t.table.scope}</TableHead>
                    <TableHead>{t.table.location}</TableHead>
                    <TableHead>{t.table.owner}</TableHead>
                    <TableHead>{t.table.access}</TableHead>
                    <TableHead>{t.table.state}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                        {t.table.empty}
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagination.paginatedItems.map((device) => (
                      <TableRow
                        key={device.id}
                        className={cn("cursor-pointer", selectedDeviceId === device.id && "border-primary/30 bg-primary/8")}
                        onClick={() => setSelectedDeviceId(device.id)}
                      >
                        <TableCell>
                          <div className="flex min-w-0 items-center gap-3">
                            <DeviceAvatar device={device} className="size-10" />
                            <div className="min-w-0">
                              <p className="truncate font-medium text-foreground">{device.name}</p>
                              <p className="truncate text-xs text-muted-foreground">{device.assignmentScope === "home" ? t.table.home : device.educationalCenterName || t.table.institution}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{device.deviceId}</TableCell>
                        <TableCell>{scopeBadge(device)}</TableCell>
                        <TableCell>{locationLabel(device)}</TableCell>
                        <TableCell>{device.ownerUserName || device.ownerUserEmail || t.table.noOwner}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={device.hasUnresolvedAssociation ? "warning" : "outline"}>{device.accessRelation}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {t.table.syncsGames(device.relatedSyncCount, device.relatedGameCount)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={device.status ? "secondary" : "outline"}>{statusLabel(device.status)}</Badge>
                            <span className="text-xs text-muted-foreground">{formatDateTime(device.updatedAt)}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)] 2xl:sticky 2xl:top-6 2xl:self-start">
          <CardHeader>
            <CardTitle>{isTeacherView ? t.detail.titleTeacher : isDirectorView ? t.detail.titleDirector : t.detail.titleDefault}</CardTitle>
            <CardDescription>
              {isTeacherView
                ? t.detail.descriptionTeacher
                : isDirectorView
                ? t.detail.descriptionDirector
                : t.detail.descriptionDefault}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!selectedDevice ? (
              <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
                {t.detail.selectDevice}
              </div>
            ) : (
              <>
                <div className="rounded-2xl bg-background/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <DeviceAvatar device={selectedDevice} className="size-14" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{selectedDevice.name}</p>
                        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{selectedDevice.deviceId}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={selectedDevice.hasUnresolvedAssociation ? "warning" : "outline"}>{selectedDevice.accessRelation}</Badge>
                      {selectedDevice.hasOperationalActivity ? <Badge variant="secondary">{t.detail.visibleActivity}</Badge> : <Badge variant="outline">{t.detail.noVisibleActivity}</Badge>}
                      <Badge variant={selectedDevice.relatedSyncCount > 0 ? "secondary" : "outline"}>
                        {selectedDevice.relatedSyncCount > 0 ? t.detail.hasVisibleSync : t.detail.noVisibleSync}
                      </Badge>
                      {isTeacherView ? (
                        <Badge variant={selectedDevice.isReadyForClassroom ? "secondary" : "warning"}>
                          {selectedDevice.isReadyForClassroom ? t.detail.readyForClassroom : t.detail.reviewRecommended}
                        </Badge>
                      ) : null}
                      {isDirectorView ? (
                        <Badge variant={selectedDevice.reviewReasons.length === 0 ? "secondary" : "warning"}>
                          {selectedDevice.reviewReasons.length === 0 ? t.detail.stable : t.detail.needsFollowUp}
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <p>{t.detail.visibleSyncs(selectedDevice.relatedSyncCount)}</p>
                    <p>{t.detail.visibleGames(selectedDevice.relatedGameCount)}</p>
                    <p>{t.detail.lastVisibleSync(formatDateTime(selectedDevice.lastSyncedAt))}</p>
                    <p>{t.detail.context(selectedDevice.isOwnedByCurrentUser ? t.detail.contextOwner : selectedDevice.isInstitutionVisible ? t.detail.contextInstitution : selectedDevice.hasUnresolvedAssociation ? t.detail.contextMissing : t.detail.contextShared)}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="outline">{selectedDevice.assignmentScope === "home" ? t.editor.homeLocation : locationLabel(selectedDevice)}</Badge>
                    <Badge variant="outline">{selectedDevice.ownerUserName || selectedDevice.ownerUserEmail || t.detail.noOwner}</Badge>
                    <Badge variant="outline">{selectedDevice.firmwareVersion || t.detail.noFirmware}</Badge>
                    {canDeleteDevices ? (
                      <Button type="button" size="sm" variant="destructive" onClick={() => setIsDeleteDialogOpen(true)} disabled={deleteDeviceMutation.isPending}>
                        {t.detail.deleteDevice}
                      </Button>
                    ) : null}
                    <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedDeviceId(null)}>
                      {t.detail.removeSelection}
                    </Button>
                  </div>
                  {deleteDeviceMutation.error ? (
                    <div className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                      {t.detail.deleteError(getErrorMessage(deleteDeviceMutation.error))}
                    </div>
                  ) : null}
                  <div className="mt-4 rounded-2xl border border-border/70 bg-white/80 p-4">
                    <p className="text-sm font-medium text-foreground">{t.detail.quickLinks}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t.detail.quickLinksHint(selectedDevice.name)}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <Link
                        href={buildDeviceRelationHref("/games", selectedDevice)}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        {t.detail.gamesLink}
                      </Link>
                      <Link
                        href={buildDeviceRelationHref("/syncs", selectedDevice)}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        {t.detail.syncsLink}
                      </Link>
                    </div>
                  </div>
                  {isTeacherView || isDirectorView ? (
                    <div className="mt-4 rounded-2xl bg-white/80 p-4 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">{isTeacherView ? t.detail.whatToCheckFirst : t.detail.coordinationSignals}</p>
                      {selectedDevice.reviewReasons.length ? (
                        <ul className="mt-2 space-y-1">
                          {selectedDevice.reviewReasons.map((reason) => (
                            <li key={reason}>• {reason}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2">
                          {isTeacherView
                            ? t.detail.teacherOk
                            : t.detail.directorOk}
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>

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
                  onUpdated={(deviceId) => setSelectedDeviceId(deviceId)}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <DeleteRecordDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteSelectedDevice}
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
