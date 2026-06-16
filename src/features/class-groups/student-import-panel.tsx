"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, FolderPlus, Upload, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNotifications } from "@/components/ui/notifications";
import { createClassGroup, importClassGroupStudents, useClassGroups } from "@/features/class-groups/api";
import type { ClassGroupStudentImportResult } from "@/features/class-groups/types";
import type { AuthUser } from "@/features/auth/types";
import { useLanguage, type AppLanguage } from "@/features/i18n/i18n-context";
import { getErrorMessage } from "@/lib/utils";

type FeedbackState =
  | { type: "success"; message: string; result: ClassGroupStudentImportResult }
  | { type: "error"; message: string }
  | null;

type InlineMessage = { type: "success" | "error"; message: string } | null;

const SUPPORTED_IMPORT_EXTENSIONS = new Set([".xlsx", ".csv"]);

const studentImportMessages: Record<AppLanguage, {
  errors: {
    noToken: string;
    noInstitution: string;
    groupNameRequired: string;
    groupCodeRequired: string;
    selectGroup: string;
    selectFile: string;
    fileType: string;
  };
  success: {
    groupCreated: (name: string) => string;
    importFinished: (result: ClassGroupStudentImportResult) => string;
  };
  header: { title: string; description: string; noImportPermission: string };
  group: {
    stepTitle: string;
    stepDescription: string;
    visibleGroups: (count: number) => string;
    noGroupsBadge: string;
    name: string;
    namePlaceholder: string;
    code: string;
    creating: string;
    create: string;
    noCreatePermission: string;
    destination: string;
    selectSpecific: string;
    noGroups: string;
  };
  file: {
    stepTitle: string;
    label: string;
    help: ReactNode;
    importing: string;
    upload: string;
    selectedGroup: (name: string) => string;
  };
  rules: { title: string; items: string[] };
  loadingGroups: string;
  result: {
    created: string;
    updated: string;
    skipped: string;
    observed: string;
    issuesTitle: string;
    noIssues: string;
    row: (rowNumber: number, fileNumber?: string | null) => string;
  };
}> = {
  es: {
    errors: {
      noToken: "La sesión no tiene token activo.",
      noInstitution: "Primero seleccioná una institución.",
      groupNameRequired: "Escribí el nombre del grupo antes de crearlo.",
      groupCodeRequired: "El código del grupo necesita al menos 3 caracteres válidos.",
      selectGroup: "Seleccioná primero el grupo destino.",
      selectFile: "Elegí un archivo Excel .xlsx o CSV para continuar.",
      fileType: "El archivo debe ser .xlsx o .csv.",
    },
    success: {
      groupCreated: (name) => `Grupo ${name} creado y listo para usar en la importación.`,
      importFinished: (result) => `Importación terminada para ${result.groupName}: ${result.createdCount} creados, ${result.updatedCount} actualizados, ${result.skippedCount} sin cambios y ${result.errorCount} con observaciones.`,
    },
    header: {
      title: "Carga masiva de estudiantes por Excel / CSV",
      description: "Todo queda en el cuerpo principal: primero definís o elegís el grupo y después subís el archivo Excel o CSV sobre ese destino puntual.",
      noImportPermission: "Esta sesión no tiene permiso para importar estudiantes en grupos.",
    },
    group: {
      stepTitle: "1. Crear o elegir grupo",
      stepDescription: "Sin grupo no hay destino válido para la importación. Podés crear uno acá mismo y queda seleccionado automáticamente.",
      visibleGroups: (count) => `${count} grupos visibles`,
      noGroupsBadge: "sin grupos todavía",
      name: "Nombre del grupo",
      namePlaceholder: "Ej.: 5to A mañana",
      code: "Código",
      creating: "Creando...",
      create: "Crear grupo",
      noCreatePermission: "Tu sesión actual no tiene permiso para crear grupos.",
      destination: "Grupo destino",
      selectSpecific: "Seleccioná un grupo específico",
      noGroups: "Esta institución todavía no tiene grupos visibles. Creá uno arriba y después usalo para subir el Excel.",
    },
    file: {
      stepTitle: "2. Subir archivo al grupo elegido",
      label: "Excel .xlsx o CSV",
      help: <>Encabezados esperados: <code>first_name</code>, <code>last_name</code>, <code>file_number</code>. Opcionales: <code>second_name</code>, <code>second_last_name</code>, <code>birth_date</code>. También acepto variantes como <code>nombre</code>, <code>primer nombre</code>, <code>apellido</code>, <code>apellido paterno</code>, <code>legajo</code>, <code>n° de legajo</code>, <code>segundo_nombre</code>, <code>segundo_apellido</code> y <code>fecha_nacimiento</code>. Si el archivo trae una fila de título antes de los encabezados, el importador intenta detectarlos igual.</>,
      importing: "Importando...",
      upload: "Subir archivo",
      selectedGroup: (name) => `Grupo: ${name}`,
    },
    rules: {
      title: "Reglas de correspondencia",
      items: [
        "Cada fila crea o actualiza un estudiante dentro del grupo seleccionado.",
        "Segundo nombre, segundo apellido y fecha de nacimiento son opcionales; si vienen en el Excel se guardan en la ficha del jugador.",
        "Si el legajo ya existe en otro grupo de la misma institución, se reasigna al grupo elegido y se actualiza la ficha.",
        "Si el legajo pertenece a otra institución, la fila queda observada para evitar cruces de visibilidad.",
        "Los datos quedan sujetos al scope del grupo y de la institución que ya expone el backend.",
      ],
    },
    loadingGroups: "Cargando grupos visibles para esta institución...",
    result: { created: "creados", updated: "actualizados", skipped: "sin cambios", observed: "observadas", issuesTitle: "Observaciones de importación", noIssues: "No hubo filas con conflicto.", row: (rowNumber, fileNumber) => `Fila ${rowNumber}${fileNumber ? ` · ${fileNumber}` : ""}` },
  },
  en: {
    errors: {
      noToken: "The session does not have an active token.",
      noInstitution: "Select an institution first.",
      groupNameRequired: "Enter the group name before creating it.",
      groupCodeRequired: "The group code needs at least 3 valid characters.",
      selectGroup: "Select the destination group first.",
      selectFile: "Choose an Excel .xlsx or CSV file to continue.",
      fileType: "The file must be .xlsx or .csv.",
    },
    success: {
      groupCreated: (name) => `Group ${name} was created and is ready for the import.`,
      importFinished: (result) => `Import finished for ${result.groupName}: ${result.createdCount} created, ${result.updatedCount} updated, ${result.skippedCount} unchanged, and ${result.errorCount} with notes.`,
    },
    header: {
      title: "Bulk student upload by Excel / CSV",
      description: "Everything stays in the main flow: first create or choose the group, then upload the Excel or CSV file to that exact destination.",
      noImportPermission: "This session does not have permission to import students into groups.",
    },
    group: {
      stepTitle: "1. Create or choose a group",
      stepDescription: "Without a group there is no valid import destination. You can create one here and it will be selected automatically.",
      visibleGroups: (count) => `${count} visible groups`,
      noGroupsBadge: "no groups yet",
      name: "Group name",
      namePlaceholder: "Example: 5th A morning",
      code: "Code",
      creating: "Creating...",
      create: "Create group",
      noCreatePermission: "Your current session does not have permission to create groups.",
      destination: "Destination group",
      selectSpecific: "Select a specific group",
      noGroups: "This institution does not have visible groups yet. Create one above and then use it to upload the Excel file.",
    },
    file: {
      stepTitle: "2. Upload file to the selected group",
      label: "Excel .xlsx or CSV",
      help: <>Expected headers: <code>first_name</code>, <code>last_name</code>, <code>file_number</code>. Optional: <code>second_name</code>, <code>second_last_name</code>, <code>birth_date</code>. Variants such as <code>nombre</code>, <code>primer nombre</code>, <code>apellido</code>, <code>apellido paterno</code>, <code>legajo</code>, <code>n° de legajo</code>, <code>segundo_nombre</code>, <code>segundo_apellido</code>, and <code>fecha_nacimiento</code> are also accepted. If the file has a title row before the headers, the importer tries to detect them.</>,
      importing: "Importing...",
      upload: "Upload file",
      selectedGroup: (name) => `Group: ${name}`,
    },
    rules: {
      title: "Matching rules",
      items: [
        "Each row creates or updates a student inside the selected group.",
        "Middle name, second last name, and birth date are optional; when present in the Excel file they are saved in the player record.",
        "If the file number already exists in another group in the same institution, it is reassigned to the selected group and the record is updated.",
        "If the file number belongs to another institution, the row is flagged to avoid visibility conflicts.",
        "The data remains bound to the group and institution scope already exposed by the backend.",
      ],
    },
    loadingGroups: "Loading visible groups for this institution...",
    result: { created: "created", updated: "updated", skipped: "unchanged", observed: "observed", issuesTitle: "Import notes", noIssues: "There were no rows with conflicts.", row: (rowNumber, fileNumber) => `Row ${rowNumber}${fileNumber ? ` · ${fileNumber}` : ""}` },
  },
  pt: {
    errors: {
      noToken: "A sessão não tem token ativo.",
      noInstitution: "Selecione uma instituição primeiro.",
      groupNameRequired: "Informe o nome do grupo antes de criá-lo.",
      groupCodeRequired: "O código do grupo precisa de pelo menos 3 caracteres válidos.",
      selectGroup: "Selecione primeiro o grupo de destino.",
      selectFile: "Escolha um arquivo Excel .xlsx ou CSV para continuar.",
      fileType: "O arquivo deve ser .xlsx ou .csv.",
    },
    success: {
      groupCreated: (name) => `Grupo ${name} criado e pronto para usar na importação.`,
      importFinished: (result) => `Importação finalizada para ${result.groupName}: ${result.createdCount} criados, ${result.updatedCount} atualizados, ${result.skippedCount} sem alterações e ${result.errorCount} com observações.`,
    },
    header: {
      title: "Carga massiva de estudantes por Excel / CSV",
      description: "Tudo fica no fluxo principal: primeiro você cria ou escolhe o grupo e depois envia o Excel ou CSV para esse destino específico.",
      noImportPermission: "Esta sessão não tem permissão para importar estudantes em grupos.",
    },
    group: {
      stepTitle: "1. Criar ou escolher grupo",
      stepDescription: "Sem grupo não há destino válido para a importação. Você pode criar um aqui e ele ficará selecionado automaticamente.",
      visibleGroups: (count) => `${count} grupos visíveis`,
      noGroupsBadge: "sem grupos ainda",
      name: "Nome do grupo",
      namePlaceholder: "Ex.: 5º A manhã",
      code: "Código",
      creating: "Criando...",
      create: "Criar grupo",
      noCreatePermission: "Sua sessão atual não tem permissão para criar grupos.",
      destination: "Grupo de destino",
      selectSpecific: "Selecione um grupo específico",
      noGroups: "Esta instituição ainda não tem grupos visíveis. Crie um acima e depois use-o para enviar o Excel.",
    },
    file: {
      stepTitle: "2. Enviar arquivo ao grupo escolhido",
      label: "Excel .xlsx ou CSV",
      help: <>Cabeçalhos esperados: <code>first_name</code>, <code>last_name</code>, <code>file_number</code>. Opcionais: <code>second_name</code>, <code>second_last_name</code>, <code>birth_date</code>. Também aceito variantes como <code>nombre</code>, <code>primer nombre</code>, <code>apellido</code>, <code>apellido paterno</code>, <code>legajo</code>, <code>n° de legajo</code>, <code>segundo_nombre</code>, <code>segundo_apellido</code> e <code>fecha_nacimiento</code>. Se o arquivo tiver uma linha de título antes dos cabeçalhos, o importador tenta detectá-los.</>,
      importing: "Importando...",
      upload: "Enviar arquivo",
      selectedGroup: (name) => `Grupo: ${name}`,
    },
    rules: {
      title: "Regras de correspondência",
      items: [
        "Cada linha cria ou atualiza um estudante dentro do grupo selecionado.",
        "Segundo nome, segundo sobrenome e data de nascimento são opcionais; se vierem no Excel, são salvos no cadastro do jogador.",
        "Se a matrícula já existe em outro grupo da mesma instituição, ela é reassociada ao grupo escolhido e o cadastro é atualizado.",
        "Se a matrícula pertence a outra instituição, a linha fica observada para evitar conflitos de visibilidade.",
        "Os dados ficam sujeitos ao escopo do grupo e da instituição que o backend já expõe.",
      ],
    },
    loadingGroups: "Carregando grupos visíveis para esta instituição...",
    result: { created: "criados", updated: "atualizados", skipped: "sem alterações", observed: "observadas", issuesTitle: "Observações da importação", noIssues: "Não houve linhas com conflito.", row: (rowNumber, fileNumber) => `Linha ${rowNumber}${fileNumber ? ` · ${fileNumber}` : ""}` },
  },
};

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

