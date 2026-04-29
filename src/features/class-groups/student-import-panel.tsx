"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, FolderPlus, Upload, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClassGroup, importClassGroupStudents, useClassGroups } from "@/features/class-groups/api";
import type { ClassGroupStudentImportResult } from "@/features/class-groups/types";
import type { AuthUser } from "@/features/auth/types";
import { getErrorMessage } from "@/lib/utils";

type FeedbackState =
  | { type: "success"; message: string; result: ClassGroupStudentImportResult }
  | { type: "error"; message: string }
  | null;

type InlineMessage = { type: "success" | "error"; message: string } | null;

function hasPermission(user: AuthUser | null | undefined, permission: string, legacyPermission: string) {
  if (!user) return false;
  if (user.roles.includes("admin")) return true;
  const permissions = new Set(user.permissions || []);
  return permissions.has(permission) || permissions.has(legacyPermission);
}

function canImportStudents(user: AuthUser | null | undefined) {
  return hasPermission(user, "class_group:update", "class-group:update");
}

function canCreateGroups(user: AuthUser | null | undefined) {
  return hasPermission(user, "class_group:create", "class-group:create");
}

function slugifyGroupCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

export function StudentImportPanel({
  token,
  institutionId,
  institutionName,
  user,
}: {
  token?: string;
  institutionId?: string | null;
  institutionName?: string | null;
  user?: AuthUser | null;
}) {
  const queryClient = useQueryClient();
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupCode, setGroupCode] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [groupFeedback, setGroupFeedback] = useState<InlineMessage>(null);

  const classGroupsQuery = useClassGroups(token, institutionId);
  const classGroups = useMemo(() => classGroupsQuery.data?.data ?? [], [classGroupsQuery.data?.data]);
  const importEnabled = canImportStudents(user);
  const createEnabled = canCreateGroups(user);

  useEffect(() => {
    setSelectedFile(null);
    setFeedback(null);
    setGroupFeedback(null);
    setGroupName("");
    setGroupCode("");
    setSelectedGroupId("");
  }, [institutionId]);

  useEffect(() => {
    if (!selectedGroupId && classGroups.length > 0) {
      setSelectedGroupId(classGroups[0].id);
    }
  }, [classGroups, selectedGroupId]);

  const selectedGroup = classGroups.find((item) => item.id === selectedGroupId) ?? null;

  const createGroupMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("La sesión no tiene token activo.");
      if (!institutionId) throw new Error("Primero seleccioná una institución.");
      const normalizedName = groupName.trim();
      const normalizedCode = (groupCode.trim() || slugifyGroupCode(normalizedName)).slice(0, 50);

      if (!normalizedName) throw new Error("Escribí el nombre del grupo antes de crearlo.");
      if (!normalizedCode || normalizedCode.length < 3) {
        throw new Error("El código del grupo necesita al menos 3 caracteres válidos.");
      }

      return createClassGroup(token, {
        educationalCenterId: institutionId,
        name: normalizedName,
        code: normalizedCode,
        userId: null,
      });
    },
    onSuccess: async (createdGroup) => {
      setGroupName("");
      setGroupCode("");
      setSelectedGroupId(createdGroup.id);
      setGroupFeedback({ type: "success", message: `Grupo ${createdGroup.name} creado y listo para usar en la importación.` });
      await queryClient.invalidateQueries({ queryKey: ["class-groups"] });
      await queryClient.invalidateQueries({ queryKey: ["institutions"] });
      await queryClient.invalidateQueries({ queryKey: ["institutions", "detail"] });
    },
    onError: (error) => {
      setGroupFeedback({ type: "error", message: getErrorMessage(error) });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("La sesión no tiene token activo.");
      if (!selectedGroupId) throw new Error("Seleccioná primero el grupo destino.");
      if (!selectedFile) throw new Error("Elegí un archivo Excel .xlsx para continuar.");
      return importClassGroupStudents(token, selectedGroupId, selectedFile);
    },
    onSuccess: async (result) => {
      setFeedback({
        type: "success",
        message: `Importación terminada para ${result.groupName}: ${result.createdCount} creados, ${result.updatedCount} actualizados, ${result.skippedCount} sin cambios y ${result.errorCount} con observaciones.`,
        result,
      });
      setSelectedFile(null);
      await queryClient.invalidateQueries({ queryKey: ["institutions"] });
      await queryClient.invalidateQueries({ queryKey: ["institutions", "detail"] });
      await queryClient.invalidateQueries({ queryKey: ["class-groups"] });
    },
    onError: (error) => {
      setFeedback({ type: "error", message: getErrorMessage(error) });
    },
  });

  if (!institutionId) return null;

  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-5 text-primary" />
              Carga masiva de estudiantes por Excel
            </CardTitle>
            <CardDescription>
              Todo queda en el cuerpo principal: primero definís o elegís el grupo y después subís el archivo Excel sobre ese destino puntual.
            </CardDescription>
          </div>
          {institutionName ? <Badge variant="outline">{institutionName}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        {!importEnabled ? (
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
            Esta sesión no tiene permiso para importar estudiantes en grupos.
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-4">
            <div className="rounded-[26px] border border-border/70 bg-background/65 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">1. Crear o elegir grupo</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sin grupo no hay destino válido para la importación. Podés crear uno acá mismo y queda seleccionado automáticamente.
                  </p>
                </div>
                <Badge variant={classGroups.length > 0 ? "secondary" : "outline"}>
                  {classGroups.length > 0 ? `${classGroups.length} grupos visibles` : "sin grupos todavía"}
                </Badge>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_0.9fr_auto] md:items-end">
                <div className="grid gap-2">
                  <Label htmlFor="student-import-group-name">Nombre del grupo</Label>
                  <Input
                    id="student-import-group-name"
                    value={groupName}
                    disabled={!createEnabled || createGroupMutation.isPending}
                    onChange={(event) => {
                      const value = event.target.value;
                      setGroupName(value);
                      setGroupCode((current) => (current.trim().length > 0 ? current : slugifyGroupCode(value)));
                    }}
                    placeholder="Ej.: 5to A mañana"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="student-import-group-code">Código</Label>
                  <Input
                    id="student-import-group-code"
                    value={groupCode}
                    disabled={!createEnabled || createGroupMutation.isPending}
                    onChange={(event) => setGroupCode(slugifyGroupCode(event.target.value))}
                    placeholder="5to_a_manana"
                  />
                </div>
                <Button
                  type="button"
                  onClick={() => createGroupMutation.mutate()}
                  disabled={!createEnabled || createGroupMutation.isPending || !groupName.trim()}
                >
                  <FolderPlus className="mr-2 size-4" />
                  {createGroupMutation.isPending ? "Creando..." : "Crear grupo"}
                </Button>
              </div>

              {!createEnabled ? (
                <p className="mt-3 text-sm text-muted-foreground">Tu sesión actual no tiene permiso para crear grupos.</p>
              ) : null}

              {groupFeedback ? (
                <div className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${groupFeedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}>
                  {groupFeedback.message}
                </div>
              ) : null}

              <div className="mt-4 grid gap-2">
                <Label htmlFor="student-import-group">Grupo destino</Label>
                <select
                  id="student-import-group"
                  value={selectedGroupId}
                  onChange={(event) => setSelectedGroupId(event.target.value)}
                  disabled={!importEnabled || classGroupsQuery.isLoading || importMutation.isPending}
                  className="flex h-11 w-full rounded-2xl border border-input bg-white/92 px-4 py-2 text-sm text-foreground shadow-[0_10px_24px_rgba(66,128,164,0.08)] outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Seleccioná un grupo específico</option>
                  {classGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} · {group.code}
                    </option>
                  ))}
                </select>
              </div>

              {classGroups.length > 0 ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {classGroups.slice(0, 12).map((group) => (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => setSelectedGroupId(group.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${selectedGroupId === group.id ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-white/80 text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}
                    >
                      {group.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
                  Esta institución todavía no tiene grupos visibles. Creá uno arriba y después usalo para subir el Excel.
                </div>
              )}
            </div>

            <div className="rounded-[26px] border border-border/70 bg-background/65 p-4">
              <p className="text-sm font-medium text-foreground">2. Subir Excel al grupo elegido</p>
              <div className="mt-4 grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="student-import-file">Excel .xlsx</Label>
                  <Input
                    id="student-import-file"
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    disabled={!importEnabled || importMutation.isPending}
                    onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Encabezados esperados: <code>first_name</code>, <code>last_name</code>, <code>file_number</code>. También acepto <code>nombre</code>, <code>apellido</code> y <code>legajo</code>.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    onClick={() => importMutation.mutate()}
                    disabled={!importEnabled || !selectedGroupId || !selectedFile || importMutation.isPending}
                  >
                    <Upload className="mr-2 size-4" />
                    {importMutation.isPending ? "Importando..." : "Subir Excel"}
                  </Button>
                  {selectedGroup ? <Badge variant="secondary">Grupo: {selectedGroup.name}</Badge> : null}
                  {selectedFile ? <Badge variant="outline">{selectedFile.name}</Badge> : null}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-border/70 bg-muted/20 p-4">
            <p className="text-sm font-medium text-foreground">Reglas de correspondencia</p>
            <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
              <p>• Cada fila crea o actualiza un estudiante dentro del grupo seleccionado.</p>
              <p>• El grupo define la institución; no se puede mover un legajo a otra institución desde esta carga.</p>
              <p>• Si el legajo ya existe en otro grupo, la fila queda observada para evitar cruces de visibilidad.</p>
              <p>• Los datos quedan sujetos al scope del grupo y de la institución que ya expone el backend.</p>
            </div>
          </div>
        </div>

        {classGroupsQuery.isLoading ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
            Cargando grupos visibles para esta institución...
          </div>
        ) : null}

        {feedback ? (
          <div className={`rounded-2xl border p-4 text-sm ${feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}>
            <p className="font-medium">{feedback.message}</p>
            {feedback.type === "success" ? (
              <div className="mt-3 grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-200/80 bg-white/70 p-3">
                    <p className="text-xs uppercase tracking-[0.24em] text-emerald-700">creados</p>
                    <p className="mt-1 text-2xl font-semibold">{feedback.result.createdCount}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200/80 bg-white/70 p-3">
                    <p className="text-xs uppercase tracking-[0.24em] text-emerald-700">actualizados</p>
                    <p className="mt-1 text-2xl font-semibold">{feedback.result.updatedCount}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200/80 bg-white/70 p-3">
                    <p className="text-xs uppercase tracking-[0.24em] text-emerald-700">sin cambios</p>
                    <p className="mt-1 text-2xl font-semibold">{feedback.result.skippedCount}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200/80 bg-white/70 p-3">
                    <p className="text-xs uppercase tracking-[0.24em] text-emerald-700">observadas</p>
                    <p className="mt-1 text-2xl font-semibold">{feedback.result.errorCount}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-200/80 bg-white/70 p-3">
                  <div className="flex items-center gap-2 text-emerald-900">
                    <Users className="size-4" />
                    <p className="font-medium">Observaciones de importación</p>
                  </div>
                  {feedback.result.issues.length === 0 ? (
                    <p className="mt-2 text-sm text-emerald-800">No hubo filas con conflicto.</p>
                  ) : (
                    <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto pr-1">
                      {feedback.result.issues.slice(0, 20).map((issue) => (
                        <div key={`${issue.rowNumber}-${issue.fileNumber || issue.message}`} className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 text-sm text-emerald-900">
                          <p className="font-medium">Fila {issue.rowNumber}{issue.fileNumber ? ` · ${issue.fileNumber}` : ""}</p>
                          <p className="mt-1 text-emerald-800">{issue.message}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
