"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Gamepad2, Pencil, Plus, Trash2, UserRound, Users } from "lucide-react";
import { DeleteRecordDialog } from "@/components/delete-record-dialog";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/auth-context";
import { useGames } from "@/features/games/api";
import type { GamePlayerRecord } from "@/features/games/types";
import { useLanguage, type AppLanguage } from "@/features/i18n/i18n-context";
import {
  createHomeProfile,
  createProfileBinding,
  deleteHomeProfile,
  updateHomeProfile,
  useProfilesOverview,
} from "@/features/profiles/api";
import type { ProfileOverviewRecord } from "@/features/profiles/types";
import { getErrorMessage } from "@/lib/utils";

type DetectedPlayer = {
  cardUid: string;
  color: string | null;
  gameCount: number;
  turnCount: number;
  bleDeviceId: string | null;
};

type EditorState = {
  profile: ProfileOverviewRecord | null;
  candidate: DetectedPlayer | null;
} | null;

const messages: Record<AppLanguage, {
  eyebrow: string;
  title: string;
  description: string;
  add: string;
  saved: string;
  detected: string;
  cards: string;
  games: string;
  emptyTitle: string;
  emptyDescription: string;
  detectedTitle: string;
  detectedDescription: string;
  import: string;
  edit: string;
  remove: string;
  noCard: string;
  sessions: string;
  editorCreate: string;
  editorEdit: string;
  name: string;
  age: string;
  cancel: string;
  save: string;
  deleteTitle: string;
  deleteDescription: string;
  error: string;
}> = {
  es: {
    eyebrow: "Familia",
    title: "Jugadores",
    description: "Administra los jugadores de tu familia, sus tarjetas y la actividad vinculada a cada perfil.",
    add: "Agregar jugador",
    saved: "Jugadores guardados",
    detected: "Tarjetas detectadas",
    cards: "Tarjetas vinculadas",
    games: "Partidas visibles",
    emptyTitle: "Todavía no hay jugadores guardados",
    emptyDescription: "Las partidas descargadas llegaron con participantes genéricos. Puedes convertir las tarjetas detectadas en jugadores y asignarles el nombre correcto.",
    detectedTitle: "Participantes detectados en las partidas",
    detectedDescription: "Estas tarjetas aparecieron en el historial descargado y todavía no están asociadas a un jugador editable.",
    import: "Crear jugador",
    edit: "Editar",
    remove: "Eliminar",
    noCard: "Sin tarjeta vinculada",
    sessions: "sesiones",
    editorCreate: "Crear jugador",
    editorEdit: "Editar jugador",
    name: "Nombre",
    age: "Edad (opcional)",
    cancel: "Cancelar",
    save: "Guardar",
    deleteTitle: "Eliminar jugador",
    deleteDescription: "El jugador dejará de estar disponible y también se desactivará su asociación con la tarjeta.",
    error: "No se pudo completar la operación.",
  },
  en: {
    eyebrow: "Family",
    title: "Players",
    description: "Manage your family players, their cards, and the activity linked to each profile.",
    add: "Add player",
    saved: "Saved players",
    detected: "Detected cards",
    cards: "Linked cards",
    games: "Visible games",
    emptyTitle: "No saved players yet",
    emptyDescription: "Downloaded games arrived with generic participants. You can turn detected cards into players and assign the correct names.",
    detectedTitle: "Participants detected in games",
    detectedDescription: "These cards appeared in downloaded history and are not associated with an editable player yet.",
    import: "Create player",
    edit: "Edit",
    remove: "Delete",
    noCard: "No linked card",
    sessions: "sessions",
    editorCreate: "Create player",
    editorEdit: "Edit player",
    name: "Name",
    age: "Age (optional)",
    cancel: "Cancel",
    save: "Save",
    deleteTitle: "Delete player",
    deleteDescription: "The player will no longer be available and the card association will also be disabled.",
    error: "The operation could not be completed.",
  },
  pt: {
    eyebrow: "Família",
    title: "Jogadores",
    description: "Gerencie os jogadores da família, seus cartões e a atividade vinculada a cada perfil.",
    add: "Adicionar jogador",
    saved: "Jogadores salvos",
    detected: "Cartões detectados",
    cards: "Cartões vinculados",
    games: "Partidas visíveis",
    emptyTitle: "Ainda não há jogadores salvos",
    emptyDescription: "As partidas baixadas chegaram com participantes genéricos. Você pode transformar os cartões detectados em jogadores e atribuir os nomes corretos.",
    detectedTitle: "Participantes detectados nas partidas",
    detectedDescription: "Estes cartões apareceram no histórico e ainda não estão associados a um jogador editável.",
    import: "Criar jogador",
    edit: "Editar",
    remove: "Excluir",
    noCard: "Sem cartão vinculado",
    sessions: "sessões",
    editorCreate: "Criar jogador",
    editorEdit: "Editar jogador",
    name: "Nome",
    age: "Idade (opcional)",
    cancel: "Cancelar",
    save: "Salvar",
    deleteTitle: "Excluir jogador",
    deleteDescription: "O jogador deixará de estar disponível e a associação com o cartão também será desativada.",
    error: "Não foi possível concluir a operação.",
  },
};