function getFileExtension(fileName: string) {
  const lastDotIndex = fileName.lastIndexOf(".");
  return lastDotIndex >= 0 ? fileName.slice(lastDotIndex).toLowerCase() : "";
}

function isSupportedImportFile(file: File) {
  return SUPPORTED_IMPORT_EXTENSIONS.has(getFileExtension(file.name));
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
  if (!institutionId) return null;

  return <StudentImportPanelContent key={institutionId} token={token} institutionId={institutionId} institutionName={institutionName} user={user} />;
}

function StudentImportPanelContent({
  token,
  institutionId,
  institutionName,
  user,
}: {
  token?: string;
  institutionId: string;
  institutionName?: string | null;
  user?: AuthUser | null;
}) {
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const { notify } = useNotifications();
  const t = studentImportMessages[language];
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupCode, setGroupCode] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [groupFeedback, setGroupFeedback] = useState<InlineMessage>(null);
  const [fileInputKey, setFileInputKey] = useState(0);

  const classGroupsQuery = useClassGroups(token, institutionId);
  const classGroups = useMemo(
    () => (classGroupsQuery.data?.data ?? []).filter((group) => group.educationalCenterId === institutionId),
    [classGroupsQuery.data?.data, institutionId],
  );
  const importEnabled = canImportStudents(user);
  const createEnabled = canCreateGroups(user);
  const effectiveSelectedGroupId = selectedGroupId || classGroups[0]?.id || "";
  const selectedGroup = classGroups.find((item) => item.id === effectiveSelectedGroupId) ?? null;

  const createGroupMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error(t.errors.noToken);
      if (!institutionId) throw new Error(t.errors.noInstitution);
      const normalizedName = groupName.trim();
      const normalizedCode = (groupCode.trim() || slugifyGroupCode(normalizedName)).slice(0, 50);

      if (!normalizedName) throw new Error(t.errors.groupNameRequired);
      if (!normalizedCode || normalizedCode.length < 3) {
        throw new Error(t.errors.groupCodeRequired);
      }

      return createClassGroup(token, {
        educationalCenterId: institutionId,
        name: normalizedName,
        code: normalizedCode,
        userId: null,
      });
    },
    onSuccess: async (createdGroup) => {
      const message = t.success.groupCreated(createdGroup.name);
      setGroupName("");
      setGroupCode("");
      setSelectedGroupId(createdGroup.id);
      setGroupFeedback({ type: "success", message });
      notify({ tone: "success", message });
      await queryClient.invalidateQueries({ queryKey: ["class-groups"] });
      await queryClient.invalidateQueries({ queryKey: ["institutions"] });
      await queryClient.invalidateQueries({ queryKey: ["institutions", "detail"] });
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      setGroupFeedback({ type: "error", message });
      notify({ tone: "error", message });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error(t.errors.noToken);
      if (!effectiveSelectedGroupId) throw new Error(t.errors.selectGroup);
      if (!selectedFile) throw new Error(t.errors.selectFile);
      return importClassGroupStudents(token, effectiveSelectedGroupId, selectedFile);
    },
    onSuccess: async (result) => {
      const message = t.success.importFinished(result);
      setFeedback({
        type: "success",
        message,
        result,
      });
      notify({ tone: "success", message });
      setSelectedFile(null);
      setFileInputKey((current) => current + 1);
      await queryClient.invalidateQueries({ queryKey: ["institutions"] });
      await queryClient.invalidateQueries({ queryKey: ["institutions", "detail"] });
      await queryClient.invalidateQueries({ queryKey: ["class-groups"] });
      await queryClient.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (error) => {
      const message = getErrorMessage(error);
      setFeedback({ type: "error", message });
      notify({ tone: "error", message });
    },
  });

  const handleFileChange = (file: File | null) => {
    setFeedback(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!isSupportedImportFile(file)) {
      setSelectedFile(null);
      setFileInputKey((current) => current + 1);
      setFeedback({ type: "error", message: t.errors.fileType });
      notify({ tone: "error", message: t.errors.fileType });
      return;
    }

    setSelectedFile(file);
  };

  return (
    <Card className="border-border/80 bg-card/95 shadow-[0_16px_40px_rgba(31,42,55,0.06)]">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-5 text-primary" />
              {t.header.title}
            </CardTitle>
            <CardDescription>{t.header.description}</CardDescription>
          </div>
          {institutionName ? <Badge variant="outline">{institutionName}</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        {!importEnabled ? (
          <div className="rounded-2xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
            {t.header.noImportPermission}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="grid gap-4">
            <div className="rounded-[26px] border border-border/70 bg-background/65 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{t.group.stepTitle}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{t.group.stepDescription}</p>
                </div>
                <Badge variant={classGroups.length > 0 ? "secondary" : "outline"}>
                  {classGroups.length > 0 ? t.group.visibleGroups(classGroups.length) : t.group.noGroupsBadge}
                </Badge>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_0.9fr_auto] md:items-end">
                <div className="grid gap-2">
                  <Label htmlFor="student-import-group-name">{t.group.name}</Label>
                  <Input
                    id="student-import-group-name"
                    value={groupName}
                    disabled={!createEnabled || createGroupMutation.isPending}
                    onChange={(event) => {
                      const value = event.target.value;
                      setGroupName(value);
                      setGroupCode((current) => (current.trim().length > 0 ? current : slugifyGroupCode(value)));
                    }}
                    placeholder={t.group.namePlaceholder}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="student-import-group-code">{t.group.code}</Label>
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
                  {createGroupMutation.isPending ? t.group.creating : t.group.create}
                </Button>
              </div>

              {!createEnabled ? (
                <p className="mt-3 text-sm text-muted-foreground">{t.group.noCreatePermission}</p>
              ) : null}

              {groupFeedback ? (
                <div className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${groupFeedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}>
                  {groupFeedback.message}
                </div>
              ) : null}

              <div className="mt-4 grid gap-2">
                <Label htmlFor="student-import-group">{t.group.destination}</Label>
                <select
                  id="student-import-group"
                  value={effectiveSelectedGroupId}
                  onChange={(event) => setSelectedGroupId(event.target.value)}
                  disabled={!importEnabled || classGroupsQuery.isLoading || importMutation.isPending}
                  className="flex h-11 w-full rounded-2xl border border-input bg-white/92 px-4 py-2 text-sm text-foreground shadow-[0_10px_24px_rgba(66,128,164,0.08)] outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">{t.group.selectSpecific}</option>
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
                      className={`rounded-full border px-3 py-1.5 text-xs transition ${effectiveSelectedGroupId === group.id ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-white/80 text-muted-foreground hover:border-primary/30 hover:text-foreground"}`}
                    >
                      {group.name}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
                  {t.group.noGroups}
                </div>
              )}
            </div>

            <div className="rounded-[26px] border border-border/70 bg-background/65 p-4">
              <p className="text-sm font-medium text-foreground">{t.file.stepTitle}</p>
              <div className="mt-4 grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="student-import-file">{t.file.label}</Label>
                  <Input
                    key={fileInputKey}
                    id="student-import-file"
                    type="file"
                    accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                    disabled={!importEnabled || importMutation.isPending}
                    onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-muted-foreground">{t.file.help}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    onClick={() => importMutation.mutate()}
                    disabled={!importEnabled || !effectiveSelectedGroupId || !selectedFile || importMutation.isPending}
                  >
                    <Upload className="mr-2 size-4" />
                    {importMutation.isPending ? t.file.importing : t.file.upload}
                  </Button>
                  {selectedGroup ? <Badge variant="secondary">{t.file.selectedGroup(selectedGroup.name)}</Badge> : null}
                  {selectedFile ? <Badge variant="outline">{selectedFile.name}</Badge> : null}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-border/70 bg-muted/20 p-4">
            <p className="text-sm font-medium text-foreground">{t.rules.title}</p>
            <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
              {t.rules.items.map((item) => <p key={item}>• {item}</p>)}
            </div>
          </div>
        </div>

        {classGroupsQuery.isLoading ? (
          <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4 text-sm text-muted-foreground">
            {t.loadingGroups}
          </div>
        ) : null}

        {feedback ? (
          <div className={`rounded-2xl border p-4 text-sm ${feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}>
            <p className="font-medium">{feedback.message}</p>
            {feedback.type === "success" ? (
              <div className="mt-3 grid gap-3 lg:grid-cols-[0.8fr_1.2fr]">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-200/80 bg-white/70 p-3">
                    <p className="text-xs uppercase tracking-[0.24em] text-emerald-700">{t.result.created}</p>
                    <p className="mt-1 text-2xl font-semibold">{feedback.result.createdCount}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200/80 bg-white/70 p-3">
                    <p className="text-xs uppercase tracking-[0.24em] text-emerald-700">{t.result.updated}</p>
                    <p className="mt-1 text-2xl font-semibold">{feedback.result.updatedCount}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200/80 bg-white/70 p-3">
                    <p className="text-xs uppercase tracking-[0.24em] text-emerald-700">{t.result.skipped}</p>
                    <p className="mt-1 text-2xl font-semibold">{feedback.result.skippedCount}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-200/80 bg-white/70 p-3">
                    <p className="text-xs uppercase tracking-[0.24em] text-emerald-700">{t.result.observed}</p>
                    <p className="mt-1 text-2xl font-semibold">{feedback.result.errorCount}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-emerald-200/80 bg-white/70 p-3">
                  <div className="flex items-center gap-2 text-emerald-900">
                    <Users className="size-4" />
                    <p className="font-medium">{t.result.issuesTitle}</p>
                  </div>
                  {feedback.result.issues.length === 0 ? (
                    <p className="mt-2 text-sm text-emerald-800">{t.result.noIssues}</p>
                  ) : (
                    <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto pr-1">
                      {feedback.result.issues.slice(0, 20).map((issue) => (
                        <div key={`${issue.rowNumber}-${issue.fileNumber || issue.message}`} className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 text-sm text-emerald-900">
                          <p className="font-medium">{t.result.row(issue.rowNumber, issue.fileNumber)}</p>
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
