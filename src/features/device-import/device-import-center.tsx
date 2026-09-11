"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BarChart3, Cable, CheckCircle2, ChevronLeft, ChevronRight, Cpu, Download, List, LoaderCircle, Power, Trash2, UploadCloud, Users } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useAuth } from "@/features/auth/auth-context";
import { buildGamesBatchPayload, buildRawSyncEnvelopes } from "@/features/device-import/payload";
import { flashMagicBoxFirmware, resolveCableFirmwareRelease } from "@/features/device-import/firmware-updater";
import { ImportedGameCharts } from "@/features/device-import/imported-game-charts";
import { SyncNavigation } from "@/features/syncs/sync-navigation";
import type { ImportedGame, MagicBoxDeviceInfo, ParticipantTarget } from "@/features/device-import/types";
import { MagicBoxSerialClient, supportsWebSerial } from "@/features/device-import/web-serial";
import { useDevices } from "@/features/devices/api";
import { uploadGamesBatch, uploadRawGameSync } from "@/features/games/api";
import { buildGameDetailHref, buildGamesOverviewHref } from "@/features/games/game-route";
import type { GameRecord } from "@/features/games/types";
import { useInstitutions } from "@/features/institutions/api";
import { createHomeProfile, useProfilesOverview } from "@/features/profiles/api";
import { useOtaRelease } from "@/features/settings/api";
import { useAllStudents } from "@/features/students/api";
import { getErrorMessage } from "@/lib/utils";

type Phase = "idle" | "connected" | "reading" | "ready" | "uploading";
type GameView = "players" | "analytics";
type Feedback = { kind: "success" | "error" | "info"; title: string; message: string; showGameLinks?: boolean };
const COLOR_LABELS: Record<string, string> = { AM: "Amarillo", NA: "Naranja", VE: "Verde", VI: "Violeta", CI: "Celeste", MA: "Rojo" };

function cleanDeviceId(value: string) {
  return value.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
}

function formatGameDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no informada";
  return new Intl.DateTimeFormat("es-UY", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function DeviceImportCenter() {
  const { tokens, user } = useAuth();
  const queryClient = useQueryClient();
  const students = useAllStudents(tokens?.accessToken, { institutionId: user?.educationalCenterId || undefined });
  const profiles = useProfilesOverview(tokens?.accessToken);
  const devicesQuery = useDevices(tokens?.accessToken);
  const institutionsQuery = useInstitutions(tokens?.accessToken);
  const otaRelease = useOtaRelease(tokens?.accessToken);
  const cableRelease = resolveCableFirmwareRelease(otaRelease.data ? {
    downloadUrl: otaRelease.data.downloadUrl || "",
    sha256: otaRelease.data.sha256,
    sizeBytes: otaRelease.data.sizeBytes,
    version: otaRelease.data.latestVersion,
  } : null);
  const clientRef = useRef<MagicBoxSerialClient | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [deviceId, setDeviceId] = useState("");
  const [deviceInfo, setDeviceInfo] = useState<MagicBoxDeviceInfo | null>(null);
  const [deviceStatus, setDeviceStatus] = useState("");
  const [games, setGames] = useState<ImportedGame[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [gameView, setGameView] = useState<GameView>("players");
  const [uploadedGames, setUploadedGames] = useState<GameRecord[]>([]);
  const [deletedGameIds, setDeletedGameIds] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [newProfileName, setNewProfileName] = useState("");
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [isUpdatingFirmware, setIsUpdatingFirmware] = useState(false);
  const [firmwareProgress, setFirmwareProgress] = useState(0);
  const [firmwareStatus, setFirmwareStatus] = useState("");
  const [confirmedV3, setConfirmedV3] = useState(false);
  const supported = supportsWebSerial();

  const ownerIds = useMemo(() => new Set([user?.id, user?.identityId].filter(Boolean)), [user?.id, user?.identityId]);
  const assignedProfiles = useMemo(
    () => (profiles.data || []).filter((profile) => profile.isActive && ownerIds.has(profile.userId)),
    [ownerIds, profiles.data],
  );
  const selectedIndex = games.findIndex((game) => game.summary.gameId === selectedGameId);
  const selectedGame = selectedIndex >= 0 ? games[selectedIndex] : games[0] ?? null;
  const normalizedDeviceId = cleanDeviceId(deviceId);
  const validDeviceId = normalizedDeviceId.length === 12;
  const matchedDevice = useMemo(
    () => devicesQuery.data?.data.find((device) => cleanDeviceId(device.deviceId) === normalizedDeviceId) ?? null,
    [devicesQuery.data?.data, normalizedDeviceId],
  );
  const institutionName = matchedDevice?.educationalCenterName
    || institutionsQuery.data?.data.find((institution) => institution.id === (matchedDevice?.educationalCenterId || user?.educationalCenterId))?.name
    || (matchedDevice?.assignmentScope === "home" ? "Home" : "Sin institución registrada");
  const ownerName = matchedDevice?.ownerUserName || matchedDevice?.ownerUserEmail || "Sin owner registrado";
  const deviceDisplayName = matchedDevice?.name
    || (normalizedDeviceId ? `MagicBox ${normalizedDeviceId.slice(-6)}` : "MagicBox sin identificar");
  const uploadedGameIds = useMemo(() => new Set(uploadedGames.map((game) => game.gameId)), [uploadedGames]);
  const allGamesUploaded = games.length > 0 && games.every((game) => uploadedGameIds.has(game.summary.gameId));
  const allGamesDeleted = games.length > 0 && games.every((game) => deletedGameIds.includes(game.summary.gameId));

  function showError(cause: unknown, title = "No se pudo completar la acción") {
    setFeedback({ kind: "error", title, message: getErrorMessage(cause) });
  }

  useEffect(() => {
    return () => {
      void clientRef.current?.disconnect();
      clientRef.current = null;
    };
  }, []);

  async function connect() {
    setFeedback(null);
    setDeviceStatus("Conectando…");
    try {
      const client = new MagicBoxSerialClient();
      await client.connect();
      clientRef.current = client;
      setPhase("connected");
      try {
        const info = await client.getDeviceInfo();
        setDeviceInfo(info);
        setDeviceId(info.deviceId);
        setDeviceStatus(`${info.hardware} · ${info.firmwareVersion} · ID detectado automáticamente`);
      } catch {
        setDeviceStatus("Conectada. Este firmware no informa el ID automáticamente; ingresalo manualmente o actualizá a V2.3.22.");
      }
    } catch (cause) {
      setDeviceStatus("");
      showError(cause, "No se pudo conectar la MagicBox");
    }
  }

  async function importGames() {
    const client = clientRef.current;
    if (!client) return;
    setFeedback(null);
    setGames([]);
    setSelectedGameId(null);
    setUploadedGames([]);
    setDeletedGameIds([]);
    setPhase("reading");
    try {
      const summaries = await client.listGames();
      const sortedSummaries = [...summaries].sort((a, b) => {
        const aTime = Date.parse(a.startedAt);
        const bTime = Date.parse(b.startedAt);
        return (Number.isFinite(bTime) ? bTime : 0) - (Number.isFinite(aTime) ? aTime : 0);
      });
      if (sortedSummaries.length === 0) {
        setFeedback({ kind: "info", title: "No hay partidas para sincronizar", message: "La MagicBox está conectada correctamente, pero no tiene partidas guardadas internamente." });
        setPhase("connected");
        return;
      }
      const downloaded: ImportedGame[] = [];
      const failedGameIds: number[] = [];
      for (const summary of sortedSummaries) {
        try {
          const game = await client.downloadGame(summary.gameId);
          downloaded.push({ ...game, assignments: {} });
          setGames([...downloaded]);
          setSelectedGameId((current) => current ?? game.summary.gameId);
        } catch {
          failedGameIds.push(summary.gameId);
        }
      }
      if (failedGameIds.length > 0) {
        setFeedback({ kind: "error", title: "Lectura incompleta", message: `Se extrajeron ${downloaded.length} partidas. No se pudieron leer: ${failedGameIds.join(", ")}. Permanecen guardadas en la MagicBox.` });
      }
      setPhase(downloaded.length > 0 ? "ready" : "connected");
    } catch (cause) {
      showError(cause, "No se pudieron leer las partidas");
      setPhase("connected");
    }
  }

  async function disconnect() {
    setFeedback(null);
    try {
      await clientRef.current?.disconnect();
    } catch (cause) {
      showError(cause, "No se pudo desconectar la MagicBox");
    } finally {
      clientRef.current = null;
      setPhase("idle");
      setDeviceStatus("Desconectada");
    }
  }

  async function updateFirmware() {
    const release = cableRelease;
    if (!confirmedV3) return;
    setFeedback(null);
    setIsUpdatingFirmware(true);
    setFirmwareProgress(0);
    setFirmwareStatus("Preparando actualización…");
    try {
      await clientRef.current?.disconnect();
      clientRef.current = null;
      setPhase("idle");
      await flashMagicBoxFirmware({
        release: {
          downloadUrl: release.downloadUrl,
          sha256: release.sha256,
          sizeBytes: release.sizeBytes,
          version: release.version,
        },
        onProgress: (progress, message) => {
          setFirmwareProgress(progress);
          setFirmwareStatus(message);
        },
      });
      setFirmwareStatus(`Actualización ${release.version || "completada"}. Volvé a conectar la MagicBox para leer partidas.`);
    } catch (cause) {
      showError(cause, "No se pudo actualizar el firmware");
      setFirmwareStatus("La actualización no se completó. No desconectes la MagicBox hasta revisar el error.");
    } finally {
      setIsUpdatingFirmware(false);
    }
  }

  function updateAssignment(gameId: number, playerUid: string, target: ParticipantTarget) {
    setGames((current) => current.map((game) => game.summary.gameId === gameId
      ? { ...game, assignments: { ...game.assignments, [playerUid]: target } }
      : game));
  }

  function setManualName(gameId: number, playerUid: string, name: string) {
    updateAssignment(gameId, playerUid, { kind: "manual", id: playerUid, name });
  }

  function updateDeckName(gameId: number, deckName: string) {
    setGames((current) => current.map((game) => game.summary.gameId === gameId
      ? { ...game, summary: { ...game.summary, deckName } }
      : game));
  }

  function assign(gameId: number, playerUid: string, encoded: string) {
    const game = games.find((entry) => entry.summary.gameId === gameId);
    const player = game?.players.find((entry) => entry.uid === playerUid);
    if (!player) return;
    if (!encoded) {
      const current = game?.assignments[playerUid];
      updateAssignment(gameId, playerUid, {
        kind: "manual",
        id: playerUid,
        name: current?.kind === "manual" ? current.name : player.name || `Jugador ${player.position}`,
      });
      return;
    }
    const separator = encoded.indexOf(":");
    const kind = encoded.slice(0, separator) as ParticipantTarget["kind"];
    const id = encoded.slice(separator + 1);
    if (kind === "student") {
      const student = students.data?.data.find((entry) => entry.id === id);
      if (student) updateAssignment(gameId, playerUid, { kind, id, name: student.fullName });
    } else if (kind === "profile") {
      const profile = assignedProfiles.find((entry) => entry.id === id);
      if (profile) updateAssignment(gameId, playerUid, { kind, id, name: profile.displayName });
    }
  }

  async function createProfile() {
    if (!tokens?.accessToken || !newProfileName.trim()) return;
    setFeedback(null);
    setIsCreatingProfile(true);
    try {
      await createHomeProfile(tokens.accessToken, { displayName: newProfileName.trim() });
      setNewProfileName("");
      await profiles.refetch();
    } catch (cause) {
      showError(cause, "No se pudo crear el perfil");
    } finally {
      setIsCreatingProfile(false);
    }
  }

  async function uploadGames() {
    if (!tokens?.accessToken || !clientRef.current || games.length === 0) return;
    setFeedback(null);
    setPhase("uploading");
    try {
      const rawEnvelopes = buildRawSyncEnvelopes(deviceId, games, user?.educationalCenterId);
      const payload = buildGamesBatchPayload(deviceId, games, user?.educationalCenterId);
      for (const envelope of rawEnvelopes) await uploadRawGameSync(tokens.accessToken, envelope);
      const uploaded = await uploadGamesBatch(tokens.accessToken, payload);
      const uploadedByGameId = new Map(uploaded.map((game) => [game.gameId, game]));
      const missing = games.map((game) => game.summary.gameId).filter((gameId) => !uploadedByGameId.has(gameId));
      if (missing.length > 0) {
        throw new Error(`El servidor no confirmó las partidas ${missing.join(", ")}. Las partidas permanecen guardadas en la MagicBox.`);
      }
      setUploadedGames(games.map((game) => uploadedByGameId.get(game.summary.gameId) as GameRecord));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["games"] }),
        queryClient.invalidateQueries({ queryKey: ["devices"] }),
        queryClient.invalidateQueries({ queryKey: ["syncs"] }),
      ]);
      setPhase("ready");
      setFeedback({ kind: "success", title: "Subida completada", message: `Las ${games.length} partidas quedaron cargadas en la cuenta. Los originales siguen guardados en la MagicBox hasta que elijas borrarlos.`, showGameLinks: true });
    } catch (cause) {
      showError(cause, "No se pudieron subir las partidas");
      setPhase("ready");
    }
  }

  async function deleteUploadedGames() {
    if (!clientRef.current || !allGamesUploaded || games.length === 0) return;
    setConfirmDeleteOpen(false);
    setFeedback(null);
    setIsDeleting(true);
    try {
      const gameIds = games.map((game) => game.summary.gameId);
      await clientRef.current.deleteGames(gameIds);
      setDeletedGameIds(gameIds);
      setFeedback({ kind: "success", title: "Borrado completado", message: `Se confirmó el borrado de ${gameIds.length} partidas originales en la MagicBox. Las copias cargadas en la cuenta permanecen disponibles.` });
    } catch (cause) {
      showError(cause, "No se pudieron borrar las partidas");
    } finally {
      setIsDeleting(false);
    }
  }

  function selectRelativeGame(offset: number) {
    if (games.length === 0) return;
    const currentIndex = selectedIndex >= 0 ? selectedIndex : 0;
    const nextIndex = Math.min(games.length - 1, Math.max(0, currentIndex + offset));
    setSelectedGameId(games[nextIndex].summary.gameId);
  }

  return (
    <div className="space-y-6">
      <Modal open={Boolean(feedback)} onClose={() => setFeedback(null)} title={feedback?.title || "Resultado"} className="max-w-xl">
        <div className="space-y-5">
          <div className={`flex items-start gap-3 rounded-2xl border p-4 ${feedback?.kind === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-900" : feedback?.kind === "info" ? "border-sky-300 bg-sky-50 text-sky-900" : "border-destructive/40 bg-destructive/5 text-destructive"}`}>
            {feedback?.kind === "success" ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" /> : feedback?.kind === "info" ? <List className="mt-0.5 size-5 shrink-0" /> : <AlertTriangle className="mt-0.5 size-5 shrink-0" />}
            <p className="text-sm leading-6">{feedback?.message}</p>
          </div>
          {feedback?.showGameLinks ? <div className="flex flex-wrap gap-2">{uploadedGames[0] ? <Link className={buttonVariants()} href={buildGameDetailHref({ gameRecordId: uploadedGames[0].id, deviceId: normalizedDeviceId })}>Ver primera partida cargada</Link> : null}<Link className={buttonVariants({ variant: "outline" })} href={buildGamesOverviewHref({ deviceId: normalizedDeviceId })}>Ver todas las partidas</Link></div> : null}
          <div className="flex justify-end"><Button onClick={() => setFeedback(null)}>Cerrar</Button></div>
        </div>
      </Modal>
      <Modal open={confirmDeleteOpen} onClose={() => setConfirmDeleteOpen(false)} title="Confirmar borrado" description="Esta acción elimina los originales del almacenamiento de la MagicBox." className="max-w-xl">
        <div className="space-y-5">
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-900">Las {games.length} partidas ya fueron confirmadas por el servidor. ¿Querés borrar ahora sus originales de {deviceDisplayName}?</div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>Cancelar</Button><Button variant="destructive" onClick={deleteUploadedGames}><Trash2 className="size-4" />Borrar originales</Button></div>
        </div>
      </Modal>
      <SectionHeader eyebrow="Sync por cable" title="Sincronizar partidas de una MagicBox" description="Conectá la MagicBox por USB, revisá quién usó cada color y recién después subí las partidas. El dispositivo se borra únicamente cuando el servidor confirma cada carga." />
      <SyncNavigation />
      <nav aria-label="Pasos de la sincronización por cable" className="flex gap-2 overflow-x-auto rounded-2xl border bg-muted/30 p-2 text-sm">
        <a className="shrink-0 rounded-full px-4 py-2 font-medium hover:bg-background" href="#cable-connect">1. Conectar</a>
        <a className="shrink-0 rounded-full px-4 py-2 font-medium hover:bg-background" href="#cable-games">2. Revisar partidas</a>
        <a className="shrink-0 rounded-full px-4 py-2 font-medium hover:bg-background" href="#cable-players">3. Asociar jugadores</a>
        <a className="shrink-0 rounded-full px-4 py-2 font-medium hover:bg-background" href="#cable-upload">4. Subir</a>
      </nav>
      {!supported ? <Card className="border-amber-300 bg-amber-50"><CardHeader><CardTitle>Navegador no compatible</CardTitle><CardDescription>Usá Chrome o Edge de escritorio y abrí el dashboard por HTTPS.</CardDescription></CardHeader></Card> : null}
      <Card id="cable-connect" className="scroll-mt-28">
        <CardHeader><CardTitle className="flex items-center gap-2"><Cable className="size-5" />1. Conectar y leer</CardTitle><CardDescription>El ID se detecta automáticamente desde firmware V2.3.22. Las versiones anteriores conservan el ingreso manual.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1"><label className="text-sm font-medium" htmlFor="magicbox-device-id">ID de la MagicBox</label><Input id="magicbox-device-id" className="mt-2 font-mono" value={deviceId} onChange={(event) => setDeviceId(cleanDeviceId(event.target.value))} placeholder="AABBCCDDEEFF" maxLength={12} /></div>
            <Button onClick={connect} disabled={!supported || phase !== "idle"}><Cable className="size-4" />Conectar</Button>
            <Button onClick={importGames} disabled={phase !== "connected"}><Download className="size-4" />Leer partidas</Button>
            <Button variant="outline" onClick={disconnect} disabled={phase === "idle" || phase === "reading" || phase === "uploading"}><Power className="size-4" />Desconectar</Button>
            {phase === "reading" ? <Badge><LoaderCircle className="mr-1 size-3 animate-spin" />Leyendo</Badge> : null}
          </div>
          {deviceStatus ? <p className="text-sm text-muted-foreground">{deviceStatus}</p> : null}
          {normalizedDeviceId ? <div className="rounded-2xl border bg-muted/20 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dispositivo conectado</p><p className="mt-1 text-xl font-semibold">{deviceDisplayName}</p></div>{matchedDevice?.status ? <Badge>{matchedDevice.status}</Badge> : null}</div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs text-muted-foreground">ID</p><p className="font-mono font-medium">{normalizedDeviceId}</p></div><div><p className="text-xs text-muted-foreground">Institución</p><p className="font-medium">{institutionName}</p></div><div><p className="text-xs text-muted-foreground">Owner</p><p className="font-medium">{ownerName}</p></div><div><p className="text-xs text-muted-foreground">Hardware / firmware</p><p className="font-medium">{deviceInfo?.hardware || "MagicBox"} · {deviceInfo?.firmwareVersion || matchedDevice?.firmwareVersion || "Sin versión"}</p></div></div></div> : null}
        </CardContent>
      </Card>

      <Card id="cable-firmware" className="scroll-mt-28">
        <CardHeader><CardTitle className="flex items-center gap-2"><Cpu className="size-5" />Actualizar firmware por cable</CardTitle><CardDescription>Valida tamaño y SHA-256 y actualiza únicamente la aplicación y el selector OTA. No borra NVS ni LittleFS.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-3">
            <div><p className="text-xs text-muted-foreground">Hardware habilitado</p><p className="font-medium">MagicBox V3</p></div>
            <div><p className="text-xs text-muted-foreground">Firmware seleccionado</p><p className="font-medium">{cableRelease.version} · {cableRelease.source === "published" ? "release activa" : "release segura integrada"}</p></div>
            <div><p className="text-xs text-muted-foreground">Integridad</p><p className="font-medium">SHA-256 verificado</p></div>
          </div>
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={confirmedV3} onChange={(event) => setConfirmedV3(event.target.checked)} disabled={isUpdatingFirmware} /><span>Confirmo que es una MagicBox V3 y mantendré el cable conectado durante toda la actualización.</span></label>
          {(isUpdatingFirmware || firmwareStatus) ? <div className="space-y-2"><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${firmwareProgress}%` }} /></div><p className="text-sm text-muted-foreground">{firmwareStatus}</p></div> : null}
          <Button onClick={updateFirmware} disabled={!supported || !confirmedV3 || isUpdatingFirmware}>{isUpdatingFirmware ? <LoaderCircle className="size-4 animate-spin" /> : <Cpu className="size-4" />}{isUpdatingFirmware ? "Actualizando…" : `Actualizar a ${cableRelease.version}`}</Button>
        </CardContent>
      </Card>

      {games.length > 0 ? <Card id="cable-upload" className="scroll-mt-28 border-primary/30 bg-primary/5"><CardHeader><CardTitle className="flex items-center gap-2"><UploadCloud className="size-5" />Subir y administrar originales</CardTitle><CardDescription>La subida y el borrado son acciones separadas. Primero se confirma la copia en el servidor; después podés decidir cuándo borrar los originales de la MagicBox.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="flex flex-wrap items-center gap-3"><Button onClick={uploadGames} disabled={phase !== "ready" || !validDeviceId || isDeleting}><UploadCloud className="size-4" />Subir {games.length} partidas</Button><Button variant="destructive" onClick={() => setConfirmDeleteOpen(true)} disabled={!allGamesUploaded || allGamesDeleted || phase === "uploading" || isDeleting}><Trash2 className="size-4" />{isDeleting ? "Borrando…" : allGamesDeleted ? "Originales borrados" : `Borrar ${games.length} originales`}</Button>{phase === "uploading" ? <span className="text-sm text-muted-foreground"><LoaderCircle className="mr-1 inline size-4 animate-spin" />Subiendo…</span> : null}</div>{!validDeviceId ? <p className="text-sm text-amber-700">Falta un ID válido de 12 caracteres para vincular las partidas.</p> : null}{!allGamesUploaded ? <p className="text-sm text-muted-foreground">El borrado se habilita cuando el servidor confirma todas las partidas.</p> : <p className="text-sm text-emerald-700">Carga confirmada. Los originales siguen en la MagicBox hasta que pulses borrar.</p>}</CardContent></Card> : null}

      {selectedGame ? (
        <>
        <div id="cable-games" className="grid scroll-mt-28 gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start">
          <Card className="h-fit lg:sticky lg:top-24">
            <CardHeader><CardTitle className="flex items-center gap-2"><List className="size-5" />Partidas extraídas</CardTitle><CardDescription>{games.length} disponibles para revisar</CardDescription></CardHeader>
            <CardContent className="max-h-[calc(100vh-14rem)] space-y-2 overflow-y-auto pr-3">
              {games.map((game, index) => <button key={game.summary.gameId} type="button" onClick={() => setSelectedGameId(game.summary.gameId)} className={`w-full rounded-xl border p-3 text-left transition ${game.summary.gameId === selectedGame.summary.gameId ? "border-primary bg-primary/5" : "hover:bg-muted/60"}`}><div className="flex items-center justify-between gap-2"><span className="font-medium">Partida #{game.summary.gameId}</span><Badge variant="outline">{index + 1}</Badge></div><p className="mt-1 text-xs font-medium">{formatGameDate(game.summary.startedAt)}</p><p className="mt-1 text-xs text-muted-foreground">{game.summary.deckName} · {game.players.length} jugadores · {game.turns.length} turnos</p><p className="mt-2 text-xs text-muted-foreground">{deviceDisplayName} · {institutionName} · {ownerName}</p></button>)}
            </CardContent>
          </Card>

          <Card id="cable-players" className="scroll-mt-28">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Partida #{selectedGame.summary.gameId}</CardTitle><CardDescription>{selectedGame.summary.deckName} · {selectedGame.players.length} jugadores · {selectedGame.turns.length} turnos{selectedGame.turns.length === 0 ? " · finalizada sin jugadas" : ""}</CardDescription></div><div className="flex items-center gap-2"><Button size="sm" className="size-9 p-0" variant="outline" aria-label="Partida anterior" onClick={() => selectRelativeGame(-1)} disabled={selectedIndex <= 0}><ChevronLeft className="size-4" /></Button><span className="text-sm text-muted-foreground">{selectedIndex + 1} de {games.length}</span><Button size="sm" className="size-9 p-0" variant="outline" aria-label="Partida siguiente" onClick={() => selectRelativeGame(1)} disabled={selectedIndex >= games.length - 1}><ChevronRight className="size-4" /></Button></div></div>
              <div className="mt-4 grid gap-3 rounded-xl border bg-muted/20 p-3 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><p className="text-xs text-muted-foreground">Fecha</p><p className="font-medium">{formatGameDate(selectedGame.summary.startedAt)}</p></div><div><p className="text-xs text-muted-foreground">Dispositivo</p><p className="font-medium">{deviceDisplayName}</p><p className="font-mono text-xs text-muted-foreground">{normalizedDeviceId}</p></div><div><p className="text-xs text-muted-foreground">Institución</p><p className="font-medium">{institutionName}</p></div><div><p className="text-xs text-muted-foreground">Owner</p><p className="font-medium">{ownerName}</p></div></div>
              <div className="mt-4"><label className="text-sm font-medium" htmlFor={`deck-name-${selectedGame.summary.gameId}`}>Nombre del mazo utilizado</label><Input id={`deck-name-${selectedGame.summary.gameId}`} className="mt-2" value={selectedGame.summary.deckName} onChange={(event) => updateDeckName(selectedGame.summary.gameId, event.target.value)} placeholder="Nombre del mazo" maxLength={100} disabled={phase === "uploading" || allGamesUploaded} /><p className="mt-1 text-xs text-muted-foreground">Este nombre se guardará con la partida al subirla.</p></div>
              <div className="mt-4 flex gap-2 overflow-x-auto rounded-xl bg-muted/50 p-1">
                <Button type="button" size="sm" variant={gameView === "players" ? "default" : "ghost"} onClick={() => setGameView("players")}><Users className="size-4" />Jugadores</Button>
                <Button type="button" size="sm" variant={gameView === "analytics" ? "default" : "ghost"} onClick={() => setGameView("analytics")}><BarChart3 className="size-4" />Rondas y aciertos</Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {gameView === "players" ? <>
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="font-medium">Crear una persona para asignar</p>
                <p className="mt-1 text-sm text-muted-foreground">Si todavía no existe, creá un perfil rápido y aparecerá en la lista.</p>
                <div className="mt-3 flex flex-wrap gap-3"><Input className="min-w-64 flex-1" value={newProfileName} onChange={(event) => setNewProfileName(event.target.value)} placeholder="Nombre de la persona" /><Button variant="outline" onClick={createProfile} disabled={!newProfileName.trim() || isCreatingProfile}>{isCreatingProfile ? <LoaderCircle className="size-4 animate-spin" /> : null}Crear perfil</Button></div>
              </div>
              {selectedGame.players.map((player) => {
                const assignment = selectedGame.assignments[player.uid];
                const manualName = assignment?.kind === "manual" ? assignment.name : player.name || `Jugador ${player.position}`;
                return <div key={player.uid} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[180px_1fr] md:items-start"><div><Badge variant="outline">{COLOR_LABELS[player.colorCode] || player.colorCode}</Badge><p className="mt-2 text-sm text-muted-foreground">Jugador {player.position}</p></div><div className="space-y-2"><Input aria-label={`Nombre manual ${player.colorCode}`} value={manualName} onChange={(event) => setManualName(selectedGame.summary.gameId, player.uid, event.target.value)} placeholder="Nombre del jugador asignado en el momento" /><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" aria-label={`Asignar ${player.colorCode}`} value={assignment && assignment.kind !== "manual" ? `${assignment.kind}:${assignment.id}` : ""} onChange={(event) => assign(selectedGame.summary.gameId, player.uid, event.target.value)}><option value="">Usar el nombre manual escrito arriba</option>{(students.data?.data || []).map((student) => <option key={`student:${student.id}`} value={`student:${student.id}`}>Alumno · {student.fullName}</option>)}{assignedProfiles.map((profile) => <option key={`profile:${profile.id}`} value={`profile:${profile.id}`}>Mi perfil · {profile.displayName}</option>)}</select></div></div>;
              })}</> : <ImportedGameCharts game={selectedGame} embedded />}
            </CardContent>
          </Card>
        </div>
        </>
      ) : null}


    </div>
  );
}