function normalizeCardUid(player: GamePlayerRecord) {
  const rawUid = player.externalPlayerUid?.trim() || "";
  if (!rawUid) return "";
  const markerIndex = rawUid.toLowerCase().lastIndexOf("-id-");
  return (markerIndex >= 0 ? rawUid.slice(markerIndex + 4) : rawUid).toUpperCase();
}

function detectedPlayerName(candidate: DetectedPlayer) {
  const color = candidate.color?.trim() || "sin color";
  const shortCardId = candidate.cardUid.length >= 6 ? candidate.cardUid.slice(2, 6) : candidate.cardUid;
  return `Jugador ${color} ${shortCardId}`;
}

export function FamilyPlayers() {
  const { language } = useLanguage();
  const text = messages[language];
  const { tokens } = useAuth();
  const queryClient = useQueryClient();
  const profilesQuery = useProfilesOverview(tokens?.accessToken);
  const gamesQuery = useGames(tokens?.accessToken, { page: 1, limit: 100, sortBy: "created_at", order: "desc" });
  const [editor, setEditor] = useState<EditorState>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProfileOverviewRecord | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [age, setAge] = useState("");

  const profiles = useMemo(() => profilesQuery.data || [], [profilesQuery.data]);
  const games = useMemo(() => gamesQuery.data?.data || [], [gamesQuery.data?.data]);
  const detectedPlayers = useMemo(() => {
    const byCard = new Map<string, DetectedPlayer & { gameIds: Set<string>; turnIds: Set<string> }>();
    for (const game of games) {
      for (const player of game.players) {
        const cardUid = normalizeCardUid(player);
        if (!cardUid) continue;
        const current = byCard.get(cardUid) || {
          cardUid,
          color: player.cardColor || null,
          gameCount: 0,
          turnCount: 0,
          bleDeviceId: game.bleDeviceId || null,
          gameIds: new Set<string>(),
          turnIds: new Set<string>(),
        };
        current.gameIds.add(game.id);
        for (const turn of game.turns) {
          if (turn.gamePlayerId === player.id || normalizeCardUid({ ...player, externalPlayerUid: turn.externalPlayerUid }) === cardUid) {
            current.turnIds.add(turn.id);
          }
        }
        byCard.set(cardUid, current);
      }
    }
    return [...byCard.values()].map((candidate) => ({
      cardUid: candidate.cardUid,
      color: candidate.color,
      gameCount: candidate.gameIds.size,
      turnCount: candidate.turnIds.size,
      bleDeviceId: candidate.bleDeviceId,
    })).sort((left, right) => right.gameCount - left.gameCount || left.cardUid.localeCompare(right.cardUid));
  }, [games]);
  const boundCardUids = useMemo(() => new Set(profiles.flatMap((profile) => profile.cardUids.map((cardUid) => cardUid.toUpperCase()))), [profiles]);
  const unboundDetectedPlayers = detectedPlayers.filter((candidate) => !boundCardUids.has(candidate.cardUid));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tokens?.accessToken) throw new Error("Missing access token");
      const parsedAge = age.trim() ? Number(age) : null;
      if (editor?.profile) {
        await updateHomeProfile(tokens.accessToken, editor.profile.id, {
          displayName: displayName.trim(),
          age: Number.isFinite(parsedAge) ? parsedAge : null,
          ageCategory: editor.profile.ageCategory || "family",
          isActive: true,
        });
        return;
      }
      const created = await createHomeProfile(tokens.accessToken, {
        displayName: displayName.trim(),
        age: Number.isFinite(parsedAge) ? parsedAge : null,
        ageCategory: "family",
      });
      const profileId = String(created.id || "");
      if (profileId && editor?.candidate) {
        await createProfileBinding(tokens.accessToken, {
          profileId,
          cardUid: editor.candidate.cardUid,
          bleDeviceId: editor.candidate.bleDeviceId,
        });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profiles-overview"] });
      setEditor(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (profile: ProfileOverviewRecord) => {
      if (!tokens?.accessToken) throw new Error("Missing access token");
      await deleteHomeProfile(tokens.accessToken, profile.id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profiles-overview"] });
      setDeleteTarget(null);
    },
  });

  function openEditor(profile: ProfileOverviewRecord | null, candidate: DetectedPlayer | null = null) {
    setDisplayName(profile?.displayName || (candidate ? detectedPlayerName(candidate) : ""));
    setAge(profile?.age == null ? "" : String(profile.age));
    setEditor({ profile, candidate });
  }

  const isLoading = profilesQuery.isLoading || gamesQuery.isLoading;
  const error = profilesQuery.error || gamesQuery.error || saveMutation.error || deleteMutation.error;

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow={text.eyebrow}
        title={text.title}
        description={text.description}
        actions={<Button onClick={() => openEditor(null)}><Plus className="size-4" />{text.add}</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: text.saved, value: profiles.length, icon: Users },
          { label: text.detected, value: detectedPlayers.length, icon: UserRound },
          { label: text.cards, value: boundCardUids.size, icon: CreditCard },
          { label: text.games, value: gamesQuery.data?.total || games.length, icon: Gamepad2 },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}><CardContent className="flex items-center justify-between p-5"><div><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-semibold">{value}</p></div><div className="rounded-2xl bg-primary/10 p-3 text-primary"><Icon className="size-5" /></div></CardContent></Card>
        ))}
      </div>

      {error ? <Card className="border-destructive/30"><CardContent className="p-5 text-sm text-destructive">{text.error} {getErrorMessage(error)}</CardContent></Card> : null}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2"><Skeleton className="h-56 rounded-[24px]" /><Skeleton className="h-56 rounded-[24px]" /></div>
      ) : profiles.length === 0 ? (
        <Card><CardHeader><CardTitle>{text.emptyTitle}</CardTitle><CardDescription>{text.emptyDescription}</CardDescription></CardHeader></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {profiles.map((profile) => (
            <Card key={profile.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3"><div><CardTitle>{profile.displayName}</CardTitle><CardDescription>{profile.age == null ? text.noCard : `${profile.age} años`}</CardDescription></div><Badge variant={profile.isActive ? "success" : "outline"}>{profile.isActive ? "activo" : "inactivo"}</Badge></div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2"><Badge variant="outline"><CreditCard className="mr-1 size-3" />{profile.cardUids[0] || text.noCard}</Badge><Badge variant="outline">{profile.sessionCount} {text.sessions}</Badge></div>
                <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => openEditor(profile)}><Pencil className="size-3.5" />{text.edit}</Button><Button variant="ghost" size="sm" onClick={() => setDeleteTarget(profile)}><Trash2 className="size-3.5" />{text.remove}</Button></div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {unboundDetectedPlayers.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>{text.detectedTitle}</CardTitle><CardDescription>{text.detectedDescription}</CardDescription></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {unboundDetectedPlayers.map((candidate) => (
              <div key={candidate.cardUid} className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-white/80 p-4">
                <div className="min-w-0"><p className="font-medium text-foreground">{detectedPlayerName(candidate)}</p><p className="mt-1 truncate text-xs text-muted-foreground">{candidate.cardUid} · {candidate.gameCount} {text.sessions} · {candidate.turnCount} turnos</p></div>
                <Button size="sm" variant="outline" onClick={() => openEditor(null, candidate)}>{text.import}</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Modal open={Boolean(editor)} onClose={() => setEditor(null)} title={editor?.profile ? text.editorEdit : text.editorCreate} className="max-w-xl">
        <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); if (displayName.trim()) saveMutation.mutate(); }}>
          <label className="block space-y-2"><span className="text-sm font-medium">{text.name}</span><Input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required maxLength={100} /></label>
          <label className="block space-y-2"><span className="text-sm font-medium">{text.age}</span><Input value={age} onChange={(event) => setAge(event.target.value)} type="number" min="0" max="130" /></label>
          {editor?.candidate ? <Badge variant="outline"><CreditCard className="mr-1 size-3" />{editor.candidate.cardUid}</Badge> : null}
          <div className="flex justify-end gap-3"><Button type="button" variant="outline" onClick={() => setEditor(null)}>{text.cancel}</Button><Button type="submit" disabled={!displayName.trim() || saveMutation.isPending}>{text.save}</Button></div>
        </form>
      </Modal>

      <DeleteRecordDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title={text.deleteTitle}
        description={text.deleteDescription}
        isPending={deleteMutation.isPending}
        onConfirm={() => { if (deleteTarget) deleteMutation.mutate(deleteTarget); }}
      />
    </div>
  );
}
