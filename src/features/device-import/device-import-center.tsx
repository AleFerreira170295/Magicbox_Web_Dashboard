"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Cable, CheckCircle2, ChevronLeft, ChevronRight, Cpu, Download, List, LoaderCircle, Power, UploadCloud } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-context";
import { buildGamesBatchPayload, buildRawSyncEnvelopes } from "@/features/device-import/payload";
import { flashMagicBoxFirmware, resolveCableFirmwareRelease } from "@/features/device-import/firmware-updater";
import { ImportedGameCharts } from "@/features/device-import/imported-game-charts";
import type { ImportedGame, ParticipantTarget } from "@/features/device-import/types";
import { MagicBoxSerialClient, supportsWebSerial } from "@/features/device-import/web-serial";
import { uploadGamesBatch, uploadRawGameSync } from "@/features/games/api";
import { buildGameDetailHref, buildGamesOverviewHref } from "@/features/games/game-route";
import type { GameRecord } from "@/features/games/types";
import { createHomeProfile, useProfilesOverview } from "@/features/profiles/api";
import { useOtaRelease } from "@/features/settings/api";
import { useAllStudents } from "@/features/students/api";
import { getErrorMessage } from "@/lib/utils";

type Phase = "idle" | "connected" | "reading" | "ready" | "uploading" | "done";
const COLOR_LABELS: Record<string, string> = { AM: "Amarillo", NA: "Naranja", VE: "Verde", VI: "Violeta", CI: "Celeste", MA: "Rojo" };

function cleanDeviceId(value: string) {
  return value.replace(/[^a-fA-F0-9]/g, "").toUpperCase();
}

