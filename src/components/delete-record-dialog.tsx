"use client";

import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

export function DeleteRecordDialog({
  open,
  onClose,
  onConfirm,
  isPending = false,
  title,
  description,
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
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
          <p>Esta acción elimina el registro del flujo principal y necesita confirmación explícita.</p>
        </div>

        <div className="flex flex-wrap justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="destructive" onClick={() => void onConfirm()} disabled={isPending}>
            {isPending ? "Eliminando..." : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
