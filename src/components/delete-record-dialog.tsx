"use client";

import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useLanguage, type AppLanguage } from "@/features/i18n/i18n-context";

const deleteDialogMessages: Record<AppLanguage, {
  confirm: string;
  cancel: string;
  pending: string;
  warning: string;
}> = {
  es: {
    confirm: "Eliminar",
    cancel: "Cancelar",
    pending: "Eliminando...",
    warning: "Esta acción elimina el registro del flujo principal y necesita confirmación explícita.",
  },
  en: {
    confirm: "Delete",
    cancel: "Cancel",
    pending: "Deleting...",
    warning: "This action removes the record from the main flow and requires explicit confirmation.",
  },
  pt: {
    confirm: "Excluir",
    cancel: "Cancelar",
    pending: "Excluindo...",
    warning: "Esta ação remove o registro do fluxo principal e exige confirmação explícita.",
  },
};

export function DeleteRecordDialog({
  open,
  onClose,
  onConfirm,
  isPending = false,
  title,
  description,
  confirmLabel,
  cancelLabel,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  isPending?: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
}) {
  const { language } = useLanguage();
  const t = deleteDialogMessages[language];

  return (
    <Modal
      open={open}
      onClose={() => {
        if (isPending) return;
        onClose();
      }}
      title={title}
      description={description}
      className="max-w-xl"
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>{t.warning}</p>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            {cancelLabel || t.cancel}
          </Button>
          <Button type="button" variant="destructive" onClick={() => void onConfirm()} disabled={isPending}>
            {isPending ? t.pending : confirmLabel || t.confirm}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
