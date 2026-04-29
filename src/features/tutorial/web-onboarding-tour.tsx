"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BookOpen,
  Building2,
  Cable,
  Database,
  HeartPulse,
  KeyRound,
  Map,
  ShieldAlert,
  Smartphone,
  Sparkles,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AppRole, AuthUser } from "@/features/auth/types";
import { canAccessPermissionsModule } from "@/features/auth/permission-contract";

export type TutorialStep = {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  bullets: string[];
  href?: string;
  ctaLabel?: string;
  badge?: string;
};

function buildStep(
  id: string,
  title: string,
  description: string,
  icon: LucideIcon,
  bullets: string[],
  options?: Pick<TutorialStep, "href" | "ctaLabel" | "badge">,
): TutorialStep {
  return {
    id,
    title,
    description,
    icon,
    bullets,
    ...options,
  };
}

function userName(user: AuthUser | null) {
  if (!user) return "tu cuenta";
  return user.firstName?.trim() || user.fullName?.trim() || user.email;
}

function getPrimaryRole(user: AuthUser | null): AppRole | null {
  if (!user) return null;
  if (user.roles.includes("admin")) return "admin";
  if (user.roles.includes("government-viewer")) return "government-viewer";
  if (user.roles.includes("institution-admin")) return "institution-admin";
  if (user.roles.includes("director")) return "director";
  if (user.roles.includes("researcher")) return "researcher";
  if (user.roles.includes("family")) return "family";
  if (user.roles.includes("teacher")) return "teacher";
  return (user.roles[0] as AppRole | undefined) || null;
}

function canVisitTutorialRoute(user: AuthUser | null, href?: string) {
  if (!href || !user) return true;

  const hasRole = (role: AppRole) => user.roles.includes(role);

  switch (href) {
    case "/dashboard":
      return true;
    case "/territorial-alerts":
    case "/territorial-overview":
      return hasRole("government-viewer");
    case "/syncs":
    case "/games":
      return (["teacher", "director", "researcher", "family", "admin", "institution-admin"] as AppRole[]).some(hasRole);
    case "/users":
      return (["admin", "institution-admin", "family"] as AppRole[]).some(hasRole);
    case "/permissions":
      return canAccessPermissionsModule(user);
    case "/institutions":
      return (["admin", "institution-admin", "director"] as AppRole[]).some(hasRole);
    case "/health":
    case "/settings":
      return hasRole("admin");
    case "/profiles":
      return (["admin", "institution-admin", "director"] as AppRole[]).some(hasRole);
    case "/devices":
      return (["teacher", "director", "admin", "institution-admin", "family"] as AppRole[]).some(hasRole);
    default:
      return true;
  }
}

function finalizeTutorialSteps(user: AuthUser | null, steps: TutorialStep[]) {
  const filtered = steps.filter((step) => canVisitTutorialRoute(user, step.href));
  return filtered.length > 0 ? filtered : steps;
}

