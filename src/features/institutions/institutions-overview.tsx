"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, ChevronDown, ChevronUp, Globe, GraduationCap, Mail, MapPin, Phone, Search, ShieldCheck, Smartphone, Trash2, UserPlus, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/features/auth/auth-context";
import { useClassGroups } from "@/features/class-groups/api";
import { StudentImportPanel } from "@/features/class-groups/student-import-panel";
import { useDevices } from "@/features/devices/api";
import { useGames } from "@/features/games/api";
import {
  createInstitution,
  deleteInstitution,
  uploadInstitutionImage,
  updateInstitution,
  useInstitutionById,
  useInstitutions,
} from "@/features/institutions/api";
import type {
  CreateInstitutionPayload,
  InstitutionMutationPayload,
  InstitutionRecord,
  UpdateInstitutionPayload,
} from "@/features/institutions/types";
import { useStudents } from "@/features/students/api";
import { useUsers } from "@/features/users/api";
import { cn, formatDateTime, formatDurationSeconds, getErrorMessage } from "@/lib/utils";

function SummaryCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{hint}</p>
          </div>
          <div className="rounded-2xl bg-primary/12 p-3 text-primary">
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type FormMode = "create" | "edit";
type InstitutionFocusFilter = "all" | "review" | "no_logo" | "no_users" | "no_devices" | "active_operation";
type StudentVisibilityFilter = "all" | "with_games" | "without_games";
type StudentSortOption = "activity" | "name" | "performance";
type AnalyticsScope = "group" | "student";
type FeedbackState = { type: "success" | "error"; message: string } | null;

type InstitutionFormState = {
  name: string;
  email: string;
  phoneNumber: string;
  imageUrl: string;
  url: string;
  addressFirstLine: string;
  addressSecondLine: string;
  countryCode: string;
  city: string;
  state: string;
  postalCode: string;
};

type InstitutionRow = InstitutionRecord & {
  userCount: number;
  deviceCount: number;
  classGroupCount: number;
  studentCount: number;
  linkedUserNames: string[];
  linkedDeviceNames: string[];
  needsReview: boolean;
};

function emptyFormState(): InstitutionFormState {
  return {
    name: "",
    email: "",
    phoneNumber: "",
    imageUrl: "",
    url: "",
    addressFirstLine: "",
    addressSecondLine: "",
    countryCode: "",
    city: "",
    state: "",
    postalCode: "",
  };
}

function formFromInstitution(institution: InstitutionRecord): InstitutionFormState {
  return {
    name: institution.name,
    email: institution.email,
    phoneNumber: institution.phoneNumber,
    imageUrl: institution.imageUrl || "",
    url: institution.url || "",
    addressFirstLine: institution.address?.addressFirstLine || "",
    addressSecondLine: institution.address?.addressSecondLine || "",
    countryCode: institution.address?.countryCode || "",
    city: institution.address?.city || "",
    state: institution.address?.state || "",
    postalCode: institution.address?.postalCode || "",
  };
}

function buildPayload(form: InstitutionFormState) {
  if (!form.name.trim() || !form.email.trim() || !form.phoneNumber.trim()) {
    return { error: "Completá nombre, email y teléfono." };
  }

  if (!form.addressFirstLine.trim() || !form.city.trim() || !form.countryCode.trim()) {
    return { error: "Completá al menos calle, ciudad y país." };
  }

  const payload: InstitutionMutationPayload = {
    name: form.name.trim(),
    email: form.email.trim().toLowerCase(),
    phoneNumber: form.phoneNumber.trim(),
    imageUrl: form.imageUrl.trim() || null,
    url: form.url.trim() || null,
    address: {
      addressFirstLine: form.addressFirstLine.trim(),
      addressSecondLine: form.addressSecondLine.trim() || null,
      countryCode: form.countryCode.trim().toUpperCase(),
      city: form.city.trim(),
      state: form.state.trim() || null,
      postalCode: form.postalCode.trim() || null,
    },
  };

  return { payload };
}

function getInstitutionInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "IN";
  return parts.map((part) => part.slice(0, 1).toUpperCase()).join("");
}

function getPersonInitials(name: string) {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "ST";
  return parts.map((part) => part.slice(0, 1).toUpperCase()).join("");
}

function getDateBucketLabel(value?: string | null) {
  if (!value) return "Sin fecha";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-UY", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function InstitutionAvatar({
  name,
  imageUrl,
  className,
}: {
  name: string;
  imageUrl?: string | null;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-white font-semibold text-primary",
        className,
      )}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span>{getInstitutionInitials(name)}</span>
      )}
    </div>
  );
}

