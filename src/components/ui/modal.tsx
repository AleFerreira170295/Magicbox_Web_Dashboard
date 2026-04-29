"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  className,
  hideHeader = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  hideHeader?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (typeof document === "undefined" || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto bg-slate-950/42 p-3 backdrop-blur-[6px] sm:p-4 lg:items-center lg:p-8">
      <div
        className="absolute inset-0"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-[96] my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[1120px] flex-col overflow-hidden rounded-[30px] border border-border/80 bg-background shadow-[0_32px_80px_rgba(15,23,42,0.24)] sm:max-h-[calc(100dvh-2rem)] lg:max-h-[calc(100dvh-3rem)]",
          className,
        )}
      >
        {hideHeader ? (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 z-[97] inline-flex shrink-0 rounded-full border border-border/70 bg-white p-2.5 text-foreground shadow-[0_8px_18px_rgba(33,59,87,0.06)] transition hover:bg-muted/70"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        ) : (
          <div className="flex items-start justify-between gap-4 border-b border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(242,248,253,0.94))] px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-[-0.03em] text-foreground sm:text-2xl">{title}</h2>
              {description ? <p className="mt-1.5 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-[15px] sm:leading-7">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex shrink-0 rounded-full border border-border/70 bg-white p-2.5 text-foreground shadow-[0_8px_18px_rgba(33,59,87,0.06)] transition hover:bg-muted/70"
              aria-label="Cerrar"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        <div className={cn("min-h-0 overflow-y-auto", hideHeader ? "p-3 sm:p-4 lg:p-5" : "px-5 py-4 sm:px-6 sm:py-5")}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
