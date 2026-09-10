"use client";

import { useEffect, useRef, useState } from "react";
import { Cable, CheckCircle2, Cpu, Download, LoaderCircle, Power, UploadCloud } from "lucide-react";
import { SectionHeader } from "@/components/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/auth-context";
import { buildGamesBatchPayload, buildRawSyncEnvelopes } from "@/features/device-import/payload";
import { flashMagicBoxFirmware } from "@/features/device-import/firmware-updater";
import type { ImportedGame, ParticipantTarget } from "@/features/device-import/types";
import { MagicBoxSerialClient, supportsWebSerial } from "@/features/device-import/web-serial";
import { uploadGamesBatch, uploadRawGameSync } from "@/features/games/api";
import { createHomeProfile, useProfilesOverview } from "@/features/profiles/api";
import { useOtaRelease } from "@/features/settings/api";
import { useAllStudents } from "@/features/students/api";
import { getErrorMessage } from "@/lib/utils";

type Phase = "idle" | "connected" | "reading" | "ready" | "uploading" | "done";
const COLOR_LABELS: Record<string, string> = { AM: "Amarillo", NA: "Naranja", VE: "Verde", VI: "Violeta", CI: "Celeste", MA: "Rojo" };

export function DeviceImportCenter() {
  const { tokens, user } = useAuth();
  const students = useAllStudents(tokens?.accessToken, { institutionId: user?.educationalCenterId || undefined });
  const profiles = useProfilesOverview(tokens?.accessToken);
  const otaRelease = useOtaRelease(tokens?.accessToken);
  const clientRef = useRef<MagicBoxSerialClient | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [deviceId, setDeviceId] = useState("");
  const [games, setGames] = useState<ImportedGame[]>([]);
  const [newProfileName, setNewProfileName] = useState("");
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [isUpdatingFirmware, setIsUpdatingFirmware] = useState(false);
  const [firmwareProgress, setFirmwareProgress] = useState(0);
  const [firmwareStatus, setFirmwareStatus] = useState("");
  const [confirmedV3, setConfirmedV3] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = supportsWebSerial();

  useEffect(() => {
    return () => {
      void clientRef.current?.disconnect();
      clientRef.current = null;
    };
  }, []);

  async function connect() {
    setError(null);
    try {
      const client = new MagicBoxSerialClient();
      await client.connect();
      clientRef.current = client;
      setPhase("connected");
    } catch (cause) {
      setError(getErrorMessage(cause));
    }
  }

  async function importGames() {
    const client = clientRef.current;
    if (!client) return;
    setError(null);
    setPhase("reading");
    try {
      const summaries = await client.listGames();
      const downloaded: ImportedGame[] = [];
      for (const summary of summaries) {
        const game = await client.downloadGame(summary.gameId);
        downloaded.push({ ...game, assignments: {} });
      }
      setGames(downloaded);
      setPhase("ready");
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
    }
  }

  async function updateFirmware() {
    const release = otaRelease.data;
    if (!release?.downloadUrl || !confirmedV3) return;
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
          version: release.latestVersion,
        },
        onProgress: (progress, message) => {
          setFirmwareProgress(progress);
          setFirmwareStatus(message);
        },
      });
      setFirmwareStatus(`Actualización ${release.latestVersion || "completada"}. Volvé a conectar la MagicBox para leer partidas.`);
    } catch (cause) {
      setError(getErrorMessage(cause));
      setFirmwareStatus("La actualización no se completó. No desconectes la MagicBox hasta revisar el error.");
    } finally {
      setIsUpdatingFirmware(false);
    }
  }

  function assign(gameId: number, playerUid: string, encoded: string) {
    const separator = encoded.indexOf(":");
    const kind = encoded.slice(0, separator) as ParticipantTarget["kind"];
    const id = encoded.slice(separator + 1);
    let target: ParticipantTarget | null = null;
    if (kind === "student") {
      const student = students.data?.data.find((entry) => entry.id === id);
      if (student) target = { kind, id, name: student.fullName };
    } else if (kind === "profile") {
      const profile = profiles.data?.find((entry) => entry.id === id);
      if (profile) target = { kind, id, name: profile.displayName };
    }
    setGames((current) => current.map((game) => {
      if (game.summary.gameId !== gameId) return game;
      const assignments = { ...game.assignments };
      if (target) assignments[playerUid] = target;
      else delete assignments[playerUid];
      return { ...game, assignments };
    }));
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
      for (const envelope of rawEnvelopes) {
        await uploadRawGameSync(tokens.accessToken, envelope);
      }
      await uploadGamesBatch(tokens.accessToken, payload);
      await clientRef.current.deleteGames(games.map((game) => game.summary.gameId));
      setPhase("done");
    } catch (cause) {
      setError(getErrorMessage(cause));
      setPhase("ready");
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Importación por cable" title="Extraer partidas de una MagicBox" description="Conectá la MagicBox por USB, revisá quién usó cada color y recién después subí las partidas. El dispositivo se borra únicamente cuando el servidor confirma la carga." />
      {!supported ? <Card className="border-amber-300 bg-amber-50"><CardHeader><CardTitle>Navegador no compatible</CardTitle><CardDescription>Usá Chrome o Edge de escritorio y abrí el dashboard por HTTPS.</CardDescription></CardHeader></Card> : null}
      {error ? <Card className="border-destructive/40"><CardContent className="pt-6 text-sm text-destructive">{error}</CardContent></Card> : null}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Cable className="size-5" />1. Conectar y leer</CardTitle><CardDescription>El navegador pedirá permiso para el puerto serie. No se instala ningún programa adicional.</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1"><label className="text-sm font-medium" htmlFor="magicbox-device-id">ID de la MagicBox</label><Input id="magicbox-device-id" className="mt-2" value={deviceId} onChange={(event) => setDeviceId(event.target.value)} placeholder="AABBCCDDEEFF" /></div>
          <Button onClick={connect} disabled={!supported || phase !== "idle"}><Cable className="size-4" />Conectar</Button>
          <Button onClick={importGames} disabled={phase !== "connected"}><Download className="size-4" />Leer partidas</Button>
          <Button variant="outline" onClick={disconnect} disabled={phase === "idle" || phase === "reading" || phase === "uploading"}><Power className="size-4" />Desconectar</Button>
          {phase === "reading" ? <Badge><LoaderCircle className="mr-1 size-3 animate-spin" />Leyendo</Badge> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Cpu className="size-5" />Actualizar firmware por cable</CardTitle>
          <CardDescription>Descarga la release OTA activa, valida tamaño y SHA-256 y actualiza únicamente la aplicación y el selector OTA. No borra NVS ni LittleFS, donde permanecen configuración y partidas.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 rounded-xl border p-4 md:grid-cols-3">
            <div><p className="text-xs text-muted-foreground">Hardware habilitado</p><p className="font-medium">MagicBox V3</p></div>
            <div><p className="text-xs text-muted-foreground">Release activa</p><p className="font-medium">{otaRelease.data?.latestVersion || "Sin release publicada"}</p></div>
            <div><p className="text-xs text-muted-foreground">Integridad</p><p className="font-medium">{otaRelease.data?.sha256 ? "SHA-256 publicado" : "Falta SHA-256"}</p></div>
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-1" checked={confirmedV3} onChange={(event) => setConfirmedV3(event.target.checked)} disabled={isUpdatingFirmware} />
            <span>Confirmo que es una MagicBox V3 y mantendré el cable conectado durante toda la actualización. El hardware anterior requerirá una release específica.</span>
          </label>
          {(isUpdatingFirmware || firmwareStatus) ? (
            <div className="space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${firmwareProgress}%` }} /></div>
              <p className="text-sm text-muted-foreground">{firmwareStatus}</p>
            </div>
          ) : null}
          <Button onClick={updateFirmware} disabled={!supported || !confirmedV3 || isUpdatingFirmware || !otaRelease.data?.downloadUrl || !otaRelease.data?.sha256}>
            {isUpdatingFirmware ? <LoaderCircle className="size-4 animate-spin" /> : <Cpu className="size-4" />}
            {isUpdatingFirmware ? "Actualizando…" : `Actualizar${otaRelease.data?.latestVersion ? ` a ${otaRelease.data.latestVersion}` : " firmware"}`}
          </Button>
        </CardContent>
      </Card>

      {games.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Crear una persona para asignar</CardTitle><CardDescription>Si todavía no existe, creá un perfil rápido y después elegilo en el color correspondiente.</CardDescription></CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Input className="min-w-64 flex-1" value={newProfileName} onChange={(event) => setNewProfileName(event.target.value)} placeholder="Nombre de la persona" />
            <Button variant="outline" onClick={createProfile} disabled={!newProfileName.trim() || isCreatingProfile}>
              {isCreatingProfile ? <LoaderCircle className="size-4 animate-spin" /> : null}Crear perfil
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {games.map((game) => (
        <Card key={game.summary.gameId}>
          <CardHeader><CardTitle>Partida #{game.summary.gameId}</CardTitle><CardDescription>{game.summary.deckName} · {game.players.length} jugadores · {game.turns.length} turnos</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {game.players.map((player) => (
              <div key={player.uid} className="grid gap-2 rounded-xl border p-4 md:grid-cols-[180px_1fr] md:items-center">
                <div><Badge variant="outline">{COLOR_LABELS[player.colorCode] || player.colorCode}</Badge><p className="mt-2 text-sm text-muted-foreground">{player.name || `Jugador ${player.position}`}</p></div>
                <select className="h-10 rounded-md border bg-background px-3 text-sm" aria-label={`Asignar ${player.colorCode}`} value={game.assignments[player.uid] ? `${game.assignments[player.uid].kind}:${game.assignments[player.uid].id}` : ""} onChange={(event) => assign(game.summary.gameId, player.uid, event.target.value)}>
                  <option value="">Mantener como jugador manual</option>
                  {(students.data?.data || []).map((student) => <option key={`student:${student.id}`} value={`student:${student.id}`}>Alumno · {student.fullName}</option>)}
                  {(profiles.data || []).map((profile) => <option key={`profile:${profile.id}`} value={`profile:${profile.id}`}>Perfil · {profile.displayName}</option>)}
                </select>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {games.length > 0 ? <Card><CardHeader><CardTitle className="flex items-center gap-2"><UploadCloud className="size-5" />2. Confirmar carga y limpieza</CardTitle><CardDescription>Si la carga falla, las partidas permanecen en la MagicBox.</CardDescription></CardHeader><CardContent><Button onClick={uploadAndDelete} disabled={phase !== "ready"}><UploadCloud className="size-4" />Subir {games.length} partidas y borrar originales</Button>{phase === "uploading" ? <span className="ml-3 text-sm text-muted-foreground"><LoaderCircle className="mr-1 inline size-4 animate-spin" />Procesando…</span> : null}</CardContent></Card> : null}
      {phase === "done" ? <Card className="border-emerald-300 bg-emerald-50"><CardContent className="flex items-center gap-3 pt-6 text-emerald-800"><CheckCircle2 className="size-5" />Las partidas quedaron cargadas y se confirmó el borrado en la MagicBox.</CardContent></Card> : null}
    </div>
  );
}