export function getWebTutorialSteps(user: AuthUser | null): TutorialStep[] {
  const name = userName(user);
  const role = getPrimaryRole(user);

  switch (role) {
    case "admin":
      return finalizeTutorialSteps(user, [
        buildStep(
          "welcome",
          `Bienvenido, ${name}`,
          "Esta cuenta entra al dashboard con visión global de plataforma. La idea del tutorial es ubicar rápido dónde está cada frente operativo sin obligarte a recorrer todo a ciegas.",
          Sparkles,
          [
            "La home resume usuarios, instituciones, dispositivos, syncs, partidas y salud técnica.",
            "La navegación lateral ya está recortada por rol, así que no hace falta adivinar qué módulo corresponde.",
          ],
          { href: "/dashboard", ctaLabel: "Abrir dashboard", badge: "Vista plataforma" },
        ),
        buildStep(
          "governance",
          "Usuarios, permisos e instituciones",
          "Este bloque concentra gobernanza: altas, revisión de ACL, bundles de permisos y lectura institucional operativa.",
          Users,
          [
            "Usuarios: padrón, roles y revisión del alcance efectivo.",
            "Permisos: contrato ACL y señales de sesión incompleta.",
            "Instituciones: estado operativo, datos base y vínculo con usuarios/dispositivos.",
          ],
          { href: "/users", ctaLabel: "Ir a usuarios", badge: "Gobernanza" },
        ),
        buildStep(
          "operations",
          "Parque, juego y sincronización",
          "La operación diaria vive en dispositivos, partidas y syncs. Desde ahí podés detectar parque sin owner, sesiones sin turnos o trazabilidad incompleta.",
          Smartphone,
          [
            "Dispositivos: hardware visible, scope y owner.",
            "Partidas: sesiones, jugadores, turnos y actividad real.",
            "Syncs: captura reciente y raw disponible para seguimiento.",
          ],
          { href: "/devices", ctaLabel: "Ver dispositivos", badge: "Operación" },
        ),
        buildStep(
          "technical",
          "Salud y configuración",
          "Cuando necesites mirar runtime efectivo o estado técnico del sistema, la ruta está en Salud y Configuración.",
          HeartPulse,
          [
            "Salud expone checks, versión y señales del backend.",
            "Configuración resume runtime, catálogos y superficies administrativas.",
          ],
          { href: "/health", ctaLabel: "Revisar salud", badge: "Técnico" },
        ),
      ]);
    case "government-viewer":
      return finalizeTutorialSteps(user, [
        buildStep(
          "welcome",
          `Bienvenido, ${name}`,
          "Esta vista está pensada para seguimiento territorial y lectura ejecutiva. No intenta exponer operación interna que no aporte a este perfil.",
          Sparkles,
          [
            "La home ya concentra filtros, tendencias y score territorial compuesto.",
            "Los módulos visibles priorizan síntesis, alertas y drilldown geográfico.",
          ],
          { href: "/dashboard", ctaLabel: "Abrir home ejecutiva", badge: "Vista gobierno" },
        ),
        buildStep(
          "alerts",
          "Alertas territoriales",
          "Acá aparecen focos críticos y territorios que merecen revisión antes de entrar al detalle completo.",
          ShieldAlert,
          [
            "Sirve para detectar caídas de actividad, zonas sin turnos o señales de riesgo.",
            "La lectura está organizada para priorizar rápidamente dónde mirar.",
          ],
          { href: "/territorial-alerts", ctaLabel: "Ver alertas", badge: "Prioridad" },
        ),
        buildStep(
          "map",
          "Territorios e instituciones",
          "Este módulo baja del agregado general al territorio concreto para ver instituciones, cohortes y actividad visible.",
          Map,
          [
            "Permite usar el drilldown país → estado → ciudad.",
            "Funciona bien como segundo paso después de detectar una alerta o un score bajo.",
          ],
          { href: "/territorial-overview", ctaLabel: "Ver territorios", badge: "Drilldown" },
        ),
      ]);
    case "institution-admin":
    case "director":
      return finalizeTutorialSteps(user, [
        buildStep(
          "welcome",
          `Bienvenido, ${name}`,
          "Tu experiencia está recortada al alcance institucional. La home ya prioriza usuarios, dispositivos, perfiles y actividad visible sin mezclarlo con operación global.",
          Sparkles,
          [
            "El dashboard institucional sirve para ordenar el día y detectar huecos de operación.",
            "Los accesos visibles respetan el ACL efectivo de tu sesión.",
          ],
          { href: "/dashboard", ctaLabel: "Abrir home institucional", badge: "Vista institucional" },
        ),
        buildStep(
          "people",
          "Usuarios e instituciones",
          "Desde acá podés revisar padrón, alcance institucional y consistencia del contexto visible para tu cuenta.",
          Building2,
          [
            role === "institution-admin"
              ? "Usuarios te deja revisar altas, roles y lecturas operativas del padrón visible."
              : "Instituciones resume el contexto operativo sin exponerte superficies de superadmin.",
            "El objetivo es que la gobernanza cotidiana quede a mano, no escondida.",
          ],
          { href: role === "institution-admin" ? "/users" : "/institutions", ctaLabel: role === "institution-admin" ? "Ir a usuarios" : "Ver instituciones", badge: "Cobertura" },
        ),
        buildStep(
          "operation",
          "Dispositivos, partidas y syncs",
          "La operación visible del uso real vive en estos módulos. Es el mejor lugar para revisar parque, actividad de juego y trazabilidad reciente.",
          Smartphone,
          [
            "Dispositivos: status, owner y alcance visible.",
            "Partidas y syncs: lectura de actividad y consistencia de captura.",
          ],
          { href: "/devices", ctaLabel: "Ver dispositivos", badge: "Operación" },
        ),
        buildStep(
          "profiles",
          role === "institution-admin" ? "Perfiles y permisos" : "Perfiles visibles",
          role === "institution-admin"
            ? "Perfiles te ayuda a revisar bindings y sesiones. Si tu ACL llega completa, Permisos también queda disponible para validar el contrato institucional."
            : "Perfiles resume bindings y sesiones visibles, útil para cerrar el circuito entre usuarios, juego y dispositivos.",
          role === "institution-admin" ? KeyRound : UserRound,
          role === "institution-admin"
            ? [
                "Perfiles: bindings activos, sesiones y alcance real.",
                "Permisos: lectura del contrato ACL cuando la sesión lo habilita.",
              ]
            : ["Perfiles conecta la lectura de personas con el uso real visible en la institución."],
          { href: "/profiles", ctaLabel: "Ver perfiles", badge: "Seguimiento" },
        ),
      ]);
    case "researcher":
      return finalizeTutorialSteps(user, [
        buildStep(
          "welcome",
          `Bienvenido, ${name}`,
          "Esta experiencia prioriza evidencia visible, consistencia de muestra y lectura rápida de datos útiles para investigación.",
          Sparkles,
          [
            "La home researcher resume cobertura, turnos, mazos activos y señales tempranas de captura.",
            "La navegación está enfocada en pocas superficies para no meter ruido operativo.",
          ],
          { href: "/dashboard", ctaLabel: "Abrir home researcher", badge: "Vista investigación" },
        ),
        buildStep(
          "games",
          "Partidas",
          "Este módulo es la puerta principal para leer sesiones, jugadores, turnos y mezcla de fuentes dentro de la muestra visible.",
          Database,
          [
            "Sirve para separar sesiones vacías de sesiones con interacción real.",
            "También ayuda a leer mazos activos y comportamiento por partida.",
          ],
          { href: "/games", ctaLabel: "Ver partidas", badge: "Muestra" },
        ),
        buildStep(
          "syncs",
          "Sincronizaciones",
          "Acá podés revisar la trazabilidad reciente, la presencia de raw y la consistencia entre captura y juego.",
          Cable,
          [
            "Es el mejor lugar para detectar ingesta incompleta o correlaciones faltantes.",
            "Complementa la lectura de Partidas sin mezclarla con operación de hardware.",
          ],
          { href: "/syncs", ctaLabel: "Ver syncs", badge: "Trazabilidad" },
        ),
      ]);
    case "family":
      return finalizeTutorialSteps(user, [
        buildStep(
          "welcome",
          `Bienvenido, ${name}`,
          "La vista family está hecha para seguimiento simple y amable. Evita superficies técnicas y se concentra en lo que realmente podés ver y usar.",
          Sparkles,
          [
            "Tu dashboard resume dispositivos, partidas, usuarios y syncs visibles.",
            "Todo el lenguaje del tutorial está pensado para no cargar la experiencia con términos internos.",
          ],
          { href: "/dashboard", ctaLabel: "Abrir home family", badge: "Vista family" },
        ),
        buildStep(
          "devices",
          "Dispositivos y partidas",
          "Estos dos módulos concentran el seguimiento más importante: qué hardware ves y qué actividad reciente hubo.",
          Smartphone,
          [
            "Dispositivos: equipos dentro de tu alcance visible.",
            "Partidas: sesiones recientes y lectura simple del uso.",
          ],
          { href: "/devices", ctaLabel: "Ver dispositivos", badge: "Seguimiento" },
        ),
        buildStep(
          "people",
          "Usuarios y sincronizaciones",
          "El cierre del circuito está en usuarios visibles y syncs recientes, sin necesidad de entrar a ACL, salud ni configuración global.",
          Users,
          [
            "Usuarios: personas visibles para tu cuenta.",
            "Syncs: actividad reciente vinculada a tu alcance.",
          ],
          { href: "/users", ctaLabel: "Ver usuarios", badge: "Contexto" },
        ),
      ]);
    case "teacher":
    default:
      return finalizeTutorialSteps(user, [
        buildStep(
          "welcome",
          `Bienvenido, ${name}`,
          "La experiencia docente está pensada para operar el día a día: ver rápido el estado del aula, entrar a partidas y revisar parque o syncs sin dar vueltas.",
          Sparkles,
          [
            "La home ya actúa como centro operativo y no solo como portada visual.",
            "Los módulos visibles responden a lo que una cuenta docente usa de verdad.",
          ],
          { href: "/dashboard", ctaLabel: "Abrir home docente", badge: "Vista docente" },
        ),
        buildStep(
          "games",
          "Partidas",
          "Entrá acá para revisar sesiones, mazos activos, jugadores y señales de uso real en el aula.",
          BookOpen,
          [
            "Es el mejor lugar para seguir actividad pedagógica visible.",
            "También ayuda a detectar sesiones sin turnos o movimientos recientes.",
          ],
          { href: "/games", ctaLabel: "Ver partidas", badge: "Aula" },
        ),
        buildStep(
          "devices",
          "Dispositivos",
          "Este módulo te sirve para chequear el parque visible antes o durante una jornada de uso.",
          Smartphone,
          [
            "Permite detectar hardware sin status o con contexto operativo incompleto.",
            "Es la puerta natural cuando querés ordenar la parte física del aula.",
          ],
          { href: "/devices", ctaLabel: "Revisar dispositivos", badge: "Parque" },
        ),
        buildStep(
          "syncs",
          "Sincronizaciones",
          "Acá podés validar la captura reciente y cerrar el seguimiento entre actividad visible y datos sincronizados.",
          Cable,
          [
            "Útil para detectar trazabilidad incompleta.",
            "Complementa la lectura de partidas sin meterte en capas más técnicas de plataforma.",
          ],
          { href: "/syncs", ctaLabel: "Ver syncs", badge: "Seguimiento" },
        ),
      ]);
  }
}