export function InstitutionsOverview() {
  const { tokens, user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  const [query, setQuery] = useState("");
  const [focusFilter, setFocusFilter] = useState<InstitutionFocusFilter>("all");
  const [mode, setMode] = useState<FormMode>("edit");
  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState("");
  const [studentVisibilityFilter, setStudentVisibilityFilter] = useState<StudentVisibilityFilter>("all");
  const [studentSort, setStudentSort] = useState<StudentSortOption>("activity");
  const [studentGamesSearchQuery, setStudentGamesSearchQuery] = useState("");
  const [analyticsScope, setAnalyticsScope] = useState<AnalyticsScope>("group");
  const [form, setForm] = useState<InstitutionFormState>(emptyFormState);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const institutionsQuery = useInstitutions(tokens?.accessToken);
  const usersQuery = useUsers(tokens?.accessToken);
  const devicesQuery = useDevices(tokens?.accessToken);

  const institutions = useMemo(() => institutionsQuery.data?.data ?? [], [institutionsQuery.data?.data]);
  const users = useMemo(() => usersQuery.data?.data ?? [], [usersQuery.data?.data]);
  const devices = useMemo(() => devicesQuery.data?.data ?? [], [devicesQuery.data?.data]);

  const scopedInstitutionId = institutions.length === 1 ? institutions[0]?.id || null : null;
  const activeInstitutionId = selectedInstitutionId ?? scopedInstitutionId;
  const gamesQuery = useGames(tokens?.accessToken, {
    institutionId: activeInstitutionId,
    page: 1,
    limit: 100,
    sortBy: "created_at",
    order: "desc",
  });
  const institutionGames = useMemo(() => gamesQuery.data?.data ?? [], [gamesQuery.data?.data]);
  const institutionDetailQuery = useInstitutionById(tokens?.accessToken, activeInstitutionId);
  const institutionClassGroupsQuery = useClassGroups(tokens?.accessToken, activeInstitutionId);
  const scopedInstitutionName = scopedInstitutionId ? institutions[0]?.name || scopedInstitutionId : null;
  const isInstitutionScopedView = Boolean(scopedInstitutionId && currentUser?.educationalCenterId === scopedInstitutionId);
  const isDirectorView = currentUser?.roles.includes("director") || false;

  const currentPermissionKeys = useMemo(() => new Set(currentUser?.permissions || []), [currentUser?.permissions]);
  const hasGlobalAdminRole = currentUser?.roles.includes("admin") || false;
  const hasResolvedCapabilities = hasGlobalAdminRole || currentPermissionKeys.size > 0;

  function hasAnyPermission(...keys: string[]) {
    if (hasGlobalAdminRole) return true;
    if (!hasResolvedCapabilities) return true;
    return keys.some((key) => currentPermissionKeys.has(key));
  }

  const canCreateInstitutions = hasAnyPermission("educational_center:create", "educational-center:create");
  const canUpdateInstitutions = hasAnyPermission("educational_center:update", "educational-center:update");
  const canDeleteInstitutions = hasAnyPermission("educational_center:delete", "educational-center:delete");
  const canSubmitForm = mode === "create" ? canCreateInstitutions : canUpdateInstitutions;

  const createInstitutionMutation = useMutation({
    mutationFn: async ({ payload, imageFile }: { payload: CreateInstitutionPayload; imageFile: File | null }) => {
      const createdInstitution = await createInstitution(tokens?.accessToken as string, payload);
      if (!imageFile) return createdInstitution;

      const uploadResult = await uploadInstitutionImage(tokens?.accessToken as string, createdInstitution.id, imageFile);
      return {
        ...createdInstitution,
        imageUrl: uploadResult.imageUrl,
      };
    },
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["institutions"] });
      await queryClient.invalidateQueries({ queryKey: ["institutions", "detail"] });
      setMode("edit");
      setSelectedInstitutionId(created.id);
      setForm(formFromInstitution(created));
      setImageFile(null);
      setFeedback({ type: "success", message: `Institución ${created.name} creada.` });
    },
    onError: (error) => setFeedback({ type: "error", message: getErrorMessage(error) }),
  });

  const updateInstitutionMutation = useMutation({
    mutationFn: async ({ institutionId, payload, imageFile }: { institutionId: string; payload: UpdateInstitutionPayload; imageFile?: File | null }) => {
      const updatedInstitution = await updateInstitution(tokens?.accessToken as string, institutionId, payload);
      if (!imageFile) return updatedInstitution;

      const uploadResult = await uploadInstitutionImage(tokens?.accessToken as string, institutionId, imageFile);
      return {
        ...updatedInstitution,
        imageUrl: uploadResult.imageUrl,
      };
    },
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ["institutions"] });
      await queryClient.invalidateQueries({ queryKey: ["institutions", "detail"] });
      setSelectedInstitutionId(updated.id);
      setForm(formFromInstitution(updated));
      setImageFile(null);
      setFeedback({ type: "success", message: `Institución ${updated.name} actualizada.` });
    },
    onError: (error) => setFeedback({ type: "error", message: getErrorMessage(error) }),
  });

  const deleteInstitutionMutation = useMutation({
    mutationFn: (institutionId: string) => deleteInstitution(tokens?.accessToken as string, institutionId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["institutions"] });
      await queryClient.invalidateQueries({ queryKey: ["institutions", "detail"] });
      setMode("edit");
      setSelectedInstitutionId(null);
      setForm(emptyFormState());
      setImageFile(null);
      setFeedback({ type: "success", message: "Institución eliminada." });
    },
    onError: (error) => setFeedback({ type: "error", message: getErrorMessage(error) }),
  });

  const usersByInstitutionId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of users) {
      if (!item.educationalCenterId) continue;
      const current = map.get(item.educationalCenterId) || [];
      current.push(item.fullName);
      map.set(item.educationalCenterId, current);
    }
    return map;
  }, [users]);

  const devicesByInstitutionId = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of devices) {
      if (!item.educationalCenterId) continue;
      const current = map.get(item.educationalCenterId) || [];
      current.push(item.name || item.deviceId);
      map.set(item.educationalCenterId, current);
    }
    return map;
  }, [devices]);

  const institutionRows = useMemo<InstitutionRow[]>(() => {
    return institutions.map((institution) => {
      const linkedUserNames = usersByInstitutionId.get(institution.id) || [];
      const linkedDeviceNames = devicesByInstitutionId.get(institution.id) || [];
      const userCount = institution.operationalSummary?.userCount ?? linkedUserNames.length;
      const deviceCount = institution.operationalSummary?.deviceCount ?? linkedDeviceNames.length;
      const classGroupCount = institution.operationalSummary?.classGroupCount ?? 0;
      const studentCount = institution.operationalSummary?.studentCount ?? 0;
      const needsReview = institution.operationalSummary?.needsReview ?? (!institution.url || !institution.phoneNumber || !institution.address?.addressFirstLine);

      return {
        ...institution,
        userCount,
        deviceCount,
        classGroupCount,
        studentCount,
        linkedUserNames,
        linkedDeviceNames,
        needsReview,
      };
    });
  }, [devicesByInstitutionId, institutions, usersByInstitutionId]);

  const selectedInstitution = useMemo(
    () => institutionRows.find((item) => item.id === activeInstitutionId) || null,
    [activeInstitutionId, institutionRows],
  );
  const selectedInstitutionDetail = institutionDetailQuery.data || null;
  const previewUsers = selectedInstitutionDetail?.operationalPreview?.users || [];
  const previewDevices = selectedInstitutionDetail?.operationalPreview?.devices || [];
  const previewClassGroups = selectedInstitutionDetail?.operationalPreview?.classGroups || [];
  const institutionClassGroups = useMemo(() => institutionClassGroupsQuery.data?.data ?? [], [institutionClassGroupsQuery.data?.data]);

  useEffect(() => {
    setSelectedGroupId(null);
    setSelectedStudentId(null);
  }, [activeInstitutionId]);

  useEffect(() => {
    if (institutionClassGroups.length === 0) {
      setSelectedGroupId(null);
      return;
    }

    const hasCurrentSelection = selectedGroupId && institutionClassGroups.some((group) => group.id === selectedGroupId);
    if (!hasCurrentSelection) {
      setSelectedGroupId(institutionClassGroups[0].id);
    }
  }, [institutionClassGroups, selectedGroupId]);

  const selectedGroup = useMemo(
    () => institutionClassGroups.find((group) => group.id === selectedGroupId) ?? null,
    [institutionClassGroups, selectedGroupId],
  );

  const studentsQuery = useStudents(tokens?.accessToken, {
    institutionId: activeInstitutionId,
    classGroupId: selectedGroup?.id ?? null,
    page: 1,
    limit: 100,
    sortBy: "updated_at",
    order: "desc",
  });
  const selectedGroupStudents = useMemo(() => studentsQuery.data?.data ?? [], [studentsQuery.data?.data]);

  useEffect(() => {
    setSelectedStudentId(null);
    setStudentSearchQuery("");
    setStudentVisibilityFilter("all");
    setStudentSort("activity");
    setStudentGamesSearchQuery("");
    setAnalyticsScope("group");
  }, [selectedGroup?.id]);

  const studentPerformanceRows = useMemo(() => {
    return selectedGroupStudents.map((student) => {
      const games = institutionGames.filter((game) => game.players.some((player) => player.studentId === student.id) || game.turns.some((turn) => turn.studentId === student.id));
      const turns = games.flatMap((game) => game.turns.filter((turn) => turn.studentId === student.id));
      const successfulTurns = turns.filter((turn) => turn.success).length;
      const totalTurnSeconds = turns.reduce((sum, turn) => sum + (turn.playTimeSeconds || 0), 0);
      const lastParticipation = games
        .map((game) => game.startDate || game.updatedAt || game.createdAt)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) || null;

      return {
        student,
        gamesCount: games.length,
        turnsCount: turns.length,
        successfulTurns,
        successRate: turns.length > 0 ? Math.round((successfulTurns / turns.length) * 100) : 0,
        averageTurnSeconds: turns.length > 0 ? totalTurnSeconds / turns.length : 0,
        lastParticipation,
        games,
        turns,
      };
    });
  }, [institutionGames, selectedGroupStudents]);

  const filteredStudentPerformanceRows = useMemo(() => {
    const normalizedSearch = studentSearchQuery.trim().toLowerCase();

    const filteredRows = studentPerformanceRows.filter((entry) => {
      const matchesSearch = !normalizedSearch || [entry.student.fullName, entry.student.fileNumber, entry.student.firstName, entry.student.lastName]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(normalizedSearch));

      if (!matchesSearch) return false;

      switch (studentVisibilityFilter) {
        case "with_games":
          return entry.gamesCount > 0;
        case "without_games":
          return entry.gamesCount === 0;
        default:
          return true;
      }
    });

    return [...filteredRows].sort((a, b) => {
      switch (studentSort) {
        case "name":
          return a.student.fullName.localeCompare(b.student.fullName, "es");
        case "performance":
          return b.successRate - a.successRate || b.gamesCount - a.gamesCount || a.student.fullName.localeCompare(b.student.fullName, "es");
        case "activity":
        default:
          return b.gamesCount - a.gamesCount || b.turnsCount - a.turnsCount || a.student.fullName.localeCompare(b.student.fullName, "es");
      }
    });
  }, [studentPerformanceRows, studentSearchQuery, studentSort, studentVisibilityFilter]);

  useEffect(() => {
    if (filteredStudentPerformanceRows.length === 0) {
      setSelectedStudentId(null);
      return;
    }

    const hasCurrentSelection = selectedStudentId && filteredStudentPerformanceRows.some((entry) => entry.student.id === selectedStudentId);
    if (!hasCurrentSelection) {
      setSelectedStudentId(null);
    }
  }, [filteredStudentPerformanceRows, selectedStudentId]);

  const selectedStudent = useMemo(
    () => filteredStudentPerformanceRows.find((entry) => entry.student.id === selectedStudentId)?.student ?? null,
    [filteredStudentPerformanceRows, selectedStudentId],
  );

  const selectedStudentPerformance = useMemo(
    () => studentPerformanceRows.find((entry) => entry.student.id === selectedStudent?.id) ?? null,
    [selectedStudent?.id, studentPerformanceRows],
  );

  const selectedGroupStudentIds = useMemo(() => new Set(selectedGroupStudents.map((student) => student.id)), [selectedGroupStudents]);

  const analyticsSeries = useMemo(() => {
    const aggregation = new Map<string, { name: string; games: number; turns: number; successfulTurns: number; sortValue: number }>();

    for (const game of institutionGames) {
      const relevantTurns = analyticsScope === "student"
        ? game.turns.filter((turn) => turn.studentId === selectedStudent?.id)
        : game.turns.filter((turn) => turn.studentId && selectedGroupStudentIds.has(turn.studentId));

      const hasRelevantPlayers = analyticsScope === "student"
        ? game.players.some((player) => player.studentId === selectedStudent?.id)
        : game.players.some((player) => player.studentId && selectedGroupStudentIds.has(player.studentId));

      if (!hasRelevantPlayers && relevantTurns.length === 0) continue;

      const bucketSource = game.startDate || game.createdAt || game.updatedAt || relevantTurns[0]?.turnStartDate || relevantTurns[0]?.createdAt || null;
      const bucketDate = bucketSource ? new Date(bucketSource) : null;
      const bucketKey = bucketDate && !Number.isNaN(bucketDate.getTime()) ? bucketDate.toISOString().slice(0, 10) : game.id;
      const bucket = aggregation.get(bucketKey) ?? {
        name: getDateBucketLabel(bucketSource),
        games: 0,
        turns: 0,
        successfulTurns: 0,
        sortValue: bucketDate && !Number.isNaN(bucketDate.getTime()) ? bucketDate.getTime() : 0,
      };

      bucket.games += 1;
      bucket.turns += relevantTurns.length;
      bucket.successfulTurns += relevantTurns.filter((turn) => turn.success).length;
      aggregation.set(bucketKey, bucket);
    }

    return [...aggregation.values()]
      .sort((a, b) => a.sortValue - b.sortValue)
      .map((entry) => ({
        name: entry.name,
        partidas: entry.games,
        turnos: entry.turns,
        acierto: entry.turns > 0 ? Math.round((entry.successfulTurns / entry.turns) * 100) : 0,
      }));
  }, [analyticsScope, institutionGames, selectedGroupStudentIds, selectedStudent?.id]);

  const analyticsTitle = analyticsScope === "student"
    ? selectedStudent?.fullName || "estudiante seleccionado"
    : selectedGroup?.name || "grupo seleccionado";

  const analyticsDescription = analyticsScope === "student"
    ? "La lectura temporal usa solo las partidas y turnos del estudiante activo."
    : "La lectura temporal consolida las partidas y turnos visibles de todo el grupo.";

  const selectedStudentGames = selectedStudentPerformance?.games ?? [];
  const selectedStudentGameRows = useMemo(
    () => selectedStudentGames.map((game) => {
      const turns = game.turns.filter((turn) => turn.studentId === selectedStudent?.id);
      const successfulTurns = turns.filter((turn) => turn.success).length;
      const avgTurnSeconds = turns.length > 0
        ? turns.reduce((sum, turn) => sum + (turn.playTimeSeconds || 0), 0) / turns.length
        : 0;

      return {
        id: game.id,
        label: `${game.deckName || "Partida"} #${game.gameId || "-"}`,
        playedAt: game.startDate || game.updatedAt || game.createdAt || null,
        turnCount: turns.length,
        successRate: turns.length > 0 ? Math.round((successfulTurns / turns.length) * 100) : 0,
        avgTurnSeconds,
        rawGame: game,
      };
    }),
    [selectedStudent?.id, selectedStudentGames],
  );

  const filteredSelectedStudentGameRows = useMemo(() => {
    const normalizedSearch = studentGamesSearchQuery.trim().toLowerCase();
    if (!normalizedSearch) return selectedStudentGameRows;

    return selectedStudentGameRows.filter((game) => {
      return [game.label, game.playedAt]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    });
  }, [selectedStudentGameRows, studentGamesSearchQuery]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return institutionRows.filter((item) => {
      const matchesFocus = (() => {
        switch (focusFilter) {
          case "review":
            return item.needsReview;
          case "no_logo":
            return !item.imageUrl;
          case "no_users":
            return item.userCount === 0;
          case "no_devices":
            return item.deviceCount === 0;
          case "active_operation":
            return item.userCount > 0 && item.deviceCount > 0;
          default:
            return true;
        }
      })();

      if (!matchesFocus) return false;
      if (!normalized) return true;

      return [
        item.name,
        item.email,
        item.phoneNumber,
        item.city,
        item.country,
        item.url,
        ...item.linkedUserNames,
        ...item.linkedDeviceNames,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [focusFilter, institutionRows, query]);

  const metrics = useMemo(() => {
    return {
      totalInstitutions: institutionRows.length,
      totalUsersLinked: institutionRows.reduce((acc, item) => acc + item.userCount, 0),
      totalDevicesLinked: institutionRows.reduce((acc, item) => acc + item.deviceCount, 0),
      totalClassesLinked: institutionRows.reduce((acc, item) => acc + item.classGroupCount, 0),
      totalStudentsLinked: institutionRows.reduce((acc, item) => acc + item.studentCount, 0),
      institutionsWithLogo: institutionRows.filter((item) => Boolean(item.imageUrl)).length,
      reviewInstitutions: institutionRows.filter((item) => item.needsReview).length,
      institutionsWithoutUsers: institutionRows.filter((item) => item.userCount === 0).length,
      institutionsWithoutDevices: institutionRows.filter((item) => item.deviceCount === 0).length,
      institutionsWithActiveOperation: institutionRows.filter((item) => item.userCount > 0 && item.deviceCount > 0).length,
    };
  }, [institutionRows]);

  const focusSegments = [
    { key: "all" as const, label: "Todas", count: metrics.totalInstitutions },
    { key: "review" as const, label: "Con observaciones", count: metrics.reviewInstitutions },
    { key: "no_logo" as const, label: "Sin logo", count: metrics.totalInstitutions - metrics.institutionsWithLogo },
    { key: "no_users" as const, label: "Sin usuarios", count: metrics.institutionsWithoutUsers },
    { key: "no_devices" as const, label: "Sin dispositivos", count: metrics.institutionsWithoutDevices },
    { key: "active_operation" as const, label: "Operación activa", count: metrics.institutionsWithActiveOperation },
  ];

  const isSaving =
    createInstitutionMutation.isPending || updateInstitutionMutation.isPending || deleteInstitutionMutation.isPending;

  function updateFormField<K extends keyof InstitutionFormState>(key: K, value: InstitutionFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function selectInstitution(institution: InstitutionRow) {
    setMode("edit");
    setSelectedInstitutionId(institution.id);
    setForm(formFromInstitution(institution));
    setImageFile(null);
    setFeedback(null);
  }

  function openCreateInstitutionForm() {
    setMode("create");
    setSelectedInstitutionId(null);
    setForm(emptyFormState());
    setImageFile(null);
    setFeedback(null);
  }

  function openEditInstitutionForm() {
    if (!selectedInstitution) return;
    setMode("edit");
    setSelectedInstitutionId(selectedInstitution.id);
    setForm(formFromInstitution(selectedInstitution));
    setImageFile(null);
    setFeedback(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);

    if (!canSubmitForm) {
      setFeedback({
        type: "error",
        message: mode === "create" ? "Tu acceso actual no permite crear instituciones." : "Tu acceso actual no permite editar instituciones.",
      });
      return;
    }

    const result = buildPayload(form);
    if (!result.payload) {
      setFeedback({ type: "error", message: result.error || "No se pudo preparar el payload." });
      return;
    }

    if (mode === "create") {
      await createInstitutionMutation.mutateAsync({
        payload: result.payload as CreateInstitutionPayload,
        imageFile,
      });
      return;
    }

    if (!selectedInstitutionId) {
      setFeedback({ type: "error", message: "Seleccioná una institución para editar." });
      return;
    }

    await updateInstitutionMutation.mutateAsync({
      institutionId: selectedInstitutionId,
      payload: result.payload as UpdateInstitutionPayload,
      imageFile,
    });
  }

  async function handleDelete() {
    if (!selectedInstitutionId || !selectedInstitution) return;
    if (!canDeleteInstitutions) {
      setFeedback({ type: "error", message: "Tu acceso actual no permite eliminar instituciones." });
      return;
    }
    if (!globalThis.confirm(`¿Eliminar ${selectedInstitution.name}?`)) return;
    setFeedback(null);
    await deleteInstitutionMutation.mutateAsync(selectedInstitutionId);
  }

  function renderInstitutionEditorPanel() {
    return (
      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <CardTitle>{mode === "create" ? "Alta de institución" : isDirectorView ? "Detalle de seguimiento" : "Editar institución"}</CardTitle>
          <CardDescription>
            {mode === "create"
              ? canCreateInstitutions
                ? "Alta conectada al endpoint real de instituciones, ahora en el cuerpo central del módulo."
                : "Tu perfil actual no expone alta de instituciones."
              : isDirectorView
                ? "Resumen de contacto, cobertura visible y señales básicas para seguimiento institucional."
                : canUpdateInstitutions
                  ? "Datos base del cliente, contacto y localización operativa, sin sacar la edición del cuerpo principal."
                  : "Vista de solo lectura para los datos base de la institución."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {feedback ? (
            <div
              className={cn(
                "rounded-2xl border px-4 py-3 text-sm",
                feedback.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-destructive/20 bg-destructive/5 text-destructive",
              )}
            >
              {feedback.message}
            </div>
          ) : null}

          {mode === "edit" && !selectedInstitution ? (
            <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
              {isDirectorView ? "Elegí una institución de la tabla para revisar su detalle de seguimiento." : "Elegí una institución de la tabla para editarla o crear una nueva."}
            </div>
          ) : (
            <>
              {mode === "edit" && selectedInstitution ? (
                <div className="rounded-2xl bg-background/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <InstitutionAvatar name={selectedInstitution.name} imageUrl={selectedInstitution.imageUrl} className="size-14 text-sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{selectedInstitution.name}</p>
                        <p className="mt-1 truncate text-sm text-muted-foreground">{selectedInstitution.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={selectedInstitution.status === "active" ? "success" : "outline"}>
                        {selectedInstitution.status === "active" ? "activa" : "eliminada"}
                      </Badge>
                      <Badge variant={selectedInstitution.imageUrl ? "secondary" : "outline"}>
                        {selectedInstitution.imageUrl ? "logo cargado" : "sin logo"}
                      </Badge>
                      {selectedInstitution.needsReview ? <Badge variant="outline">revisar</Badge> : null}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <p>Usuarios vinculados: {selectedInstitution.userCount}</p>
                    <p>Dispositivos vinculados: {selectedInstitution.deviceCount}</p>
                    <p>Grupos vinculados: {selectedInstitution.classGroupCount}</p>
                    <p>Estudiantes vinculados: {selectedInstitution.studentCount}</p>
                    <p>Creada: {formatDateTime(selectedInstitution.createdAt)}</p>
                    <p>Actualizada: {formatDateTime(selectedInstitution.updatedAt)}</p>
                  </div>
                </div>
              ) : null}

              <form className="space-y-5" onSubmit={handleSubmit}>
                <ImageUploadField
                  value={form.imageUrl}
                  file={imageFile}
                  onFileChange={setImageFile}
                  onRemoveCurrent={() => {
                    setImageFile(null);
                    updateFormField("imageUrl", "");
                  }}
                  disabled={!canSubmitForm || isSaving}
                  label="Logo o imagen institucional"
                  description="Subí el logo o una imagen de referencia de la institución. Se guarda con upload real al confirmar el formulario."
                />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="name">Nombre</Label>
                    <Input id="name" disabled={!canSubmitForm} value={form.name} onChange={(event) => updateFormField("name", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" disabled={!canSubmitForm} type="email" value={form.email} onChange={(event) => updateFormField("email", event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber">Teléfono</Label>
                    <Input id="phoneNumber" disabled={!canSubmitForm} value={form.phoneNumber} onChange={(event) => updateFormField("phoneNumber", event.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="url">URL</Label>
                    <Input id="url" disabled={!canSubmitForm} value={form.url} onChange={(event) => updateFormField("url", event.target.value)} placeholder="https://..." />
                  </div>
                </div>

                <div className="space-y-3 rounded-2xl bg-background/70 p-4">
                  <p className="text-sm font-medium text-foreground">Dirección</p>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="addressFirstLine">Calle</Label>
                      <Input id="addressFirstLine" disabled={!canSubmitForm} value={form.addressFirstLine} onChange={(event) => updateFormField("addressFirstLine", event.target.value)} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="addressSecondLine">Complemento</Label>
                      <Input id="addressSecondLine" disabled={!canSubmitForm} value={form.addressSecondLine} onChange={(event) => updateFormField("addressSecondLine", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city">Ciudad</Label>
                      <Input id="city" disabled={!canSubmitForm} value={form.city} onChange={(event) => updateFormField("city", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="countryCode">País (código)</Label>
                      <Input id="countryCode" disabled={!canSubmitForm} value={form.countryCode} onChange={(event) => updateFormField("countryCode", event.target.value)} placeholder="UY" maxLength={2} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">Departamento / estado</Label>
                      <Input id="state" disabled={!canSubmitForm} value={form.state} onChange={(event) => updateFormField("state", event.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="postalCode">Código postal</Label>
                      <Input id="postalCode" disabled={!canSubmitForm} value={form.postalCode} onChange={(event) => updateFormField("postalCode", event.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={isSaving || !tokens?.accessToken || !canSubmitForm}>
                    {mode === "create" ? (canCreateInstitutions ? "Crear institución" : "Alta bloqueada") : canUpdateInstitutions ? "Guardar cambios" : "Edición bloqueada"}
                  </Button>
                  {mode === "create" ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setMode("edit");
                        if (selectedInstitution) setForm(formFromInstitution(selectedInstitution));
                        setFeedback(null);
                      }}
                    >
                      Cancelar
                    </Button>
                  ) : canDeleteInstitutions ? (
                    <Button type="button" variant="destructive" disabled={isSaving || !selectedInstitution} onClick={handleDelete}>
                      <Trash2 className="size-4" />
                      Eliminar
                    </Button>
                  ) : (
                    <Badge variant="outline">Sin permiso para eliminar</Badge>
                  )}
                </div>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow={isInstitutionScopedView ? (isDirectorView ? "Director" : "Institution admin") : "Superadmin"}
        title="Instituciones"
        description={
          isInstitutionScopedView
            ? isDirectorView
              ? `Vista institucional sobre ${scopedInstitutionName}, pensada para seguimiento general de operación, contacto y cobertura visible.`
              : `Vista operativa sobre ${scopedInstitutionName}. Ya cruza instituciones con usuarios y dispositivos reales.`
            : "La vista ahora conecta instituciones reales del backend con impacto operativo en usuarios y dispositivos."
        }
        actions={
          <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
            <div className="relative min-w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por institución, email, usuario o dispositivo"
                className="pl-9"
              />
            </div>
            <Button
              type="button"
              disabled={!canCreateInstitutions}
              onClick={openCreateInstitutionForm}
            >
              <UserPlus className="size-4" />
              {canCreateInstitutions ? "Nueva institución" : "Alta no disponible"}
            </Button>
          </div>
        }
      />

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-foreground">Alcance operativo</p>
              <Badge variant={isInstitutionScopedView ? "secondary" : "outline"}>
                {isInstitutionScopedView ? (isDirectorView ? "director" : "institution-admin") : "multi-institución / global"}
              </Badge>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {isInstitutionScopedView && scopedInstitutionName
                ? isDirectorView
                  ? `Estás siguiendo ${scopedInstitutionName}. La vista deja en primer plano contacto, cobertura y señales básicas de operación sin empujarte a una lectura administrativa más profunda.`
                  : `Estás operando sobre ${scopedInstitutionName}. La vista ya refleja el perímetro real expuesto por el backend.`
                : "Cada institución se muestra como unidad operativa con usuarios, dispositivos y datos de contacto conectados al backend real."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge variant={canCreateInstitutions ? "secondary" : "outline"}>{canCreateInstitutions ? "alta habilitada" : "sin alta"}</Badge>
              <Badge variant={canUpdateInstitutions ? "secondary" : "outline"}>{canUpdateInstitutions ? "edición habilitada" : "solo lectura"}</Badge>
              <Badge variant={canDeleteInstitutions ? "secondary" : "outline"}>{canDeleteInstitutions ? "baja habilitada" : "sin baja"}</Badge>
            </div>
          </div>
          {scopedInstitutionName ? <Badge variant="outline">Institución activa: {scopedInstitutionName}</Badge> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {institutionsQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)
        ) : (
          <>
            <SummaryCard
              label="Instituciones visibles"
              value={String(metrics.totalInstitutions)}
              hint="Listado real sobre /educational-center con scope backend aplicado."
              icon={Building2}
            />
            <SummaryCard
              label="Usuarios vinculados"
              value={String(metrics.totalUsersLinked)}
              hint="Cruce útil para saber qué instituciones tienen operación humana activa."
              icon={Users}
            />
            <SummaryCard
              label="Dispositivos vinculados"
              value={String(metrics.totalDevicesLinked)}
              hint="Ayuda a leer despliegue físico y cobertura operativa por cliente."
              icon={Smartphone}
            />
            <SummaryCard
              label="Grupos vinculados"
              value={String(metrics.totalClassesLinked)}
              hint="Ahora sale del backend compartido, útil para leer profundidad pedagógica por institución."
              icon={Building2}
            />
            <SummaryCard
              label="Estudiantes vinculados"
              value={String(metrics.totalStudentsLinked)}
              hint="También viene consolidado desde el backend para no depender solo del dashboard."
              icon={Users}
            />
            <SummaryCard
              label="Necesitan revisión"
              value={String(metrics.reviewInstitutions)}
              hint="Falta URL, teléfono o dirección básica para operar con comodidad."
              icon={ShieldCheck}
            />
            <SummaryCard
              label="Con logo cargado"
              value={String(metrics.institutionsWithLogo)}
              hint="Ayuda a cerrar identidad visual y reconocimiento rápido dentro del dashboard."
              icon={Building2}
            />
          </>
        )}
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Enfocar listado</p>
              <p className="text-sm text-muted-foreground">Priorizá instituciones con huecos de operación antes de editar datos base.</p>
            </div>
            <Badge variant="outline">{filtered.length} visibles</Badge>
          </div>
          <div className="flex flex-wrap gap-2">
          {focusSegments.map((segment) => (
            <Button
              key={segment.key}
              type="button"
              size="sm"
              variant={focusFilter === segment.key ? "default" : "outline"}
              onClick={() => setFocusFilter(segment.key)}
            >
              {segment.label}
              <Badge variant={focusFilter === segment.key ? "secondary" : "outline"} className={focusFilter === segment.key ? "bg-white/90 text-foreground" : ""}>
                {segment.count}
              </Badge>
            </Button>
          ))}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setFocusFilter("all");
              setQuery("");
            }}
          >
            Limpiar foco
          </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>{isDirectorView ? "Instituciones visibles para seguimiento" : "Mapa institucional"}</CardTitle>
                <CardDescription>
                  {isDirectorView
                    ? "Seleccioná una institución para revisar contacto, cobertura visible y señales generales de operación."
                    : "Seleccioná una institución para trabajar desde el cuerpo central: ver detalle, editar y operar sin saltar a barras laterales."}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="button" onClick={openCreateInstitutionForm} disabled={!canCreateInstitutions}>
                  <UserPlus className="size-4" />
                  {canCreateInstitutions ? "Nueva institución" : "Alta no disponible"}
                </Button>
                <Button type="button" variant="outline" onClick={openEditInstitutionForm} disabled={!selectedInstitution || mode === "create"}>
                  Editar seleccionada
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {institutionsQuery.isLoading ? (
              <div className="p-6">
                <Skeleton className="h-72 w-full rounded-none" />
              </div>
            ) : institutionsQuery.error ? (
              <div className="p-6 text-sm text-destructive">{getErrorMessage(institutionsQuery.error)}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Institución</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Usuarios</TableHead>
                    <TableHead>Dispositivos</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Actualizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        No hay instituciones para mostrar con los filtros actuales.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((item) => {
                      const active = mode === "edit" && selectedInstitution?.id === item.id;
                      return (
                        <TableRow key={item.id} className={cn("cursor-pointer", active && "border-primary/30 bg-primary/8")} onClick={() => selectInstitution(item)}>
                          <TableCell>
                            <div className="flex min-w-0 items-center gap-3">
                              <InstitutionAvatar name={item.name} imageUrl={item.imageUrl} className="size-10 text-[11px]" />
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">{item.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{item.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p>{item.phoneNumber || "-"}</p>
                              <p className="text-xs text-muted-foreground">{item.city || item.country || "Sin ubicación"}</p>
                            </div>
                          </TableCell>
                          <TableCell>{item.userCount}</TableCell>
                          <TableCell>{item.deviceCount}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Badge variant={item.status === "active" ? "success" : "outline"}>
                                {item.status === "active" ? "activa" : "eliminada"}
                              </Badge>
                              <Badge variant={item.imageUrl ? "secondary" : "outline"}>{item.imageUrl ? "logo" : "sin logo"}</Badge>
                              {item.needsReview ? <Badge variant="outline">revisar</Badge> : null}
                            </div>
                          </TableCell>
                          <TableCell>{formatDateTime(item.updatedAt || item.createdAt)}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {renderInstitutionEditorPanel()}

        <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
          <CardHeader>
            <CardTitle>Impacto operativo</CardTitle>
            <CardDescription>
              Cruce rápido entre la institución seleccionada, las personas vinculadas y el parque de dispositivos asociado.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {!selectedInstitution ? (
              <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
                Seleccioná una institución para revisar sus vínculos operativos.
              </div>
            ) : (
              <>
                <div className="rounded-2xl bg-background/70 p-4">
                  <div className="flex flex-wrap items-start gap-3">
                    <InstitutionAvatar name={selectedInstitution.name} imageUrl={selectedInstitution.imageUrl} className="size-16 text-base" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{selectedInstitution.name}</p>
                      <div className="mt-2 flex items-center gap-2 text-sm font-medium text-foreground">
                        <MapPin className="size-4 text-primary" />
                        <span className="min-w-0 truncate">{selectedInstitution.address?.addressFirstLine || "Sin dirección cargada"}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant={selectedInstitution.imageUrl ? "secondary" : "outline"}>
                      {selectedInstitution.imageUrl ? "logo institucional cargado" : "logo pendiente"}
                    </Badge>
                    {selectedInstitution.url ? (
                      <Badge variant="outline">
                        <Globe className="mr-1 size-3" />
                        {selectedInstitution.url}
                      </Badge>
                    ) : null}
                    {selectedInstitution.email ? (
                      <Badge variant="outline">
                        <Mail className="mr-1 size-3" />
                        {selectedInstitution.email}
                      </Badge>
                    ) : null}
                    {selectedInstitution.phoneNumber ? (
                      <Badge variant="outline">
                        <Phone className="mr-1 size-3" />
                        {selectedInstitution.phoneNumber}
                      </Badge>
                    ) : null}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">Usuarios vinculados</p>
                  <div className="mt-3 grid gap-3">
                    {previewUsers.length > 0 ? (
                      previewUsers.map((user) => (
                        <div key={user.id} className="rounded-2xl bg-background/70 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-white text-xs font-semibold text-primary">
                                {user.imageUrl ? (
                                  <img src={user.imageUrl} alt={user.fullName} className="h-full w-full object-cover" />
                                ) : (
                                  user.fullName.slice(0, 1).toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">{user.fullName}</p>
                                <p className="mt-1 truncate text-xs text-muted-foreground">{user.email}</p>
                              </div>
                            </div>
                            <Badge variant="secondary">{user.userType}</Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {user.roleCodes.map((roleCode) => (
                              <Badge key={roleCode} variant="outline">{roleCode}</Badge>
                            ))}
                            {user.updatedAt ? <Badge variant="outline">act. {formatDateTime(user.updatedAt)}</Badge> : null}
                          </div>
                        </div>
                      ))
                    ) : selectedInstitution.linkedUserNames.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedInstitution.linkedUserNames.slice(0, 8).map((name) => (
                          <Badge key={name} variant="secondary">{name}</Badge>
                        ))}
                      </div>
                    ) : (
                      <Badge variant="outline">sin usuarios vinculados</Badge>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">Dispositivos vinculados</p>
                  <div className="mt-3 grid gap-3">
                    {previewDevices.length > 0 ? (
                      previewDevices.map((device) => (
                        <div key={device.id} className="rounded-2xl bg-background/70 p-3">
                          <p className="text-sm font-medium text-foreground">{device.name}</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline">{device.deviceId}</Badge>
                            {device.updatedAt ? <Badge variant="outline">act. {formatDateTime(device.updatedAt)}</Badge> : null}
                          </div>
                        </div>
                      ))
                    ) : selectedInstitution.linkedDeviceNames.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedInstitution.linkedDeviceNames.slice(0, 8).map((name) => (
                          <Badge key={name} variant="outline">{name}</Badge>
                        ))}
                      </div>
                    ) : (
                      <Badge variant="outline">sin dispositivos vinculados</Badge>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">Grupos vinculados</p>
                  <div className="mt-3 grid gap-3">
                    {previewClassGroups.length > 0 ? (
                      previewClassGroups.map((classGroup) => (
                        <div key={classGroup.id} className="rounded-2xl bg-background/70 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">{classGroup.name}</p>
                            <Badge variant="secondary">{classGroup.studentCount} estudiantes</Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant="outline">{classGroup.code}</Badge>
                            {classGroup.updatedAt ? <Badge variant="outline">act. {formatDateTime(classGroup.updatedAt)}</Badge> : null}
                          </div>
                        </div>
                      ))
                    ) : (
                      <Badge variant="outline">sin grupos vinculados</Badge>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">grupos</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{selectedInstitution.classGroupCount}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Conteo expuesto por el backend compartido.</p>
                  </div>
                  <div className="rounded-2xl bg-background/70 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">estudiantes</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{selectedInstitution.studentCount}</p>
                    <p className="mt-1 text-sm text-muted-foreground">Sirve para entender el peso real de la institución.</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <CardTitle>Instituciones que conviene revisar</CardTitle>
          <CardDescription>
            Señales rápidas para completar contacto, dirección o presencia web antes de seguir escalando operación.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {institutionsQuery.isLoading ? (
            Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)
          ) : institutionRows.filter((item) => item.needsReview).length === 0 ? (
            <div className="rounded-2xl bg-background/70 p-4 text-sm text-muted-foreground">
              No aparecen instituciones con observaciones básicas. Buen momento para avanzar a salud o syncs por cliente.
            </div>
          ) : (
            institutionRows
              .filter((item) => item.needsReview)
              .slice(0, 6)
              .map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectInstitution(item)}
                  className="rounded-2xl border border-border bg-white/80 p-4 text-left transition hover:border-primary/40 hover:bg-primary/5"
                >
                  <p className="text-sm font-semibold text-foreground">{item.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.email}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!item.phoneNumber ? <Badge variant="outline">sin teléfono</Badge> : null}
                    {!item.url ? <Badge variant="outline">sin URL</Badge> : null}
                    {!item.address?.addressFirstLine ? <Badge variant="outline">sin dirección</Badge> : null}
                    {!item.imageUrl ? <Badge variant="outline">sin logo</Badge> : null}
                    {item.userCount > 0 ? <Badge variant="secondary">{item.userCount} usuarios</Badge> : null}
                    {item.deviceCount > 0 ? <Badge variant="outline">{item.deviceCount} dispositivos</Badge> : null}
                  </div>
                </button>
              ))
          )}
        </CardContent>
      </Card>

      <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="size-5 text-primary" />
            Grupos y perfiles de jugadores
          </CardTitle>
          <CardDescription>
            Sin cambiar la base ni los contratos actuales: esta vista toma los grupos visibles y te deja ver los estudiantes/perfiles que quedaron dentro de cada uno.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {!selectedInstitution ? (
            <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
              Seleccioná una institución para ver sus grupos y los perfiles/jugadores asociados.
            </div>
          ) : (
            <>
              <div className="rounded-[26px] border border-border/70 bg-background/65 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Grupos visibles</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Elegí un grupo para ver quiénes quedaron cargados dentro.
                    </p>
                  </div>
                  <Badge variant="secondary">{selectedInstitution.classGroupCount} grupos</Badge>
                </div>

                <div className="mt-4 grid gap-3">
                  {institutionClassGroupsQuery.isLoading ? (
                    Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-2xl" />)
                  ) : institutionClassGroups.length > 0 ? (
                    institutionClassGroups.map((group) => {
                      const preview = previewClassGroups.find((item) => item.id === group.id);
                      const count = preview?.studentCount ?? 0;
                      const isSelected = selectedGroup?.id === group.id;

                      return (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => setSelectedGroupId(group.id)}
                          className={cn(
                            "rounded-2xl border p-4 text-left transition",
                            isSelected
                              ? "border-primary/40 bg-primary/8 shadow-[0_12px_28px_rgba(66,128,164,0.14)]"
                              : "border-border bg-white/85 hover:border-primary/30 hover:bg-primary/5",
                          )}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-foreground">{group.name}</p>
                            <Badge variant={isSelected ? "secondary" : "outline"}>{count} perfiles</Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <Badge variant="outline">{group.code}</Badge>
                            {group.updatedAt ? <Badge variant="outline">act. {formatDateTime(group.updatedAt)}</Badge> : null}
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
                      Esta institución todavía no tiene grupos visibles. Podés crearlos abajo desde la carga por Excel.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-[26px] border border-border/70 bg-background/65 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Perfiles dentro del grupo</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {selectedGroup
                          ? `Grupo activo: ${selectedGroup.name}. Elegí un estudiante para ver su detalle, partidas y rendimiento.`
                          : "Elegí un grupo a la izquierda para ver los perfiles cargados."}
                      </p>
                    </div>
                    {selectedGroup ? <Badge variant="secondary">{filteredStudentPerformanceRows.length} visibles</Badge> : null}
                  </div>

                  {selectedGroup ? (
                    <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                      <div className="relative">
                        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={studentSearchQuery}
                          onChange={(event) => setStudentSearchQuery(event.target.value)}
                          placeholder="Buscar estudiante por nombre o documento / ID"
                          className="pl-9"
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" variant={studentVisibilityFilter === "all" ? "secondary" : "outline"} onClick={() => setStudentVisibilityFilter("all")}>
                          Todos
                        </Button>
                        <Button type="button" size="sm" variant={studentVisibilityFilter === "with_games" ? "secondary" : "outline"} onClick={() => setStudentVisibilityFilter("with_games")}>
                          Con partidas
                        </Button>
                        <Button type="button" size="sm" variant={studentVisibilityFilter === "without_games" ? "secondary" : "outline"} onClick={() => setStudentVisibilityFilter("without_games")}>
                          Sin partidas
                        </Button>
                        <Button type="button" size="sm" variant={studentSort === "activity" ? "secondary" : "outline"} onClick={() => setStudentSort("activity")}>
                          Más actividad
                        </Button>
                        <Button type="button" size="sm" variant={studentSort === "name" ? "secondary" : "outline"} onClick={() => setStudentSort("name")}>
                          A-Z
                        </Button>
                        <Button type="button" size="sm" variant={studentSort === "performance" ? "secondary" : "outline"} onClick={() => setStudentSort("performance")}>
                          Mejor rendimiento
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {!selectedGroup ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
                      Todavía no hay un grupo seleccionado.
                    </div>
                  ) : studentsQuery.error ? (
                    <div className="mt-4 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                      No pude recuperar los estudiantes del grupo. {getErrorMessage(studentsQuery.error)}
                    </div>
                  ) : studentsQuery.isLoading ? (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)}
                    </div>
                  ) : filteredStudentPerformanceRows.length > 0 ? (
                    <div className="mt-4 overflow-hidden rounded-2xl border border-border/70 bg-white/85">
                      <div className="hidden grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_120px_120px_110px] gap-3 border-b border-border/70 bg-muted/30 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground md:grid">
                        <p>Estudiante</p>
                        <p>Documento / ID</p>
                        <p>Partidas</p>
                        <p>Turnos</p>
                        <p>Acierto</p>
                      </div>
                      <div className="divide-y divide-border/70">
                        {filteredStudentPerformanceRows.map((entry) => {
                          const student = entry.student;
                          const isSelected = selectedStudent?.id === student.id;

                          return (
                            <div key={student.id} className={cn("overflow-hidden", isSelected ? "bg-primary/4" : "") }>
                              <div
                                className={cn(
                                  "grid w-full gap-3 px-4 py-4 text-left transition md:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)_120px_120px_110px] md:items-center",
                                  isSelected ? "bg-primary/8" : "hover:bg-primary/5",
                                )}
                              >
                                <div className="flex min-w-0 items-start gap-3">
                                  <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-primary/10 font-semibold text-primary">
                                    {student.imageUrl ? (
                                      <img src={student.imageUrl} alt={student.fullName} className="h-full w-full object-cover" />
                                    ) : (
                                      <span>{getPersonInitials(student.fullName)}</span>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        type="button"
                                        aria-expanded={isSelected}
                                        aria-controls={`student-accordion-${student.id}`}
                                        onClick={() => {
                                          if (isSelected) {
                                            setSelectedStudentId(null);
                                            setAnalyticsScope("group");
                                            return;
                                          }

                                          setSelectedStudentId(student.id);
                                          setAnalyticsScope("student");
                                        }}
                                        className="inline-flex max-w-full items-center gap-2 rounded-md text-left text-sm font-semibold text-foreground transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                                      >
                                        <span className="truncate">{student.fullName}</span>
                                        {isSelected ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
                                      </button>
                                      {isSelected ? <Badge variant="secondary">seleccionado</Badge> : null}
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground">Última actividad: {formatDateTime(entry.lastParticipation)}</p>
                                    <p className="mt-1 text-xs text-muted-foreground">{isSelected ? "Ocultar detalle" : "Ver detalle"}</p>
                                  </div>
                                </div>
                                <div className="text-sm text-foreground">
                                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground md:hidden">Documento / ID</p>
                                  <p className="font-medium">{student.fileNumber || "-"}</p>
                                </div>
                                <div className="text-sm text-foreground">
                                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground md:hidden">Partidas</p>
                                  <p className="font-medium">{entry.gamesCount}</p>
                                </div>
                                <div className="text-sm text-foreground">
                                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground md:hidden">Turnos</p>
                                  <p className="font-medium">{entry.turnsCount}</p>
                                </div>
                                <div className="text-sm text-foreground">
                                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground md:hidden">Acierto</p>
                                  <Badge variant={entry.successRate >= 70 ? "success" : entry.successRate >= 40 ? "secondary" : "outline"}>{entry.successRate}%</Badge>
                                </div>
                              </div>

                              {isSelected ? (
                                <div id={`student-accordion-${student.id}`} className="border-t border-border/70 bg-background/40 px-4 py-4 md:pl-[5.2rem]">
                                  <div className="grid gap-4">
                                    <div className="rounded-2xl border border-border/70 bg-white/85 p-4">
                                      <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                          <p className="text-sm font-medium text-foreground">Analítica temporal</p>
                                          <p className="mt-1 text-sm text-muted-foreground">
                                            {analyticsTitle}: {analyticsDescription}
                                          </p>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          <Button type="button" size="sm" variant={analyticsScope === "group" ? "secondary" : "outline"} onClick={() => setAnalyticsScope("group")}>
                                            Ver grupo
                                          </Button>
                                          <Button type="button" size="sm" variant={analyticsScope === "student" ? "secondary" : "outline"} onClick={() => setAnalyticsScope("student")}>
                                            Ver estudiante
                                          </Button>
                                        </div>
                                      </div>

                                      <div className="mt-4 grid gap-4 xl:grid-cols-3">
                                        <div className="rounded-2xl bg-background/70 p-4">
                                          <p className="text-sm font-medium text-foreground">Turnos por fecha</p>
                                          <p className="mt-1 text-sm text-muted-foreground">Cantidad de turnos visibles a lo largo del tiempo.</p>
                                          <div className="mt-4 h-60">
                                            {gamesQuery.error ? (
                                              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-destructive/40 bg-destructive/5 px-4 text-center text-sm text-destructive">
                                                No pude cargar la serie temporal. {getErrorMessage(gamesQuery.error)}
                                              </div>
                                            ) : analyticsSeries.length > 0 ? (
                                              <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={analyticsSeries}>
                                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7dcc9" />
                                                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                                                  <YAxis tickLine={false} axisLine={false} fontSize={12} width={30} />
                                                  <Tooltip />
                                                  <Bar dataKey="turnos" fill="#47b9ef" radius={[8, 8, 0, 0]} />
                                                </BarChart>
                                              </ResponsiveContainer>
                                            ) : (
                                              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
                                                Todavía no hay turnos visibles para graficar.
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        <div className="rounded-2xl bg-background/70 p-4">
                                          <p className="text-sm font-medium text-foreground">Partidas por fecha</p>
                                          <p className="mt-1 text-sm text-muted-foreground">Permite ver la frecuencia de uso por día.</p>
                                          <div className="mt-4 h-60">
                                            {gamesQuery.error ? (
                                              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-destructive/40 bg-destructive/5 px-4 text-center text-sm text-destructive">
                                                No pude cargar la serie temporal. {getErrorMessage(gamesQuery.error)}
                                              </div>
                                            ) : analyticsSeries.length > 0 ? (
                                              <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={analyticsSeries}>
                                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7dcc9" />
                                                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                                                  <YAxis tickLine={false} axisLine={false} fontSize={12} width={30} />
                                                  <Tooltip />
                                                  <Bar dataKey="partidas" fill="#1f2a37" radius={[8, 8, 0, 0]} />
                                                </BarChart>
                                              </ResponsiveContainer>
                                            ) : (
                                              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
                                                Todavía no hay partidas visibles para graficar.
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        <div className="rounded-2xl bg-background/70 p-4">
                                          <p className="text-sm font-medium text-foreground">Porcentaje de acierto</p>
                                          <p className="mt-1 text-sm text-muted-foreground">Evolución de aciertos según el período visible.</p>
                                          <div className="mt-4 h-60">
                                            {gamesQuery.error ? (
                                              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-destructive/40 bg-destructive/5 px-4 text-center text-sm text-destructive">
                                                No pude cargar la serie temporal. {getErrorMessage(gamesQuery.error)}
                                              </div>
                                            ) : analyticsSeries.length > 0 ? (
                                              <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={analyticsSeries}>
                                                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e7dcc9" />
                                                  <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
                                                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} fontSize={12} width={30} />
                                                  <Tooltip />
                                                  <Bar dataKey="acierto" fill="#6d5efc" radius={[8, 8, 0, 0]} />
                                                </BarChart>
                                              </ResponsiveContainer>
                                            ) : (
                                              <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
                                                Todavía no hay porcentaje de acierto para graficar.
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                                      <div className="rounded-2xl border border-border/70 bg-white/85 p-4">
                                        <div className="flex items-start gap-3">
                                          <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border/70 bg-primary/10 font-semibold text-primary">
                                            {selectedStudent?.imageUrl ? (
                                              <img src={selectedStudent.imageUrl} alt={selectedStudent.fullName} className="h-full w-full object-cover" />
                                            ) : (
                                              <span>{getPersonInitials(selectedStudent?.fullName || student.fullName)}</span>
                                            )}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <p className="truncate text-base font-semibold text-foreground">{selectedStudent?.fullName || student.fullName}</p>
                                            <div className="mt-2 flex flex-wrap gap-2">
                                              <Badge variant="outline">Documento / ID: {selectedStudent?.fileNumber || student.fileNumber}</Badge>
                                              <Badge variant="secondary">{selectedGroup?.name}</Badge>
                                              {selectedStudent?.updatedAt ? <Badge variant="outline">act. {formatDateTime(selectedStudent.updatedAt)}</Badge> : null}
                                            </div>
                                          </div>
                                        </div>

                                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                          <div className="rounded-2xl bg-background/70 p-3">
                                            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Partidas</p>
                                            <p className="mt-2 text-2xl font-semibold text-foreground">{selectedStudentPerformance?.gamesCount ?? 0}</p>
                                          </div>
                                          <div className="rounded-2xl bg-background/70 p-3">
                                            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Turnos</p>
                                            <p className="mt-2 text-2xl font-semibold text-foreground">{selectedStudentPerformance?.turnsCount ?? 0}</p>
                                          </div>
                                          <div className="rounded-2xl bg-background/70 p-3">
                                            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Acierto</p>
                                            <p className="mt-2 text-2xl font-semibold text-foreground">{selectedStudentPerformance?.successRate ?? 0}%</p>
                                          </div>
                                          <div className="rounded-2xl bg-background/70 p-3">
                                            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Tiempo medio</p>
                                            <p className="mt-2 text-2xl font-semibold text-foreground">{formatDurationSeconds(selectedStudentPerformance?.averageTurnSeconds ?? 0)}</p>
                                          </div>
                                        </div>

                                        <div className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
                                          <p>Última participación: {formatDateTime(selectedStudentPerformance?.lastParticipation)}</p>
                                          <p>Partidas con datos visibles: {selectedStudentGameRows.length}</p>
                                        </div>
                                      </div>

                                      <div className="rounded-2xl border border-border/70 bg-white/85 p-4">
                                        <p className="text-sm font-medium text-foreground">Partidas en las que participó</p>
                                        <p className="mt-1 text-sm text-muted-foreground">Listado operativo para ver cuándo jugó, cuántos turnos tuvo y cómo rindió en cada partida.</p>
                                        {selectedStudentGameRows.length > 0 ? (
                                          <div className="relative mt-4">
                                            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                                            <Input
                                              value={studentGamesSearchQuery}
                                              onChange={(event) => setStudentGamesSearchQuery(event.target.value)}
                                              placeholder="Buscar partida por nombre o fecha"
                                              className="pl-9"
                                            />
                                          </div>
                                        ) : null}
                                        <div className="mt-4 grid gap-3">
                                          {gamesQuery.error ? (
                                            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                                              No pude recuperar las partidas visibles de este estudiante. {getErrorMessage(gamesQuery.error)}
                                            </div>
                                          ) : gamesQuery.isLoading ? (
                                            Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-2xl" />)
                                          ) : filteredSelectedStudentGameRows.length > 0 ? (
                                            filteredSelectedStudentGameRows.map((game) => (
                                              <div key={game.id} className="rounded-2xl bg-background/70 p-4">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                  <p className="text-sm font-semibold text-foreground">{game.label}</p>
                                                  <Badge variant="secondary">{game.successRate}% aciertos</Badge>
                                                </div>
                                                <div className="mt-2 flex flex-wrap gap-2">
                                                  <Badge variant="outline">{game.turnCount} turnos</Badge>
                                                  <Badge variant="outline">tiempo medio {formatDurationSeconds(game.avgTurnSeconds)}</Badge>
                                                  {game.playedAt ? <Badge variant="outline">{formatDateTime(game.playedAt)}</Badge> : null}
                                                </div>
                                              </div>
                                            ))
                                          ) : selectedStudentGameRows.length > 0 ? (
                                            <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
                                              No encontré partidas que coincidan con la búsqueda activa para este estudiante.
                                            </div>
                                          ) : (
                                            <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
                                              Este estudiante todavía no registra partidas visibles en `game-data` para esta institución.
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : selectedGroupStudents.length > 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
                      No encontré estudiantes que coincidan con la búsqueda o los filtros activos.
                    </div>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
                      Este grupo todavía no tiene perfiles cargados. Cuando subas el Excel, van a aparecer acá.
                    </div>
                  )}
              </div>

            </>
          )}
        </CardContent>
      </Card>

      <StudentImportPanel
        token={tokens?.accessToken}
        institutionId={selectedInstitution?.id ?? null}
        institutionName={selectedInstitution?.name ?? null}
        user={currentUser}
      />
    </div>
  );
}