export function DeviceImportCenter() {
  const { tokens, user } = useAuth();
  const queryClient = useQueryClient();
  const students = useAllStudents(tokens?.accessToken, { institutionId: user?.educationalCenterId || undefined });
  const profiles = useProfilesOverview(tokens?.accessToken);
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
  const [deviceStatus, setDeviceStatus] = useState("");
  const [games, setGames] = useState<ImportedGame[]>([]);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [uploadedGames, setUploadedGames] = useState<GameRecord[]>([]);
  const [newProfileName, setNewProfileName] = useState("");
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [isUpdatingFirmware, setIsUpdatingFirmware] = useState(false);
  const [firmwareProgress, setFirmwareProgress] = useState(0);
  const [firmwareStatus, setFirmwareStatus] = useState("");
  const [confirmedV3, setConfirmedV3] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = supportsWebSerial();

  const ownerIds = useMemo(() => new Set([user?.id, user?.identityId].filter(Boolean)), [user?.id, user?.identityId]);
  const assignedProfiles = useMemo(
    () => (profiles.data || []).filter((profile) => profile.isActive && ownerIds.has(profile.userId)),
    [ownerIds, profiles.data],
  );
  const selectedIndex = games.findIndex((game) => game.summary.gameId === selectedGameId);
  const selectedGame = selectedIndex >= 0 ? games[selectedIndex] : games[0] ?? null;
  const validDeviceId = cleanDeviceId(deviceId).length === 12;

  useEffect(() => {
    return () => {
      void clientRef.current?.disconnect();
      clientRef.current = null;
    };
  }, []);

  async function connect() {
    setError(null);
    setDeviceStatus("Conectando…");
    try {
      const client = new MagicBoxSerialClient();
      await client.connect();
      clientRef.current = client;
      setPhase("connected");
      try {
        const info = await client.getDeviceInfo();
        setDeviceId(info.deviceId);
        setDeviceStatus(`${info.hardware} · ${info.firmwareVersion} · ID detectado automáticamente`);
      } catch {
        setDeviceStatus("Conectada. Este firmware no informa el ID automáticamente; ingresalo manualmente o actualizá a V2.3.22.");
      }
    } catch (cause) {
      setDeviceStatus("");
      setError(getErrorMessage(cause));
    }
  }

  async function importGames() {
    const client = clientRef.current;
    if (!client) return;
    setError(null);
    setGames([]);
    setSelectedGameId(null);
    setUploadedGames([]);
    setPhase("reading");
    try {
      const summaries = await client.listGames();
      const downloaded: ImportedGame[] = [];
      const failedGameIds: number[] = [];
      for (const summary of summaries) {
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
        setError(`Se extrajeron ${downloaded.length} partidas. No se pudieron leer: ${failedGameIds.join(", ")}. Permanecen guardadas en la MagicBox.`);
      }
      setPhase(downloaded.length > 0 ? "ready" : "connected");
    } catch (cause) {
      setError(getErrorMessage(cause));
      setPhase("connected");
    }
  }

  async function disconnect() {
    setError(null);
    try {
      await clientRef.current?.disconnect();
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      clientRef.current = null;
      setPhase("idle");
      setDeviceStatus("Desconectada");
    }
  }

  async function updateFirmware() {
    const release = cableRelease;
    if (!confirmedV3) return;
    setError(null);
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
      setError(getErrorMessage(cause));
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
    setError(null);
    setIsCreatingProfile(true);
    try {
      await createHomeProfile(tokens.accessToken, { displayName: newProfileName.trim() });
      setNewProfileName("");
      await profiles.refetch();
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setIsCreatingProfile(false);
    }
  }

  async function uploadAndDelete() {
    if (!tokens?.accessToken || !clientRef.current || games.length === 0) return;
    setError(null);
    setPhase("uploading");
    try {
      const rawEnvelopes = buildRawSyncEnvelopes(deviceId, games, user?.educationalCenterId);
      const payload = buildGamesBatchPayload(deviceId, games, user?.educationalCenterId);
      for (const envelope of rawEnvelopes) await uploadRawGameSync(tokens.accessToken, envelope);
      const uploaded = await uploadGamesBatch(tokens.accessToken, payload);
      const uploadedByGameId = new Map(uploaded.map((game) => [game.gameId, game]));
      const missing = games.map((game) => game.summary.gameId).filter((gameId) => !uploadedByGameId.has(gameId));
      if (missing.length > 0) {
        throw new Error(`El servidor no confirmó las partidas ${missing.join(", ")}. No se borró ninguna partida de la MagicBox.`);
      }
      await clientRef.current.deleteGames(games.map((game) => game.summary.gameId));
      setUploadedGames(games.map((game) => uploadedByGameId.get(game.summary.gameId) as GameRecord));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["games"] }),
        queryClient.invalidateQueries({ queryKey: ["devices"] }),
        queryClient.invalidateQueries({ queryKey: ["syncs"] }),
      ]);
      setPhase("done");
    } catch (cause) {
      setError(getErrorMessage(cause));
      setPhase("ready");
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
      <SectionHeader eyebrow="Importación por cable" title="Extraer partidas de una MagicBox" description="Conectá la MagicBox por USB, revisá quién usó cada color y recién después subí las partidas. El dispositivo se borra únicamente cuando el servidor confirma cada carga." />
      {!supported ? <Card className="border-amber-300 bg-amber-50"><CardHeader><CardTitle>Navegador no compatible</CardTitle><CardDescription>Usá Chrome o Edge de escritorio y abrí el dashboard por HTTPS.</CardDescription></CardHeader></Card> : null}
      {error ? <Card className="border-destructive/40"><CardContent className="pt-6 text-sm text-destructive">{error}</CardContent></Card> : null}

      <Card>
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
        </CardContent>
      </Card>

      <Card>
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

      {games.length > 0 ? <Card><CardHeader><CardTitle>Crear una persona para asignar</CardTitle><CardDescription>Si todavía no existe, creá un perfil rápido y aparecerá entre las personas de tu cuenta.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-3"><Input className="min-w-64 flex-1" value={newProfileName} onChange={(event) => setNewProfileName(event.target.value)} placeholder="Nombre de la persona" /><Button variant="outline" onClick={createProfile} disabled={!newProfileName.trim() || isCreatingProfile}>{isCreatingProfile ? <LoaderCircle className="size-4 animate-spin" /> : null}Crear perfil</Button></CardContent></Card> : null}

      {games.length > 0 ? <Card className="border-primary/30 bg-primary/5"><CardHeader><CardTitle className="flex items-center gap-2"><UploadCloud className="size-5" />2. Subir partidas a la cuenta</CardTitle><CardDescription>Esta acción queda antes del listado para que siempre sea visible. Se sube la copia cruda y la partida normalizada; la MagicBox se borra sólo si el servidor confirma todas las partidas.</CardDescription></CardHeader><CardContent><Button onClick={uploadAndDelete} disabled={phase !== "ready" || !validDeviceId}><UploadCloud className="size-4" />Subir {games.length} partidas y borrar originales</Button>{!validDeviceId ? <p className="mt-2 text-sm text-amber-700">Falta un ID válido de 12 caracteres para vincular las partidas.</p> : null}{phase === "uploading" ? <span className="ml-3 text-sm text-muted-foreground"><LoaderCircle className="mr-1 inline size-4 animate-spin" />Procesando…</span> : null}</CardContent></Card> : null}

      {selectedGame ? (
        <>
        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="h-fit">
            <CardHeader><CardTitle className="flex items-center gap-2"><List className="size-5" />Partidas extraídas</CardTitle><CardDescription>{games.length} disponibles para revisar</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {games.map((game, index) => <button key={game.summary.gameId} type="button" onClick={() => setSelectedGameId(game.summary.gameId)} className={`w-full rounded-xl border p-3 text-left transition ${game.summary.gameId === selectedGame.summary.gameId ? "border-primary bg-primary/5" : "hover:bg-muted/60"}`}><div className="flex items-center justify-between gap-2"><span className="font-medium">Partida #{game.summary.gameId}</span><Badge variant="outline">{index + 1}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{game.summary.deckName} · {game.players.length} jugadores · {game.turns.length} turnos</p></button>)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Partida #{selectedGame.summary.gameId}</CardTitle><CardDescription>{selectedGame.summary.deckName} · {selectedGame.players.length} jugadores · {selectedGame.turns.length} turnos{selectedGame.turns.length === 0 ? " · finalizada sin jugadas" : ""}</CardDescription></div><div className="flex items-center gap-2"><Button size="sm" className="size-9 p-0" variant="outline" aria-label="Partida anterior" onClick={() => selectRelativeGame(-1)} disabled={selectedIndex <= 0}><ChevronLeft className="size-4" /></Button><span className="text-sm text-muted-foreground">{selectedIndex + 1} de {games.length}</span><Button size="sm" className="size-9 p-0" variant="outline" aria-label="Partida siguiente" onClick={() => selectRelativeGame(1)} disabled={selectedIndex >= games.length - 1}><ChevronRight className="size-4" /></Button></div></div>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedGame.players.map((player) => {
                const assignment = selectedGame.assignments[player.uid];
                const manualName = assignment?.kind === "manual" ? assignment.name : player.name || `Jugador ${player.position}`;
                return <div key={player.uid} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[180px_1fr] md:items-start"><div><Badge variant="outline">{COLOR_LABELS[player.colorCode] || player.colorCode}</Badge><p className="mt-2 text-sm text-muted-foreground">Jugador {player.position}</p></div><div className="space-y-2"><Input aria-label={`Nombre manual ${player.colorCode}`} value={manualName} onChange={(event) => setManualName(selectedGame.summary.gameId, player.uid, event.target.value)} placeholder="Nombre del jugador asignado en el momento" /><select className="h-10 w-full rounded-md border bg-background px-3 text-sm" aria-label={`Asignar ${player.colorCode}`} value={assignment && assignment.kind !== "manual" ? `${assignment.kind}:${assignment.id}` : ""} onChange={(event) => assign(selectedGame.summary.gameId, player.uid, event.target.value)}><option value="">Usar el nombre manual escrito arriba</option>{(students.data?.data || []).map((student) => <option key={`student:${student.id}`} value={`student:${student.id}`}>Alumno · {student.fullName}</option>)}{assignedProfiles.map((profile) => <option key={`profile:${profile.id}`} value={`profile:${profile.id}`}>Mi perfil · {profile.displayName}</option>)}</select></div></div>;
              })}
            </CardContent>
          </Card>
        </div>
        <ImportedGameCharts game={selectedGame} />
        </>
      ) : null}

      {phase === "done" ? <Card className="border-emerald-300 bg-emerald-50"><CardContent className="space-y-4 pt-6 text-emerald-800"><div className="flex items-center gap-3"><CheckCircle2 className="size-5" />Las {uploadedGames.length} partidas quedaron cargadas y se confirmó el borrado en la MagicBox.</div><div className="flex flex-wrap gap-2">{uploadedGames[0] ? <Link className={buttonVariants()} href={buildGameDetailHref({ gameRecordId: uploadedGames[0].id, deviceId: cleanDeviceId(deviceId) })}>Ver primera partida cargada</Link> : null}<Link className={buttonVariants({ variant: "outline" })} href={buildGamesOverviewHref({ deviceId: cleanDeviceId(deviceId) })}>Ver todas las partidas</Link></div></CardContent></Card> : null}
    </div>
  );
}