export function WebOnboardingTour({
  user,
  onSkip,
  onComplete,
}: {
  user: AuthUser | null;
  onSkip: () => void;
  onComplete: () => void;
}) {
  const steps = useMemo(() => getWebTutorialSteps(user), [user]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  if (steps.length === 0) return null;

  const currentStep = steps[currentStepIndex];
  const Icon = currentStep.icon;
  const isLast = currentStepIndex === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-950/42 p-2 backdrop-blur-[6px] sm:p-4 lg:items-center lg:p-6 2xl:p-8">
      <div className="pointer-events-auto my-auto flex w-full max-w-[1360px] flex-col overflow-hidden rounded-[32px] border border-slate-200/80 bg-background shadow-[0_36px_96px_rgba(15,23,42,0.24)] max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] lg:max-h-[calc(100dvh-2.5rem)] 2xl:max-w-[1500px]">
        <div className="shrink-0 bg-[linear-gradient(135deg,#1f2a37_0%,#31465e_55%,#3f5a74_100%)] px-5 py-4 text-white sm:px-7 sm:py-5 lg:px-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-white/14 text-white hover:bg-white/14">Tutorial inicial</Badge>
                {currentStep.badge ? <Badge className="bg-white/14 text-white hover:bg-white/14">{currentStep.badge}</Badge> : null}
                <Badge className="bg-white/10 text-white/90 hover:bg-white/10">Adaptado a tu acceso</Badge>
              </div>
              <h2 className="mt-3 text-[1.95rem] font-semibold leading-none tracking-tight sm:text-[2.35rem] lg:text-[2.8rem] 2xl:text-[3rem]">{currentStep.title}</h2>
              <p className="mt-2 max-w-5xl text-sm leading-6 text-white/78 sm:text-[15px] sm:leading-7 lg:text-[1rem]">{currentStep.description}</p>
            </div>
            <button
              type="button"
              onClick={onSkip}
              className="inline-flex rounded-full border border-white/15 bg-white/10 p-3 text-white transition hover:bg-white/16"
              aria-label="Cerrar tutorial"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="mt-5 flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-[22px] bg-white/12 sm:size-16">
              <Icon className="size-6 sm:size-7" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.22em] text-white/60">
                <span>Paso {currentStepIndex + 1}</span>
                <span>{steps.length} pasos</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/12">
                <div
                  className="h-full rounded-full bg-white transition-all duration-300"
                  style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 content-start gap-5 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6 lg:px-8 xl:grid-cols-[minmax(0,1.65fr)_320px] xl:gap-6">
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">Qué te muestra esta parte</p>
            <ul className="mt-4 space-y-2.5">
              {currentStep.bullets.map((bullet) => (
                <li key={bullet} className="flex gap-3 rounded-[22px] bg-white/88 p-4 text-[15px] leading-6 text-muted-foreground shadow-[0_12px_28px_rgba(31,42,55,0.06)]">
                  <span className="mt-2 size-2.5 rounded-full bg-primary" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[28px] border border-border/70 bg-secondary/45 p-5 xl:sticky xl:top-0 xl:self-start">
            <p className="text-base font-semibold text-foreground">Cómo moverte</p>
            <div className="mt-3 space-y-3 text-[15px] leading-6 text-muted-foreground">
              <p>La navegación principal vive en la barra lateral y ya está recortada a los permisos efectivos de esta sesión.</p>
              <p>Si cerrás este tutorial, después podés volver a abrirlo desde el panel lateral con el botón <span className="font-medium text-foreground">“Ver tutorial”</span>.</p>
              <p>Este recorrido cambia según tu rol y solo te muestra superficies que realmente están visibles para tu cuenta.</p>
            </div>

            {currentStep.href ? (
              <Link href={currentStep.href} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_16px_30px_rgba(71,185,239,0.26)] transition hover:-translate-y-0.5 hover:bg-primary/90">
                {currentStep.ctaLabel || "Abrir módulo"}
                <ArrowRight className="size-4" />
              </Link>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 border-t border-border/60 bg-white/92 px-5 py-4 shadow-[0_-18px_32px_rgba(31,42,55,0.08)] backdrop-blur supports-[backdrop-filter]:bg-white/82 sm:px-7 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              {steps.map((step, index) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setCurrentStepIndex(index)}
                  className={`h-2.5 rounded-full transition-all ${index === currentStepIndex ? "w-10 bg-primary" : "w-2.5 bg-border hover:bg-primary/40"}`}
                  aria-label={`Ir al paso ${index + 1}`}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Paso <span className="font-medium text-foreground">{currentStepIndex + 1}</span> de <span className="font-medium text-foreground">{steps.length}</span>
            </p>
          </div>

          <div className="mt-3 flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
            <Button type="button" variant="ghost" onClick={onSkip} className="w-full sm:w-auto">Omitir</Button>
            {currentStepIndex > 0 ? (
              <Button type="button" variant="outline" onClick={() => setCurrentStepIndex((index) => index - 1)} className="w-full sm:w-auto">Atrás</Button>
            ) : null}
            {isLast ? (
              <Button type="button" onClick={onComplete} className="w-full sm:w-auto">Empezar a usar MagicBox</Button>
            ) : (
              <Button type="button" onClick={() => setCurrentStepIndex((index) => Math.min(index + 1, steps.length - 1))} className="w-full sm:w-auto">
                Siguiente
                <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
