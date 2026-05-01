"use client";

import Link from "next/link";
import { type ComponentType, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Activity, Cpu, HardDriveDownload, Search, Users, Waves } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListPaginationControls, useListPagination } from "@/components/ui/list-pagination-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-context";
import { useDevices } from "@/features/devices/api";
import { useGames } from "@/features/games/api";
import { buildGameDetailHref, buildGamesOverviewHref } from "@/features/games/game-route";
import type { GameRecord } from "@/features/games/types";
import { useLanguage, type AppLanguage } from "@/features/i18n/i18n-context";
import { useSyncSessions } from "@/features/syncs/api";
import { useUsers } from "@/features/users/api";
import { cn, formatDateTime, getErrorMessage } from "@/lib/utils";

const syncsMessages: Record<AppLanguage, {
  eyebrow: {
    default: string;
    teacher: string;
    director: string;
    family: string;
    researcher: string;
    institutionAdmin: string;
    personal: string;
  };
  title: string;
  description: {
    family: string;
    researcher: string;
    teacher: string;
    director: string;
    operational: string;
    personal: string;
  };
  searchPlaceholder: string;
  rawOptions: { all: string; withRaw: string; withoutRaw: string };
  accessOptions: { all: string; owned: string; institution: string; shared: string; unresolved: string };
  clearCrossFilter: string;
  filteredDevice: (name: string) => string;
  accessAvailable: string;
  accessHint: string;
  accessState: { family: string; researcher: string; operational: string; personal: string; teacher: string; director: string; institutionAdmin: string };
  accessDetail: {
    family: string;
    researcher: string;
    teacher: string;
    director: string;
    operational: string;
    personal: string;
  };
  researcherCards: { coverage: { title: string; description: string }; correlation: { title: string; description: string }; associations: { title: string; description: string } };
  familyCards: { activity: { title: string; description: string }; participants: { title: string; description: string }; relation: { title: string; description: string } };
  summaryLabels: { syncs: string; sample: string; withEvidence: string; withParticipants: string; withDevice: string; withVersion: string; unresolved: string };
  listTitles: { default: string; teacher: string; director: string; family: string; researcher: string };
  listDescriptions: { default: string; teacher: string; director: string; family: string; researcher: string };
}> = {
  es: {
    eyebrow: { default: "Trazabilidad", teacher: "Teacher", director: "Director", family: "Family", researcher: "Researcher", institutionAdmin: "Institution admin", personal: "Mi actividad" },
    title: "Sincronizaciones",
    description: {
      family: "Vista simple para seguir la actividad de sincronización reciente, con foco en si hubo captura, participantes y relación básica con las partidas.",
      researcher: "Vista de evidencia sobre `/sync-sessions`, pensada para leer cobertura de captura, correlación con partidas y asociaciones clave sin quedarse solo en el payload raw.",
      teacher: "Vista docente de sincronizaciones, pensada para conectar captura, participantes y dispositivo sin convertir la lectura en una consola técnica.",
      director: "Vista directoral de sincronizaciones, útil para seguir captura, correlación con partidas y señales generales de trazabilidad a nivel institución.",
      operational: "La vista usa `/sync-sessions` como superficie operativa real del parque disponible por ACL BLE, no solo como historial personal del usuario autenticado.",
      personal: "Sin permiso BLE operativo, `/sync-sessions` vuelve a comportarse como historial personal del usuario autenticado.",
    },
    searchPlaceholder: "Filtrar por syncId, origen, mazo, dispositivo o usuario",
    rawOptions: { all: "Todas", withRaw: "Solo con raw", withoutRaw: "Solo sin raw" },
    accessOptions: { all: "Todos los accesos", owned: "Mis dispositivos", institution: "Institución visible", shared: "Compartidas", unresolved: "Sin asociación resuelta" },
    clearCrossFilter: "Quitar filtro cruzado",
    filteredDevice: (name) => `Dispositivo filtrado: ${name}`,
    accessAvailable: "Acceso disponible",
    accessHint: "Priorizá el recorte por tipo de acceso antes de leer trazabilidad fina.",
    accessState: { family: "family", researcher: "researcher", operational: "operativo por ACL BLE", personal: "historial personal", teacher: "teacher", director: "director", institutionAdmin: "institution-admin" },
    accessDetail: {
      family: "La vista simplifica la lectura y deja a mano solo las relaciones más importantes: sincronización, participantes, dispositivo y vínculo con una partida cuando existe.",
      researcher: "La vista mantiene el recorte real disponible y deja explícita la relación entre sync, dispositivo, usuario y partida correlacionada para revisar evidencia de captura sin bajar directo al raw completo.",
      teacher: "La lectura docente deja explícito por qué la sync entra en tu acceso, qué dispositivo la originó y si ya se puede conectar con participantes o una partida asociada.",
      director: "La lectura directoral deja en primer plano cobertura, correlación con partidas y señales generales de trazabilidad para seguimiento institucional.",
      operational: "Los resultados se abren al parque de dispositivos permitido por ACL. Si tu acceso queda limitado a una institución, vas a ver solo syncs de esa institución.",
      personal: "Esta sesión no tiene lectura operativa de BLE, así que la tabla queda limitada a tus propias sincronizaciones.",
    },
    researcherCards: {
      coverage: { title: "Cobertura de captura", description: "Se hace explícito qué parte de la muestra tiene raw disponible y qué parte todavía queda incompleta." },
      correlation: { title: "Correlación con partida", description: "La relación entre sync y partida asociada ayuda a leer continuidad sin saltar entre pantallas para cada caso." },
      associations: { title: "Asociaciones clave", description: "Dispositivo, usuario y participantes quedan resumidos con lenguaje de evidencia y no solo de operación." },
    },
    familyCards: {
      activity: { title: "Actividad reciente", description: "La pantalla muestra si hubo sincronizaciones recientes y qué parte de la experiencia quedó capturada." },
      participants: { title: "Participantes", description: "Cuando hay información disponible, se presenta en lenguaje simple y fácil de seguir." },
      relation: { title: "Relación con partidas", description: "Si una sync puede vincularse con una partida asociada, la conexión queda resumida sin meterse en detalles técnicos." },
    },
    summaryLabels: { syncs: "Syncs", sample: "Muestra sync", withEvidence: "Con evidencia", withParticipants: "Con participantes", withDevice: "Con dispositivo", withVersion: "Con versión", unresolved: "Sin asociación" },
    listTitles: { default: "Sesiones sincronizadas", teacher: "Sincronizaciones para aula", director: "Sincronizaciones para seguimiento", family: "Actividad de sincronización", researcher: "Muestra de sincronizaciones" },
    listDescriptions: {
      default: "Seleccioná una sesión para inspeccionar contexto de dispositivo, usuario, participantes y payload raw más reciente.",
      teacher: "Seleccioná una sincronización para entender rápido dispositivo, participantes y vínculo con partida desde una lectura docente.",
      director: "Seleccioná una sincronización para revisar trazabilidad general, correlación con partida y contexto institucional disponible.",
      family: "Seleccioná una sincronización para ver un resumen simple de participantes, dispositivo y relación con la partida cuando exista.",
      researcher: "Seleccioná una sesión para inspeccionar contexto disponible, participantes proyectados y correlación con partida sin salir del dashboard.",
    },
  },
  en: {
    eyebrow: { default: "Traceability", teacher: "Teacher", director: "Director", family: "Family", researcher: "Researcher", institutionAdmin: "Institution admin", personal: "My activity" },
    title: "Syncs",
    description: {
      family: "Simple view to follow recent sync activity, focusing on capture, participants, and the basic relationship with games.",
      researcher: "Evidence-oriented `/sync-sessions` view to read capture coverage, game correlation, and key associations without staying only at raw payload level.",
      teacher: "Teacher-facing sync view designed to connect capture, participants, and device without turning the reading into a technical console.",
      director: "Director-facing sync view to follow capture, game correlation, and broad traceability signals at institution level.",
      operational: "The view uses `/sync-sessions` as the real operational surface of the BLE-ACL-visible fleet, not only as the authenticated user's personal history.",
      personal: "Without operational BLE permission, `/sync-sessions` behaves again as the authenticated user's personal history.",
    },
    searchPlaceholder: "Filter by syncId, source, deck, device, or user",
    rawOptions: { all: "All", withRaw: "With raw only", withoutRaw: "Without raw only" },
    accessOptions: { all: "All access", owned: "My devices", institution: "Institution-visible", shared: "Shared", unresolved: "Unresolved association" },
    clearCrossFilter: "Clear linked filter",
    filteredDevice: (name) => `Filtered device: ${name}`,
    accessAvailable: "Available access",
    accessHint: "Prioritize the cut by access type before reading fine-grained traceability.",
    accessState: { family: "family", researcher: "researcher", operational: "operational via BLE ACL", personal: "personal history", teacher: "teacher", director: "director", institutionAdmin: "institution-admin" },
    accessDetail: {
      family: "The view simplifies the reading and keeps only the most important relationships at hand: sync, participants, device, and relationship to a game when one exists.",
      researcher: "The view keeps the real available cut and makes explicit the relationship between sync, device, user, and correlated game to review capture evidence without jumping straight to the full raw payload.",
      teacher: "The teacher reading makes explicit why the sync is part of your access, which device originated it, and whether it can already be connected with participants or a related game.",
      director: "The director reading puts coverage, game correlation, and broad traceability signals first for institution follow-up.",
      operational: "Results open up to the device fleet allowed by ACL. If your access is limited to one institution, you'll see only syncs from that institution.",
      personal: "This session has no operational BLE read, so the table is limited to your own syncs.",
    },
    researcherCards: {
      coverage: { title: "Capture coverage", description: "It makes clear which part of the sample has raw data available and which part is still incomplete." },
      correlation: { title: "Game correlation", description: "The relationship between sync and linked game helps read continuity without jumping between screens for each case." },
      associations: { title: "Key associations", description: "Device, user, and participants are summarized with evidence-oriented language, not just operations language." },
    },
    familyCards: {
      activity: { title: "Recent activity", description: "The screen shows whether there were recent syncs and how much of the experience was captured." },
      participants: { title: "Participants", description: "When information is available, it is shown in simple, easy-to-follow language." },
      relation: { title: "Relationship with games", description: "If a sync can be linked to a game, the connection is summarized without diving into technical detail." },
    },
    summaryLabels: { syncs: "Syncs", sample: "Sync sample", withEvidence: "With evidence", withParticipants: "With participants", withDevice: "With device", withVersion: "With version", unresolved: "Unresolved" },
    listTitles: { default: "Synced sessions", teacher: "Syncs for classroom", director: "Syncs for follow-up", family: "Sync activity", researcher: "Sync sample" },
    listDescriptions: {
      default: "Select a session to inspect device, user, participant, and latest raw payload context.",
      teacher: "Select a sync to quickly understand device, participants, and relationship to a game from a teacher-focused reading.",
      director: "Select a sync to review overall traceability, game correlation, and available institution context.",
      family: "Select a sync to see a simple summary of participants, device, and relation to the game when available.",
      researcher: "Select a session to inspect available context, projected participants, and game correlation without leaving the dashboard.",
    },
  },
  pt: {
    eyebrow: { default: "Rastreabilidade", teacher: "Teacher", director: "Director", family: "Family", researcher: "Researcher", institutionAdmin: "Institution admin", personal: "Minha atividade" },
    title: "Sincronizações",
    description: {
      family: "Visão simples para acompanhar a atividade recente de sincronização, com foco em captura, participantes e relação básica com as partidas.",
      researcher: "Visão de evidência sobre `/sync-sessions`, pensada para ler cobertura de captura, correlação com partidas e associações-chave sem ficar apenas no payload raw.",
      teacher: "Visão docente de sincronizações, pensada para conectar captura, participantes e dispositivo sem transformar a leitura em um console técnico.",
      director: "Visão diretiva de sincronizações, útil para acompanhar captura, correlação com partidas e sinais gerais de rastreabilidade no nível institucional.",
      operational: "A visão usa `/sync-sessions` como superfície operacional real do parque disponível por ACL BLE, e não apenas como histórico pessoal do usuário autenticado.",
      personal: "Sem permissão operacional de BLE, `/sync-sessions` volta a se comportar como histórico pessoal do usuário autenticado.",
    },
    searchPlaceholder: "Filtrar por syncId, origem, baralho, dispositivo ou usuário",
    rawOptions: { all: "Todas", withRaw: "Só com raw", withoutRaw: "Só sem raw" },
    accessOptions: { all: "Todos os acessos", owned: "Meus dispositivos", institution: "Instituição visível", shared: "Compartilhadas", unresolved: "Sem associação resolvida" },
    clearCrossFilter: "Remover filtro cruzado",
    filteredDevice: (name) => `Dispositivo filtrado: ${name}`,
    accessAvailable: "Acesso disponível",
    accessHint: "Priorize o recorte por tipo de acesso antes de ler a rastreabilidade fina.",
    accessState: { family: "family", researcher: "researcher", operational: "operacional por ACL BLE", personal: "histórico pessoal", teacher: "teacher", director: "director", institutionAdmin: "institution-admin" },
    accessDetail: {
      family: "A visão simplifica a leitura e deixa à mão apenas as relações mais importantes: sincronização, participantes, dispositivo e vínculo com uma partida quando existir.",
      researcher: "A visão mantém o recorte real disponível e deixa explícita a relação entre sync, dispositivo, usuário e partida correlacionada para revisar evidência de captura sem ir direto ao raw completo.",
      teacher: "A leitura docente deixa explícito por que a sync entra no seu acesso, qual dispositivo a originou e se ela já pode se conectar com participantes ou com uma partida associada.",
      director: "A leitura diretiva coloca em primeiro plano cobertura, correlação com partidas e sinais gerais de rastreabilidade para acompanhamento institucional.",
      operational: "Os resultados se abrem para o parque de dispositivos permitido por ACL. Se o seu acesso ficar limitado a uma instituição, você verá apenas syncs dessa instituição.",
      personal: "Esta sessão não tem leitura operacional de BLE, então a tabela fica limitada às suas próprias sincronizações.",
    },
    researcherCards: {
      coverage: { title: "Cobertura de captura", description: "Fica explícito que parte da amostra tem raw disponível e que parte ainda está incompleta." },
      correlation: { title: "Correlação com partida", description: "A relação entre sync e partida associada ajuda a ler continuidade sem saltar entre telas para cada caso." },
      associations: { title: "Associações-chave", description: "Dispositivo, usuário e participantes ficam resumidos com linguagem de evidência e não só de operação." },
    },
    familyCards: {
      activity: { title: "Atividade recente", description: "A tela mostra se houve sincronizações recentes e que parte da experiência foi capturada." },
      participants: { title: "Participantes", description: "Quando há informação disponível, ela é apresentada em linguagem simples e fácil de seguir." },
      relation: { title: "Relação com partidas", description: "Se uma sync pode ser vinculada a uma partida associada, a conexão fica resumida sem entrar em detalhes técnicos." },
    },
    summaryLabels: { syncs: "Syncs", sample: "Amostra sync", withEvidence: "Com evidência", withParticipants: "Com participantes", withDevice: "Com dispositivo", withVersion: "Com versão", unresolved: "Sem associação" },
    listTitles: { default: "Sessões sincronizadas", teacher: "Sincronizações para sala", director: "Sincronizações para acompanhamento", family: "Atividade de sincronização", researcher: "Amostra de sincronizações" },
    listDescriptions: {
      default: "Selecione uma sessão para inspecionar contexto de dispositivo, usuário, participantes e payload raw mais recente.",
      teacher: "Selecione uma sincronização para entender rapidamente dispositivo, participantes e vínculo com a partida em uma leitura docente.",
      director: "Selecione uma sincronização para revisar rastreabilidade geral, correlação com partida e contexto institucional disponível.",
      family: "Selecione uma sincronização para ver um resumo simples de participantes, dispositivo e relação com a partida quando existir.",
      researcher: "Selecione uma sessão para inspecionar contexto disponível, participantes projetados e correlação com a partida sem sair do dashboard.",
    },
  },
};

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
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
      </CardContent>
    </Card>
  );
}

