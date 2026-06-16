"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { useLanguage, type AppLanguage } from "@/features/i18n/i18n-context";
import { cn } from "@/lib/utils";

type NotificationTone = "success" | "error";

export type NotificationInput = {
  tone: NotificationTone;
  title?: string;
  message: string;
  durationMs?: number;
};

type NotificationRecord = NotificationInput & {
  id: string;
};

type NotificationsContextValue = {
  notify: (notification: NotificationInput) => void;
  dismiss: (id: string) => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

const noopNotifications: NotificationsContextValue = {
  notify: () => {},
  dismiss: () => {},
};

const notificationMessages: Record<AppLanguage, {
  successTitle: string;
  errorTitle: string;
  close: string;
}> = {
  es: {
    successTitle: "Cambio confirmado",
    errorTitle: "No se pudo completar",
    close: "Cerrar aviso",
  },
  en: {
    successTitle: "Change confirmed",
    errorTitle: "Couldn't complete",
    close: "Dismiss notification",
  },
  pt: {
    successTitle: "Alteração confirmada",
    errorTitle: "Não foi possível concluir",
    close: "Fechar aviso",
  },
};

function createNotificationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { language } = useLanguage();
  const t = notificationMessages[language];
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);

  const dismiss = useCallback((id: string) => {
    setNotifications((current) => current.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback((notification: NotificationInput) => {
    const id = createNotificationId();
    const record = { ...notification, id };
    setNotifications((current) => [record, ...current].slice(0, 4));

    window.setTimeout(() => {
      dismiss(id);
    }, notification.durationMs ?? (notification.tone === "error" ? 7200 : 4600));
  }, [dismiss]);

  const value = useMemo(() => ({ notify, dismiss }), [dismiss, notify]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions text"
        className="pointer-events-none fixed top-4 right-4 z-[120] flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3"
      >
        {notifications.map((notification) => {
          const Icon = notification.tone === "success" ? CheckCircle2 : AlertTriangle;
          return (
            <div
              key={notification.id}
              role="status"
              className={cn(
                "pointer-events-auto flex items-start gap-3 rounded-lg border bg-white p-4 text-sm shadow-[0_18px_48px_rgba(15,23,42,0.18)]",
                notification.tone === "success"
                  ? "border-emerald-200 text-emerald-950"
                  : "border-red-200 text-red-950",
              )}
            >
              <div
                className={cn(
                  "mt-0.5 rounded-md p-1.5",
                  notification.tone === "success" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
                )}
              >
                <Icon className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">
                  {notification.title || (notification.tone === "success" ? t.successTitle : t.errorTitle)}
                </p>
                <p className="mt-1 break-words leading-6 text-muted-foreground">{notification.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(notification.id)}
                className="inline-flex shrink-0 rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label={t.close}
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  return context || noopNotifications;
}
