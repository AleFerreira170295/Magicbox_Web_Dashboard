"use client";

import { type ComponentType, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Gamepad2, Search, TimerReset, Trophy, Users } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ListPaginationControls, useListPagination } from "@/components/ui/list-pagination-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-context";
import { useDevices } from "@/features/devices/api";
import { useGames } from "@/features/games/api";
import { buildGameDetailHref, type GameAccessFilter, type GamePlayerModeFilter } from "@/features/games/game-route";
import { buildGameRows } from "@/features/games/game-view";
import { useLanguage, type AppLanguage } from "@/features/i18n/i18n-context";
import { useInstitutions } from "@/features/institutions/api";
import { cn, formatDateTime, getErrorMessage } from "@/lib/utils";

const gamesMessages: Record<AppLanguage, {
  eyebrow: {
    default: string;
    teacher: string;
    director: string;
    family: string;
    researcher: string;
    institutionAdmin: string;
  };
  title: string;
  description: {
    default: string;
    teacher: string;
    director: (institutionName: string) => string;
    family: string;
    researcher: string;
    institutionAdmin: (institutionName: string) => string;
  };
  searchPlaceholder: string;
  allInstitutions: string;
  playerModes: {
    all: string;
    registered: string;
    manual: string;
    mixed: string;
  };
  accessOptions: {
    all: string;
    owned: string;
    institution: string;
    shared: string;
    unresolved: string;
  };
  clearCrossFilter: string;
  activeInstitution: (name: string) => string;
  filteredUser: (name: string) => string;
  filteredDevice: (name: string) => string;
  researcherCards: {
    sample: { title: string; description: string };
    associations: { title: string; description: string };
    turns: { title: string; description: string };
  };
  accessAvailable: string;
  accessHint: string;
  results: string;
  allView: string;
  clear: string;
  resultsSummary: (filtered: number, total: number) => string;
  listTitles: {
    default: string;
    teacher: string;
    director: string;
    family: string;
    researcher: string;
  };
  listDescriptions: {
    default: string;
    teacher: string;
    director: string;
    family: string;
    researcher: string;
  };
  table: {
    deck: string;
    institution: string;
    device: string;
    access: string;
    players: string;
    turns: string;
    start: string;
    empty: string;
  };
  summaryLabels: {
    games: string;
    sample: string;
    players: string;
    turns: string;
    decks: string;
    mixedSample: string;
    mixedGames: string;
    successRate: string;
    unresolved: string;
  };
  actionLabels: {
    focus: string;
    active: string;
    seeAll: string;
  };
}> = {
  es: {
    eyebrow: { default: "Juego", teacher: "Teacher", director: "Director", family: "Family", researcher: "Researcher", institutionAdmin: "Institution admin" },
    title: "Partidas",
    description: {
      default: "Vista de partidas con contexto de institución, dispositivo, jugadores y desempeño, para seguir el recorrido de sync a partida con una lectura clara.",
      teacher: "Vista de aula para el docente, priorizando qué se jugó, con quién y desde qué dispositivo para conectar rápido actividad y contexto.",
      director: (institutionName) => `Vista de seguimiento institucional de partidas para ${institutionName}, enfocada en volumen, mezcla de participantes y señales generales sin ruido técnico.`,
      family: "Vista simple para entender sesiones, participantes y ritmo general sin entrar en detalle técnico innecesario.",
      researcher: "Vista de muestra de partidas para leer composición, asociaciones y densidad de turnos sin mezclarlo con operación de aula.",
      institutionAdmin: (institutionName) => `Vista de partidas para ${institutionName}, alineada al acceso institucional disponible.`,
    },
    searchPlaceholder: "Filtrar por mazo, gameId, institución, dispositivo o jugador",
    allInstitutions: "Todas las instituciones",
    playerModes: { all: "Todos los modos", registered: "Solo registrados", manual: "Solo manuales", mixed: "Mixtos" },
    accessOptions: { all: "Todos los accesos", owned: "Mis dispositivos", institution: "Institución visible", shared: "Compartidas", unresolved: "Sin asociación resuelta" },
    clearCrossFilter: "Quitar filtro cruzado",
    activeInstitution: (name) => `Institución activa: ${name}`,
    filteredUser: (name) => `Usuario filtrado: ${name}`,
    filteredDevice: (name) => `Dispositivo filtrado: ${name}`,
    researcherCards: {
      sample: { title: "Composición de muestra", description: "Leé rápido cuántas sesiones combinan manuales y registrados, y cómo queda representada la muestra disponible." },
      associations: { title: "Asociaciones clave", description: "La relación entre partida, dispositivo y responsable queda clara para interpretar cada caso sin ambigüedades." },
      turns: { title: "Turnos observables", description: "La muestra destaca densidad de turnos, tasa de éxito y contexto de jugador con una lectura directa." },
    },
    accessAvailable: "Acceso disponible",
    accessHint: "Recortá la muestra por tipo de acceso antes de abrir una partida.",
    results: "Resultados",
    allView: "Vista general",
    clear: "Limpiar",
    resultsSummary: (filtered, total) => `${filtered} de ${total} partidas con el recorte actual.`,
    listTitles: { default: "Listado de partidas", teacher: "Partidas para aula", director: "Partidas para seguimiento", family: "Actividad reciente", researcher: "Muestra de partidas" },
    listDescriptions: {
      default: "Abrí una partida para entrar a su detalle dedicado sin perder el contexto del recorte actual.",
      teacher: "Abrí una partida para entrar a su pantalla dedicada con contexto del dispositivo, participantes y desempeño.",
      director: "Abrí una partida para revisar contexto institucional, navegación relacionada y desempeño turno a turno.",
      family: "Abrí una partida para ver su detalle dedicado con participantes, turnos y ritmo general.",
      researcher: "Abrí una partida para revisar composición, turnos, navegación relacionada y gráfico de resultados por turno.",
    },
    table: { deck: "Mazo", institution: "Institución", device: "Dispositivo", access: "Acceso", players: "Jugadores", turns: "Turnos", start: "Inicio", empty: "No hay partidas para mostrar." },
    summaryLabels: { games: "Partidas", sample: "Muestra", players: "Jugadores", turns: "Turnos", decks: "Mazos", mixedSample: "Muestra mixta", mixedGames: "Mixtas", successRate: "Tasa de aciertos", unresolved: "Sin asociación" },
    actionLabels: { focus: "Ver foco", active: "Foco activo", seeAll: "Ver todas" },
  },
  en: {
    eyebrow: { default: "Games", teacher: "Teacher", director: "Director", family: "Family", researcher: "Researcher", institutionAdmin: "Institution admin" },
    title: "Games",
    description: {
      default: "Game view with institution, device, player and performance context to follow the path from sync to game with a clear reading.",
      teacher: "Classroom view for teachers, prioritizing what was played, with whom, and from which device so activity and context connect quickly.",
      director: (institutionName) => `Institution-level games view for ${institutionName}, focused on volume, participant mix, and broad signals without technical noise.`,
      family: "Simple view to understand sessions, participants, and overall pace without unnecessary technical detail.",
      researcher: "Sample-oriented game view to read composition, associations, and turn density without mixing in classroom operations.",
      institutionAdmin: (institutionName) => `Games view for ${institutionName}, aligned with the available institutional access.`,
    },
    searchPlaceholder: "Filter by deck, gameId, institution, device, or player",
    allInstitutions: "All institutions",
    playerModes: { all: "All modes", registered: "Registered only", manual: "Manual only", mixed: "Mixed" },
    accessOptions: { all: "All access", owned: "My devices", institution: "Institution-visible", shared: "Shared", unresolved: "Unresolved association" },
    clearCrossFilter: "Clear linked filter",
    activeInstitution: (name) => `Active institution: ${name}`,
    filteredUser: (name) => `Filtered user: ${name}`,
    filteredDevice: (name) => `Filtered device: ${name}`,
    researcherCards: {
      sample: { title: "Sample composition", description: "Quickly read how many sessions combine manual and registered players and how the available sample is represented." },
      associations: { title: "Key associations", description: "The relationship between game, device, and responsible person stays clear so each case is easy to interpret." },
      turns: { title: "Observable turns", description: "The sample highlights turn density, success rate, and player context with a direct reading." },
    },
    accessAvailable: "Available access",
    accessHint: "Trim the sample by access type before opening a game.",
    results: "Results",
    allView: "Overview",
    clear: "Clear",
    resultsSummary: (filtered, total) => `${filtered} of ${total} games match the current view.`,
    listTitles: { default: "Games list", teacher: "Games for classroom", director: "Games for follow-up", family: "Recent activity", researcher: "Game sample" },
    listDescriptions: {
      default: "Open a game to enter its dedicated detail without losing the current filter context.",
      teacher: "Open a game to enter its dedicated screen with device, participant, and performance context.",
      director: "Open a game to review institution context, related navigation, and turn-by-turn performance.",
      family: "Open a game to see its dedicated detail with participants, turns, and overall pace.",
      researcher: "Open a game to review composition, turns, related navigation, and turn-result chart.",
    },
    table: { deck: "Deck", institution: "Institution", device: "Device", access: "Access", players: "Players", turns: "Turns", start: "Start", empty: "No games to show." },
    summaryLabels: { games: "Games", sample: "Sample", players: "Players", turns: "Turns", decks: "Decks", mixedSample: "Mixed sample", mixedGames: "Mixed", successRate: "Success rate", unresolved: "Unresolved" },
    actionLabels: { focus: "View focus", active: "Active focus", seeAll: "View all" },
  },
  pt: {
    eyebrow: { default: "Partidas", teacher: "Teacher", director: "Director", family: "Family", researcher: "Researcher", institutionAdmin: "Institution admin" },
    title: "Partidas",
    description: {
      default: "Visão de partidas com contexto de instituição, dispositivo, jogadores e desempenho para seguir o percurso de sync até a partida com leitura clara.",
      teacher: "Visão de sala para docentes, priorizando o que foi jogado, com quem e em qual dispositivo para conectar rapidamente atividade e contexto.",
      director: (institutionName) => `Visão institucional de partidas para ${institutionName}, focada em volume, mistura de participantes e sinais gerais sem ruído técnico.`,
      family: "Visão simples para entender sessões, participantes e ritmo geral sem detalhe técnico desnecessário.",
      researcher: "Visão de amostra de partidas para ler composição, associações e densidade de turnos sem misturar operação de sala.",
      institutionAdmin: (institutionName) => `Visão de partidas para ${institutionName}, alinhada ao acesso institucional disponível.`,
    },
    searchPlaceholder: "Filtrar por baralho, gameId, instituição, dispositivo ou jogador",
    allInstitutions: "Todas as instituições",
    playerModes: { all: "Todos os modos", registered: "Só registrados", manual: "Só manuais", mixed: "Mistos" },
    accessOptions: { all: "Todos os acessos", owned: "Meus dispositivos", institution: "Instituição visível", shared: "Compartilhadas", unresolved: "Sem associação resolvida" },
    clearCrossFilter: "Remover filtro cruzado",
    activeInstitution: (name) => `Instituição ativa: ${name}`,
    filteredUser: (name) => `Usuário filtrado: ${name}`,
    filteredDevice: (name) => `Dispositivo filtrado: ${name}`,
    researcherCards: {
      sample: { title: "Composição da amostra", description: "Veja rapidamente quantas sessões combinam manuais e registrados e como a amostra disponível está representada." },
      associations: { title: "Associações-chave", description: "A relação entre partida, dispositivo e responsável fica clara para interpretar cada caso sem ambiguidade." },
      turns: { title: "Turnos observáveis", description: "A amostra destaca densidade de turnos, taxa de acerto e contexto do jogador com leitura direta." },
    },
    accessAvailable: "Acesso disponível",
    accessHint: "Recorte a amostra por tipo de acesso antes de abrir uma partida.",
    results: "Resultados",
    allView: "Visão geral",
    clear: "Limpar",
    resultsSummary: (filtered, total) => `${filtered} de ${total} partidas com o recorte atual.`,
    listTitles: { default: "Lista de partidas", teacher: "Partidas para sala", director: "Partidas para acompanhamento", family: "Atividade recente", researcher: "Amostra de partidas" },
    listDescriptions: {
      default: "Abra uma partida para entrar em seu detalhe dedicado sem perder o contexto do recorte atual.",
      teacher: "Abra uma partida para entrar em sua tela dedicada com contexto de dispositivo, participantes e desempenho.",
      director: "Abra uma partida para revisar contexto institucional, navegação relacionada e desempenho turno a turno.",
      family: "Abra uma partida para ver seu detalhe dedicado com participantes, turnos e ritmo geral.",
      researcher: "Abra uma partida para revisar composição, turnos, navegação relacionada e gráfico de resultados por turno.",
    },
    table: { deck: "Baralho", institution: "Instituição", device: "Dispositivo", access: "Acesso", players: "Jogadores", turns: "Turnos", start: "Início", empty: "Não há partidas para mostrar." },
    summaryLabels: { games: "Partidas", sample: "Amostra", players: "Jogadores", turns: "Turnos", decks: "Baralhos", mixedSample: "Amostra mista", mixedGames: "Mistas", successRate: "Taxa de acertos", unresolved: "Sem associação" },
    actionLabels: { focus: "Ver foco", active: "Foco ativo", seeAll: "Ver todas" },
  },
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
  icon: ComponentType<{ className?: string }>;
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
            aria-label={`${isActive ? "Foco activo para" : actionLabel} ${label}`}
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

function getDeckInitials(deckName?: string | null) {
  return (deckName || "Partida")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("") || "GM";
}

export function GamesTable() {
  const { language } = useLanguage();
  const t = gamesMessages[language];
  const { tokens, user: currentUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(() => searchParams.get("q")?.trim() || "");
  const [institutionFilter, setInstitutionFilter] = useState<string>(() => searchParams.get("institutionId")?.trim() || "");
  const [playerModeFilter, setPlayerModeFilter] = useState<GamePlayerModeFilter>(() => {
    const value = searchParams.get("playerMode");
    return value === "manual" || value === "mixed" || value === "registered" ? value : "all";
  });
  const [accessFilter, setAccessFilter] = useState<GameAccessFilter>(() => {
    const value = searchParams.get("access");
    return value === "owned" || value === "institution" || value === "shared" || value === "unresolved" ? value : "all";
  });
  const linkedOwnerUserId = searchParams.get("ownerUserId")?.trim() || "";
  const linkedOwnerUserName = searchParams.get("ownerUserName")?.trim() || "";
  const linkedBleDeviceId = searchParams.get("bleDeviceId")?.trim() || "";
  const linkedDeviceId = searchParams.get("deviceId")?.trim() || "";
  const linkedDeviceName = searchParams.get("deviceName")?.trim() || "";
  const initialPage = Number(searchParams.get("page") || 1) > 0 ? Number(searchParams.get("page") || 1) : 1;
  const initialPageSize = Number(searchParams.get("pageSize") || 10);

  const gamesQuery = useGames(tokens?.accessToken);
  const devicesQuery = useDevices(tokens?.accessToken);
  const institutionsQuery = useInstitutions(tokens?.accessToken);

  const games = useMemo(() => gamesQuery.data?.data || [], [gamesQuery.data?.data]);
  const devices = useMemo(() => devicesQuery.data?.data || [], [devicesQuery.data?.data]);
  const institutions = useMemo(() => institutionsQuery.data?.data || [], [institutionsQuery.data?.data]);

  const institutionById = useMemo(() => new Map(institutions.map((institution) => [institution.id, institution])), [institutions]);

  const scopedInstitutionId = institutions.length === 1 ? institutions[0]?.id || null : null;
  const scopedInstitutionName = scopedInstitutionId ? institutions[0]?.name || scopedInstitutionId : null;
  const isInstitutionScopedView = Boolean(scopedInstitutionId && currentUser?.educationalCenterId === scopedInstitutionId);
  const isResearcherView = currentUser?.roles.includes("researcher") || false;
  const isFamilyView = currentUser?.roles.includes("family") || false;
  const isTeacherView = currentUser?.roles.includes("teacher") || false;
  const isDirectorView = currentUser?.roles.includes("director") || false;

  const gameRows = useMemo(() => buildGameRows(games, devices, institutions, currentUser), [currentUser, devices, games, institutions]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    const effectiveInstitutionFilter = institutionFilter || scopedInstitutionId || "";

    return gameRows.filter((game) => {
      if (linkedOwnerUserId && game.device?.ownerUserId !== linkedOwnerUserId) return false;
      if (linkedBleDeviceId && game.bleDeviceId !== linkedBleDeviceId) return false;
      if (linkedDeviceId && game.device?.deviceId !== linkedDeviceId) return false;
      if (effectiveInstitutionFilter && game.educationalCenterId !== effectiveInstitutionFilter) return false;

      const manualCount = game.players.filter((player) => player.playerSource === "manual").length;
      const registeredCount = game.players.filter((player) => player.playerSource !== "manual").length;

      if (playerModeFilter === "manual" && !(manualCount > 0 && registeredCount === 0)) return false;
      if (playerModeFilter === "mixed" && !(manualCount > 0 && registeredCount > 0)) return false;
      if (playerModeFilter === "registered" && !(registeredCount > 0 && manualCount === 0)) return false;

      if (accessFilter === "owned" && !game.isOwnedByCurrentUser) return false;
      if (accessFilter === "institution" && !game.isInstitutionVisible) return false;
      if (accessFilter === "shared" && game.accessRelation !== "compartido visible") return false;
      if (accessFilter === "unresolved" && !game.hasUnresolvedAssociation) return false;

      if (!normalized) return true;

      return [
        game.deckName,
        game.gameId,
        game.bleDeviceId,
        game.institution?.name,
        game.device?.name,
        game.device?.deviceId,
        game.ownerLabel,
        game.accessRelation,
        ...game.players.map((player) => player.playerName),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [accessFilter, gameRows, institutionFilter, linkedBleDeviceId, linkedDeviceId, linkedOwnerUserId, playerModeFilter, query, scopedInstitutionId]);

  const pagination = useListPagination(filtered, initialPageSize === 20 || initialPageSize === 50 ? initialPageSize : 10, initialPage);

  const metrics = useMemo(() => {
    const totalPlayers = games.reduce((acc, game) => acc + (game.players.length || game.totalPlayers || 0), 0);
    const totalTurns = games.reduce((acc, game) => acc + game.turns.length, 0);
    const successfulTurns = games.reduce((acc, game) => acc + game.turns.filter((turn) => turn.success).length, 0);
    const mixedGames = games.filter((game) => {
      const manualCount = game.players.filter((player) => player.playerSource === "manual").length;
      const registeredCount = game.players.filter((player) => player.playerSource !== "manual").length;
      return manualCount > 0 && registeredCount > 0;
    }).length;

    return {
      totalGames: games.length,
      totalPlayers,
      totalTurns,
      mixedGames,
      unresolvedAssociations: gameRows.filter((game) => game.hasUnresolvedAssociation).length,
      ownedGames: gameRows.filter((game) => game.isOwnedByCurrentUser).length,
      institutionVisibleGames: gameRows.filter((game) => game.isInstitutionVisible).length,
      successRate: totalTurns > 0 ? Math.round((successfulTurns / totalTurns) * 100) : 0,
    };
  }, [gameRows, games]);

  const accessSegments = [
    { key: "all" as const, label: "Todas", count: metrics.totalGames },
    { key: "owned" as const, label: "Mis dispositivos", count: metrics.ownedGames },
    { key: "institution" as const, label: "Institución visible", count: metrics.institutionVisibleGames },
    { key: "shared" as const, label: "Compartidas", count: gameRows.filter((game) => game.accessRelation === "compartido visible").length },
    { key: "unresolved" as const, label: "Sin asociación resuelta", count: metrics.unresolvedAssociations },
  ];

  function resetFilters() {
    setQuery("");
    setInstitutionFilter("");
    setPlayerModeFilter("all");
    setAccessFilter("all");
  }

  const activeFilterChips = [
    query.trim() ? `Búsqueda · ${query.trim()}` : null,
    (institutionFilter || scopedInstitutionId) ? `Institución · ${institutionById.get(institutionFilter || scopedInstitutionId || "")?.name || institutionFilter || scopedInstitutionId}` : null,
    playerModeFilter !== "all" ? `Jugadores · ${playerModeFilter === "mixed" ? "Mixtos" : playerModeFilter === "manual" ? "Solo manuales" : "Solo registrados"}` : null,
    accessFilter !== "all" ? `Acceso · ${accessSegments.find((segment) => segment.key === accessFilter)?.label || accessFilter}` : null,
    linkedOwnerUserId ? `Usuario · ${linkedOwnerUserName || linkedOwnerUserId}` : null,
    linkedBleDeviceId || linkedDeviceId ? `Dispositivo · ${linkedDeviceName || linkedDeviceId || linkedBleDeviceId}` : null,
  ].filter((value): value is string => Boolean(value));

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (institutionFilter) params.set("institutionId", institutionFilter);
    if (playerModeFilter !== "all") params.set("playerMode", playerModeFilter);
    if (accessFilter !== "all") params.set("access", accessFilter);
    if (linkedOwnerUserId) params.set("ownerUserId", linkedOwnerUserId);
    if (linkedOwnerUserName) params.set("ownerUserName", linkedOwnerUserName);
    if (linkedBleDeviceId) params.set("bleDeviceId", linkedBleDeviceId);
    if (linkedDeviceId) params.set("deviceId", linkedDeviceId);
    if (linkedDeviceName) params.set("deviceName", linkedDeviceName);
    if (pagination.currentPage > 1) params.set("page", String(pagination.currentPage));
    if (pagination.pageSize !== 10) params.set("pageSize", String(pagination.pageSize));

    const nextSearch = params.toString();
    const currentSearch = searchParams.toString();
    if (nextSearch !== currentSearch) {
      router.replace(nextSearch ? `${pathname}?${nextSearch}` : pathname);
    }
  }, [accessFilter, institutionFilter, linkedBleDeviceId, linkedDeviceId, linkedDeviceName, linkedOwnerUserId, linkedOwnerUserName, pagination.currentPage, pagination.pageSize, pathname, playerModeFilter, query, router, searchParams]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={isFamilyView ? t.eyebrow.family : isResearcherView ? t.eyebrow.researcher : isTeacherView ? t.eyebrow.teacher : isDirectorView ? t.eyebrow.director : isInstitutionScopedView ? t.eyebrow.institutionAdmin : t.eyebrow.default}
        title={t.title}
        description={
          isFamilyView
            ? t.description.family
            : isResearcherView
            ? t.description.researcher
            : isTeacherView
            ? t.description.teacher
            : isDirectorView
            ? t.description.director(scopedInstitutionName || (language === "en" ? "the institution" : language === "pt" ? "a instituição" : "la institución"))
            : isInstitutionScopedView
            ? t.description.institutionAdmin(scopedInstitutionName || (language === "en" ? "the institution" : language === "pt" ? "a instituição" : "la institución"))
            : t.description.default
        }
        actions={
          <div className="grid w-full gap-3 md:grid-cols-2 2xl:grid-cols-[minmax(0,1.45fr)_minmax(220px,0.8fr)_minmax(210px,0.7fr)_minmax(220px,0.8fr)]">
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
                  value={institutionFilter || scopedInstitutionId || ""}
                  onChange={(event) => setInstitutionFilter(event.target.value)}
                  className="h-10 min-w-0 w-full rounded-md border border-input bg-background px-3 text-sm"
                  disabled={Boolean(scopedInstitutionId)}
                >
                  <option value="">{t.allInstitutions}</option>
                  {institutions.map((institution) => (
                    <option key={institution.id} value={institution.id}>
                      {institution.name}
                    </option>
                  ))}
                </select>
                <select
                  value={playerModeFilter}
                  onChange={(event) => setPlayerModeFilter(event.target.value as "all" | "manual" | "mixed" | "registered")}
                  className="h-10 min-w-0 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">{t.playerModes.all}</option>
                  <option value="registered">{t.playerModes.registered}</option>
                  <option value="manual">{t.playerModes.manual}</option>
                  <option value="mixed">{t.playerModes.mixed}</option>
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
                {linkedOwnerUserId || linkedBleDeviceId || linkedDeviceId ? (
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

      {(scopedInstitutionName || linkedOwnerUserId || linkedBleDeviceId || linkedDeviceId) ? (
        <div className="flex flex-wrap gap-2">
          {scopedInstitutionName ? <Badge variant="outline">{t.activeInstitution(scopedInstitutionName)}</Badge> : null}
          {linkedOwnerUserId ? <Badge variant="outline">{t.filteredUser(linkedOwnerUserName || linkedOwnerUserId)}</Badge> : null}
          {linkedBleDeviceId || linkedDeviceId ? <Badge variant="outline">{t.filteredDevice(linkedDeviceName || linkedDeviceId || linkedBleDeviceId)}</Badge> : null}
        </div>
      ) : null}

      {isResearcherView ? (
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardContent className="grid gap-3 p-5 md:grid-cols-3">
            <div className="rounded-2xl bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">{t.researcherCards.sample.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.researcherCards.sample.description}</p>
            </div>
            <div className="rounded-2xl bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">{t.researcherCards.associations.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.researcherCards.associations.description}</p>
            </div>
            <div className="rounded-2xl bg-background/70 p-4">
              <p className="text-sm font-medium text-foreground">{t.researcherCards.turns.title}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{t.researcherCards.turns.description}</p>
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
        {gamesQuery.isLoading ? (
          Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard label={isResearcherView ? t.summaryLabels.sample : t.summaryLabels.games} value={String(metrics.totalGames)} icon={Gamepad2} onSelect={resetFilters} isActive={!query.trim() && !institutionFilter && playerModeFilter === "all" && accessFilter === "all" && !linkedOwnerUserId && !linkedBleDeviceId && !linkedDeviceId} actionLabel={t.actionLabels.seeAll} activeLabel={t.actionLabels.active} />
            <SummaryCard label={t.summaryLabels.players} value={String(metrics.totalPlayers)} icon={Users} actionLabel={t.actionLabels.focus} activeLabel={t.actionLabels.active} />
            <SummaryCard label={t.summaryLabels.turns} value={String(metrics.totalTurns)} icon={TimerReset} actionLabel={t.actionLabels.focus} activeLabel={t.actionLabels.active} />
            <SummaryCard label={isFamilyView ? t.summaryLabels.decks : isResearcherView ? t.summaryLabels.mixedSample : t.summaryLabels.mixedGames} value={String(isFamilyView ? new Set(games.map((game) => game.deckName).filter(Boolean)).size : metrics.mixedGames)} icon={BookOpen} onSelect={isFamilyView ? undefined : () => setPlayerModeFilter("mixed")} isActive={playerModeFilter === "mixed"} actionLabel={t.actionLabels.focus} activeLabel={t.actionLabels.active} />
            <SummaryCard label={isFamilyView ? t.summaryLabels.successRate : t.summaryLabels.unresolved} value={isFamilyView ? `${metrics.successRate}%` : String(metrics.unresolvedAssociations)} icon={isFamilyView ? Trophy : Gamepad2} onSelect={isFamilyView ? undefined : () => setAccessFilter("unresolved")} isActive={accessFilter === "unresolved"} actionLabel={t.actionLabels.focus} activeLabel={t.actionLabels.active} />
          </>
        )}
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-sm font-medium text-foreground">{t.results}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t.resultsSummary(filtered.length, metrics.totalGames)}</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {activeFilterChips.length > 0 ? activeFilterChips.map((chip) => <Badge key={chip} variant="outline">{chip}</Badge>) : <Badge variant="outline">{t.allView}</Badge>}
            {activeFilterChips.length > 0 ? <button type="button" onClick={resetFilters} className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition hover:bg-accent">{t.clear}</button> : null}
          </div>
        </CardContent>
      </Card>

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
        <CardContent className="max-h-[720px] overflow-auto p-0">
          {gamesQuery.isLoading ? (
            <div className="p-6">
              <Skeleton className="h-72 w-full rounded-none" />
            </div>
          ) : gamesQuery.error ? (
            <div className="p-6 text-sm text-destructive">{getErrorMessage(gamesQuery.error)}</div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm">
                <TableRow>
                  <TableHead>Game ID</TableHead>
                  <TableHead>{t.table.deck}</TableHead>
                  {isFamilyView ? null : <TableHead>{t.table.institution}</TableHead>}
                  {isFamilyView ? null : <TableHead>{t.table.device}</TableHead>}
                  {isFamilyView ? null : <TableHead>{t.table.access}</TableHead>}
                  <TableHead>{t.table.players}</TableHead>
                  <TableHead>{t.table.turns}</TableHead>
                  <TableHead>{t.table.start}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isFamilyView ? 5 : 8} className="py-10 text-center text-sm text-muted-foreground">
                      {t.table.empty}
                    </TableCell>
                  </TableRow>
                ) : (
                  pagination.paginatedItems.map((game) => {
                    const manualCount = game.players.filter((player) => player.playerSource === "manual").length;
                    const registeredCount = game.players.filter((player) => player.playerSource !== "manual").length;

                    return (
                      <TableRow
                        key={game.id}
                        className="cursor-pointer"
                        onClick={() =>
                          router.push(
                            buildGameDetailHref({
                              gameRecordId: game.id,
                              q: query.trim(),
                              institutionId: institutionFilter,
                              playerMode: playerModeFilter,
                              access: accessFilter,
                              ownerUserId: linkedOwnerUserId,
                              ownerUserName: linkedOwnerUserName,
                              bleDeviceId: linkedBleDeviceId,
                              deviceId: linkedDeviceId,
                              deviceName: linkedDeviceName,
                              page: pagination.currentPage,
                              pageSize: pagination.pageSize,
                            }),
                          )
                        }
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-white text-[11px] font-semibold text-primary">
                              {getDeckInitials(game.deckName)}
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{game.gameId || "-"}</p>
                              <p className="text-xs text-muted-foreground">{game.playerMixLabel}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <p className="text-sm text-foreground">{game.deckName || "-"}</p>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={game.hasUnresolvedAssociation ? "warning" : "outline"}>{game.hasUnresolvedAssociation ? "revisar asociación" : "asociación visible"}</Badge>
                            </div>
                          </div>
                        </TableCell>
                        {isFamilyView ? null : <TableCell>{game.institution?.name || game.educationalCenterId || "-"}</TableCell>}
                        {isFamilyView ? null : <TableCell>{game.device?.name || game.device?.deviceId || game.bleDeviceId || "-"}</TableCell>}
                        {isFamilyView ? null : (
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant={game.hasUnresolvedAssociation ? "warning" : "outline"}>{game.accessRelation}</Badge>
                              <span className="text-xs text-muted-foreground">{game.ownerLabel}</span>
                            </div>
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{game.players.length || game.totalPlayers || 0}</Badge>
                            <Badge variant={game.playerMixLabel === "mixta" ? "secondary" : "outline"}>{game.playerMixLabel}</Badge>
                            {registeredCount > 0 ? <Badge variant="outline">registrados {registeredCount}</Badge> : null}
                            {manualCount > 0 ? <Badge variant="success">manuales {manualCount}</Badge> : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{game.turns.length}</Badge>
                        </TableCell>
                        <TableCell>{formatDateTime(game.startDate)}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