function getSyncInitials(source?: string | null, deckName?: string | null) {
  return (deckName || source || "Sync")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("") || "SY";
}

function buildSyncGamesHref(sync: {
  bleDeviceId?: string | null;
  deviceId?: string | null;
  device?: { name?: string | null } | null;
  user?: { id?: string | null; fullName?: string | null; email?: string | null } | null;
}) {
  return buildGamesOverviewHref({
    bleDeviceId: sync.bleDeviceId || null,
    deviceId: sync.deviceId || null,
    deviceName: sync.device?.name || null,
    ownerUserId: sync.user?.id || null,
    ownerUserName: sync.user?.fullName || sync.user?.email || null,
  });
}

export function SyncsTable() {
  const { language } = useLanguage();
  const t = syncsMessages[language];
  const { tokens, user: currentUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [rawFilter, setRawFilter] = useState<"all" | "with-raw" | "without-raw">("all");
  const [accessFilter, setAccessFilter] = useState<"all" | "owned" | "institution" | "shared" | "unresolved">("all");
  const [selectedSyncId, setSelectedSyncId] = useState<string | null>(null);
  const linkedBleDeviceId = searchParams.get("bleDeviceId")?.trim() || "";
  const linkedDeviceId = searchParams.get("deviceId")?.trim() || "";
  const linkedDeviceName = searchParams.get("deviceName")?.trim() || "";

  const syncsQuery = useSyncSessions(tokens?.accessToken);
  const devicesQuery = useDevices(tokens?.accessToken);
  const usersQuery = useUsers(tokens?.accessToken);
  const gamesQuery = useGames(tokens?.accessToken);

  const syncs = useMemo(() => syncsQuery.data?.data || [], [syncsQuery.data?.data]);
  const devices = useMemo(() => devicesQuery.data?.data || [], [devicesQuery.data?.data]);
  const users = useMemo(() => usersQuery.data?.data || [], [usersQuery.data?.data]);
  const games = useMemo(() => gamesQuery.data?.data || [], [gamesQuery.data?.data]);

  const currentPermissionKeys = useMemo(() => new Set(currentUser?.permissions || []), [currentUser?.permissions]);
  const hasGlobalAdminRole = currentUser?.roles.includes("admin") || false;
  const hasResolvedCapabilities = hasGlobalAdminRole || currentPermissionKeys.size > 0;

  function hasAnyPermission(...keys: string[]) {
    if (hasGlobalAdminRole) return true;
    if (!hasResolvedCapabilities) return true;
    return keys.some((key) => currentPermissionKeys.has(key));
  }

  const canReadOperationalSyncs = hasAnyPermission("ble_device:read", "ble-device:read");
  const isInstitutionAdminView = currentUser?.roles.includes("institution-admin") || false;
  const isResearcherView = currentUser?.roles.includes("researcher") || false;
  const isFamilyView = currentUser?.roles.includes("family") || false;
  const isTeacherView = currentUser?.roles.includes("teacher") || false;
  const isDirectorView = currentUser?.roles.includes("director") || false;

  const deviceById = useMemo(() => new Map(devices.map((device) => [device.id, device])), [devices]);
  const userById = useMemo(() => new Map(users.map((user) => [user.id, user])), [users]);
  const gameById = useMemo(() => {
    const entries: Array<[string, GameRecord]> = [];

    games.forEach((game) => {
      entries.push([String(game.id), game]);
      if (game.gameId != null) {
        entries.push([String(game.gameId), game]);
      }
    });

    return new Map<string, GameRecord>(entries);
  }, [games]);

  const syncRows = useMemo(() => {
    const currentUserEmail = (currentUser?.email || "").trim().toLowerCase();

    return syncs.map((sync) => {
      const device = sync.bleDeviceId ? deviceById.get(sync.bleDeviceId) : null;
      const user = sync.userId ? userById.get(sync.userId) : null;
      const matchedGame = sync.gameId ? gameById.get(String(sync.gameId)) : null;
      const hasRaw = (sync.rawRecordCount || sync.rawRecordIds.length || 0) > 0 || Object.keys(sync.rawPayload || {}).length > 0;

      const isOwnedByCurrentUser = Boolean(
        device && (
          (currentUser?.id && device.ownerUserId === currentUser.id)
          || (currentUserEmail && (device.ownerUserEmail || "").trim().toLowerCase() === currentUserEmail)
        ),
      );
      const isInstitutionVisible = Boolean(
        device?.educationalCenterId
        && currentUser?.educationalCenterId
        && device.educationalCenterId === currentUser.educationalCenterId,
      );

      const accessRelation = !canReadOperationalSyncs
        ? "historial personal"
        : isOwnedByCurrentUser
          ? "mis dispositivos"
          : isInstitutionVisible
            ? "institución visible"
            : device?.ownerUserId || device?.ownerUserEmail
              ? "compartido visible"
              : "sin asociación resuelta";

      return {
        ...sync,
        device,
        user,
        matchedGame,
        hasRaw,
        accessRelation,
        isOwnedByCurrentUser,
        isInstitutionVisible,
        hasUnresolvedAssociation: !device || accessRelation === "sin asociación resuelta",
        participantCount: sync.participants.length || sync.totalPlayers || 0,
        evidenceState: hasRaw ? "con evidencia" : "sin evidencia",
      };
    });
  }, [canReadOperationalSyncs, currentUser, deviceById, gameById, syncs, userById]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return syncRows.filter((sync) => {
      if (linkedBleDeviceId && sync.bleDeviceId !== linkedBleDeviceId) return false;
      if (linkedDeviceId && sync.deviceId !== linkedDeviceId && sync.device?.deviceId !== linkedDeviceId) return false;
      if (rawFilter === "with-raw" && !sync.hasRaw) return false;
      if (rawFilter === "without-raw" && sync.hasRaw) return false;
      if (accessFilter === "owned" && !sync.isOwnedByCurrentUser) return false;
      if (accessFilter === "institution" && !sync.isInstitutionVisible) return false;
      if (accessFilter === "shared" && sync.accessRelation !== "compartido visible") return false;
      if (accessFilter === "unresolved" && !sync.hasUnresolvedAssociation) return false;
      if (!normalized) return true;

      return [
        sync.syncId,
        sync.source,
        sync.sourceType,
        sync.deckName,
        sync.deviceId,
        sync.bleDeviceId,
        sync.firmwareVersion,
        sync.device?.name,
        sync.device?.deviceId,
        sync.user?.fullName,
        sync.user?.email,
        sync.accessRelation,
        sync.matchedGame?.deckName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [accessFilter, linkedBleDeviceId, linkedDeviceId, query, rawFilter, syncRows]);

  const pagination = useListPagination(filtered);

  const selectedSync = useMemo(
    () => filtered.find((sync) => sync.id === selectedSyncId) || syncRows.find((sync) => sync.id === selectedSyncId) || null,
    [filtered, selectedSyncId, syncRows],
  );

  const metrics = useMemo(() => {
    const withRaw = syncs.filter((sync) => (sync.rawRecordCount || sync.rawRecordIds.length || 0) > 0 || Object.keys(sync.rawPayload || {}).length > 0).length;
    const withParticipants = syncs.filter((sync) => sync.participants.length > 0).length;
    const withDeviceLink = syncs.filter((sync) => Boolean(sync.bleDeviceId || sync.deviceId)).length;
    const withFirmware = syncs.filter((sync) => Boolean(sync.firmwareVersion)).length;

    return {
      total: syncs.length,
      withRaw,
      withParticipants,
      withDeviceLink,
      withFirmware,
      ownedSyncs: syncRows.filter((sync) => sync.isOwnedByCurrentUser).length,
      institutionSyncs: syncRows.filter((sync) => sync.isInstitutionVisible).length,
      unresolvedAssociations: syncRows.filter((sync) => sync.hasUnresolvedAssociation).length,
      matchedGames: syncRows.filter((sync) => Boolean(sync.matchedGame)).length,
    };
  }, [syncRows, syncs]);

  const selectedDevice = selectedSync?.device || null;
  const selectedUser = selectedSync?.user || null;
  const selectedRawKeys = Object.keys(selectedSync?.rawPayload || {});
  const accessSegments = [
    { key: "all" as const, label: t.accessOptions.all, count: metrics.total },
    { key: "owned" as const, label: t.accessOptions.owned, count: metrics.ownedSyncs },
    { key: "institution" as const, label: t.accessOptions.institution, count: metrics.institutionSyncs },
    { key: "shared" as const, label: t.accessOptions.shared, count: syncRows.filter((sync) => sync.accessRelation === "compartido visible").length },
    { key: "unresolved" as const, label: t.accessOptions.unresolved, count: metrics.unresolvedAssociations },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={isFamilyView ? t.eyebrow.family : isResearcherView ? t.eyebrow.researcher : canReadOperationalSyncs ? (isTeacherView ? t.eyebrow.teacher : isDirectorView ? t.eyebrow.director : isInstitutionAdminView ? t.eyebrow.institutionAdmin : t.eyebrow.default) : isTeacherView ? t.eyebrow.teacher : t.eyebrow.personal}
        title={t.title}
        description={
          isFamilyView
            ? t.description.family
            : isResearcherView
            ? t.description.researcher
            : canReadOperationalSyncs
            ? isTeacherView
              ? t.description.teacher
              : isDirectorView
              ? t.description.director
              : t.description.operational
            : t.description.personal
        }
        actions={
          <div className="grid w-full gap-3 md:grid-cols-2 2xl:grid-cols-[minmax(0,1.45fr)_minmax(220px,0.8fr)_minmax(220px,0.8fr)]">
            <div className="relative min-w-0 md:col-span-2 2xl:col-span-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t.searchPlaceholder}
                className="w-full pl-9"
              />
            </div>
            {isFamilyView ? null : (
              <>
                <select
                  value={rawFilter}
                  onChange={(event) => setRawFilter(event.target.value as "all" | "with-raw" | "without-raw")}
                  className="h-10 min-w-0 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">{t.rawOptions.all}</option>
                  <option value="with-raw">{t.rawOptions.withRaw}</option>
                  <option value="without-raw">{t.rawOptions.withoutRaw}</option>
                </select>
                <select
                  value={accessFilter}
                  onChange={(event) => setAccessFilter(event.target.value as "all" | "owned" | "institution" | "shared" | "unresolved")}
                  className="h-10 min-w-0 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">{t.accessOptions.all}</option>
                  <option value="owned">{t.accessOptions.owned}</option>
                  <option value="institution">{t.accessOptions.institution}</option>
                  <option value="shared">{t.accessOptions.shared}</option>
                  <option value="unresolved">{t.accessOptions.unresolved}</option>
                </select>
                {linkedBleDeviceId || linkedDeviceId ? (
                  <button
                    type="button"
                    onClick={() => router.push(pathname)}
                    className="inline-flex h-10 min-w-0 items-center justify-center rounded-md border border-primary/20 bg-primary/5 px-3 text-sm font-medium text-primary transition hover:bg-primary/10"
                  >
                    {t.clearCrossFilter}
                  </button>
                ) : null}
              </>
            )}
          </div>
        }
      />

      {linkedBleDeviceId || linkedDeviceId ? (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{t.filteredDevice(linkedDeviceName || linkedDeviceId || linkedBleDeviceId)}</Badge>
        </div>
      ) : null}

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">{t.accessAvailable}</p>
              <Badge variant={isFamilyView || isResearcherView || canReadOperationalSyncs ? "secondary" : "outline"}>
                {isFamilyView ? t.accessState.family : isResearcherView ? t.accessState.researcher : canReadOperationalSyncs ? t.accessState.operational : t.accessState.personal}
              </Badge>
              {isTeacherView && canReadOperationalSyncs ? <Badge variant="outline">{t.accessState.teacher}</Badge> : null}
              {isDirectorView && canReadOperationalSyncs ? <Badge variant="outline">{t.accessState.director}</Badge> : null}
              {isInstitutionAdminView ? <Badge variant="outline">{t.accessState.institutionAdmin}</Badge> : null}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {isFamilyView
                ? t.accessDetail.family
                : isResearcherView
                ? t.accessDetail.researcher
                : canReadOperationalSyncs
                ? isTeacherView
                  ? t.accessDetail.teacher
                  : isDirectorView
                  ? t.accessDetail.director
                  : t.accessDetail.operational
                : t.accessDetail.personal}
            </p>
          </div>
        </CardContent>
      </Card>

      {isResearcherView ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="grid gap-3 p-5 md:grid-cols-3">
            <div className="rounded-2xl bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">{t.researcherCards.coverage.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.researcherCards.coverage.description}</p>
            </div>
            <div className="rounded-2xl bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">{t.researcherCards.correlation.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.researcherCards.correlation.description}</p>
            </div>
            <div className="rounded-2xl bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">{t.researcherCards.associations.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.researcherCards.associations.description}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isFamilyView ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="grid gap-3 p-5 md:grid-cols-3">
            <div className="rounded-2xl bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">{t.familyCards.activity.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.familyCards.activity.description}</p>
            </div>
            <div className="rounded-2xl bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">{t.familyCards.participants.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.familyCards.participants.description}</p>
            </div>
            <div className="rounded-2xl bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">{t.familyCards.relation.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.familyCards.relation.description}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {isFamilyView ? null : (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">{t.accessAvailable}</p>
                <p className="text-sm text-muted-foreground">{t.accessHint}</p>
              </div>
              <Badge variant="outline">{filtered.length} resultados</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
            {accessSegments.map((segment) => (
              <button
                key={segment.key}
                type="button"
                onClick={() => setAccessFilter(segment.key)}
                className={cn(
                  "inline-flex w-full items-center justify-between gap-2 rounded-full border px-4 py-2 text-left text-sm font-medium transition sm:w-auto sm:justify-center",
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
      )}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {syncsQuery.isLoading ? (
          Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard label={isResearcherView ? t.summaryLabels.sample : t.summaryLabels.syncs} value={String(metrics.total)} icon={Activity} />
            <SummaryCard label={t.summaryLabels.withEvidence} value={String(metrics.withRaw)} icon={HardDriveDownload} />
            <SummaryCard label={t.summaryLabels.withParticipants} value={String(metrics.withParticipants)} icon={Users} />
            <SummaryCard label={t.summaryLabels.withDevice} value={String(metrics.withDeviceLink)} icon={Waves} />
            <SummaryCard label={isFamilyView ? t.summaryLabels.withVersion : t.summaryLabels.unresolved} value={String(isFamilyView ? metrics.withFirmware : metrics.unresolvedAssociations)} icon={isFamilyView ? Cpu : Activity} />
          </>
        )}
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.35fr)_420px]">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle>{isFamilyView ? t.listTitles.family : isResearcherView ? t.listTitles.researcher : isTeacherView ? t.listTitles.teacher : isDirectorView ? t.listTitles.director : t.listTitles.default}</CardTitle>
                <CardDescription>
                  {isFamilyView
                    ? t.listDescriptions.family
                    : isResearcherView
                    ? t.listDescriptions.researcher
                    : isTeacherView
                    ? t.listDescriptions.teacher
                    : isDirectorView
                    ? t.listDescriptions.director
                    : t.listDescriptions.default}
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
          <CardContent className="overflow-x-auto p-0">
            {syncsQuery.isLoading ? (
              <div className="p-6">
                <Skeleton className="h-72 w-full rounded-none" />
              </div>
            ) : syncsQuery.error ? (
              <div className="p-6 text-sm text-destructive">{getErrorMessage(syncsQuery.error)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sync ID</TableHead>
                    <TableHead>Origen</TableHead>
                    <TableHead>Dispositivo</TableHead>
                    {isFamilyView ? null : <TableHead>Usuario</TableHead>}
                    {isFamilyView ? null : <TableHead>Acceso</TableHead>}
                    <TableHead>Participantes</TableHead>
                    <TableHead>Raw</TableHead>
                    <TableHead>Sincronizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isFamilyView ? 6 : 8} className="py-10 text-center text-sm text-muted-foreground">
                        No hay sincronizaciones para mostrar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    pagination.paginatedItems.map((sync) => {
                      return (
                        <TableRow
                          key={sync.id}
                          className={cn("cursor-pointer", selectedSyncId === sync.id && "border-primary/30 bg-primary/8")}
                          onClick={() => setSelectedSyncId(sync.id)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-white text-[11px] font-semibold text-primary">
                                {getSyncInitials(sync.source || sync.sourceType, sync.deckName)}
                              </div>
                              <div className="min-w-0">
                                <p className="max-w-40 truncate font-mono text-xs text-foreground">{sync.syncId || sync.id}</p>
                                <p className="text-xs text-muted-foreground">{sync.evidenceState}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <Badge variant="secondary">{sync.source || sync.sourceType || "desconocido"}</Badge>
                              {sync.matchedGame ? <Badge variant="outline">partida asociada</Badge> : null}
                            </div>
                          </TableCell>
                          <TableCell>{sync.device?.name || sync.deviceId || sync.bleDeviceId || "-"}</TableCell>
                          {isFamilyView ? null : <TableCell>{sync.user?.fullName || sync.user?.email || sync.userId || "-"}</TableCell>}
                          {isFamilyView ? null : (
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <Badge variant={sync.hasUnresolvedAssociation ? "warning" : "outline"}>{sync.accessRelation}</Badge>
                                {sync.matchedGame ? <span className="text-xs text-muted-foreground">partida {sync.matchedGame.gameId || sync.matchedGame.id}</span> : null}
                              </div>
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant="secondary">{sync.participantCount}</Badge>
                              <Badge variant={sync.hasRaw ? "success" : "outline"}>{sync.hasRaw ? "con evidencia" : "sin evidencia"}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={sync.hasRaw ? "success" : "outline"}>{sync.hasRaw ? "disponible" : "pendiente"}</Badge>
                          </TableCell>
                          <TableCell>{formatDateTime(sync.syncedAt || sync.receivedAt || sync.startedAt)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>{isFamilyView ? "Resumen de sincronización" : isResearcherView ? "Detalle de evidencia" : isTeacherView ? "Detalle para aula" : isDirectorView ? "Detalle de seguimiento" : "Detalle de sync"}</CardTitle>
            <CardDescription>
              {isFamilyView
                ? "Resumen simple para entender qué se sincronizó, quiénes aparecen y si hay evidencia asociada."
                : isResearcherView
                ? "Panel para revisar rápidamente relaciones clave entre sync, usuario, dispositivo, participantes y evidencia cruda asociada."
                : isTeacherView
                ? "Panel docente para revisar rápido quién sincronizó, con qué dispositivo y si ya hay participantes o partida asociada."
                : isDirectorView
                ? "Panel de seguimiento para revisar correlación entre sync, dispositivo, participantes y evidencia cruda sin entrar en lectura excesivamente técnica."
                : "Panel operativo para revisar rápidamente quién sincronizó, con qué dispositivo y qué evidencia raw quedó asociada."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!selectedSync ? (
              <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
                {isFamilyView ? "Elegí una sincronización para revisar un resumen simple de actividad." : isResearcherView ? "Elegí una sincronización para revisar su detalle de evidencia." : isTeacherView ? "Elegí una sincronización para revisar su detalle de aula." : isDirectorView ? "Elegí una sincronización para revisar su detalle de seguimiento." : "Elegí una sincronización para revisar su detalle."}
              </div>
            ) : (
              <>
                <div className="rounded-2xl bg-background/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-white text-sm font-semibold text-primary">
                        {getSyncInitials(selectedSync.source || selectedSync.sourceType, selectedSync.deckName)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{selectedSync.deckName || selectedSync.syncId || selectedSync.id}</p>
                        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{selectedSync.syncId || selectedSync.id}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">{selectedSync.source || selectedSync.sourceType || "desconocido"}</Badge>
                      <Badge variant={selectedSync.hasUnresolvedAssociation ? "warning" : "outline"}>{selectedSync.hasUnresolvedAssociation ? "revisar asociación" : "asociación resuelta"}</Badge>
                      <Badge variant={selectedRawKeys.length > 0 || (selectedSync.rawRecordCount || 0) > 0 ? "success" : "outline"}>
                        raw {(selectedSync.rawRecordCount || selectedSync.rawRecordIds.length || 0) > 0 ? "disponible" : "pendiente"}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    {isFamilyView ? null : <p>Usuario: {selectedUser?.fullName || selectedUser?.email || selectedSync.userId || "-"}</p>}
                    <p>Dispositivo: {selectedDevice?.name || selectedSync.deviceId || selectedSync.bleDeviceId || "-"}</p>
                    {isFamilyView ? null : <p>Relación de acceso: {selectedSync.accessRelation}</p>}
                    <p>Partida correlacionada: {selectedSync.matchedGame?.deckName || selectedSync.gameId || "sin partida asociada"}</p>
                    <p>Firmware: {selectedSync.firmwareVersion || "sin firmware"}</p>
                    <p>App: {selectedSync.appVersion || "sin versión"}</p>
                    <p>Participantes: {selectedSync.participants.length || selectedSync.totalPlayers || 0}</p>
                    <p>Evidencia: {selectedSync.hasRaw ? "con evidencia" : "sin evidencia"}</p>
                    <p>Sincronizado: {formatDateTime(selectedSync.syncedAt || selectedSync.receivedAt || selectedSync.startedAt)}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-white/80 p-4">
                  <p className="text-sm font-medium text-foreground">Cruces rápidos</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Saltá a la partida relacionada o al listado ya filtrado por este dispositivo sin rehacer la búsqueda.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {selectedSync.matchedGame ? (
                      <Link
                        href={buildGameDetailHref({
                          gameRecordId: selectedSync.matchedGame.id,
                          bleDeviceId: selectedSync.bleDeviceId || null,
                          deviceId: selectedSync.deviceId || null,
                          deviceName: selectedDevice?.name || null,
                          ownerUserId: selectedUser?.id || null,
                          ownerUserName: selectedUser?.fullName || selectedUser?.email || null,
                        })}
                        className={buttonVariants({ variant: "outline", size: "sm" })}
                      >
                        Abrir partida correlacionada
                      </Link>
                    ) : null}
                    {selectedSync.bleDeviceId || selectedSync.deviceId ? (
                      <Link href={buildSyncGamesHref(selectedSync)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                        Ver partidas del dispositivo
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setSelectedSyncId(null)}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      Quitar selección
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">{isFamilyView ? "Participantes" : isResearcherView ? "Participantes y asociaciones clave" : isTeacherView ? "Participantes y contexto de aula" : isDirectorView ? "Participantes y contexto institucional" : "Participantes y asociaciones"}</p>
                  <div className="mt-3 max-h-[320px] space-y-3 overflow-y-auto pr-1">
                    {selectedSync.participants.length === 0 ? (
                      <div className="rounded-2xl bg-background/70 p-3 text-sm text-muted-foreground">Sin participantes proyectados.</div>
                    ) : (
                      selectedSync.participants.map((participant, index) => (
                        <div key={`${participant.id || participant.profileId || participant.playerName || index}`} className="rounded-2xl bg-background/70 p-3 text-sm">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-foreground">{participant.playerName || participant.profileName || participant.profileId || `Jugador ${index + 1}`}</p>
                              <p className="text-xs text-muted-foreground">{participant.studentId || participant.externalPlayerUid || participant.id || "sin id enlazado"}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {participant.cardUid ? <Badge variant="outline">card {participant.cardUid}</Badge> : null}
                              {participant.position != null ? <Badge variant="outline">posición {participant.position}</Badge> : null}
                              {participant.profileId ? <Badge variant="secondary">perfil vinculado</Badge> : <Badge variant="outline">sin perfil</Badge>}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">{isFamilyView ? "Señales de sincronización" : isResearcherView ? "Señales de evidencia" : isTeacherView ? "Señales útiles para aula" : isDirectorView ? "Señales de seguimiento" : "Señales de trazabilidad"}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-background/70 p-3 text-sm text-muted-foreground">raw ids: <span className="font-medium text-foreground">{String(selectedSync.rawRecordCount || selectedSync.rawRecordIds.length || 0)}</span></div>
                    <div className="rounded-2xl bg-background/70 p-3 text-sm text-muted-foreground">fragmentos: <span className="font-medium text-foreground">{String(selectedSync.rawFragmentCount || 0)}</span></div>
                    <div className="rounded-2xl bg-background/70 p-3 text-sm text-muted-foreground">payload keys: <span className="font-medium text-foreground">{String(selectedRawKeys.length)}</span></div>
                    <div className="rounded-2xl bg-background/70 p-3 text-sm text-muted-foreground">match con partida: <span className="font-medium text-foreground">{selectedSync.matchedGame ? "sí" : "no"}</span></div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">{isFamilyView ? "Detalle disponible" : isResearcherView ? "Payload raw disponible" : "Payload raw más reciente"}</p>
                  <div className="mt-3 max-h-[360px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
                    <pre className="whitespace-pre-wrap">{JSON.stringify(selectedSync.rawPayload || {}, null, 2)}</pre>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
