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
import { useLanguage, type AppLanguage } from "@/features/i18n/i18n-context";

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

const tutorialChromeMessages: Record<AppLanguage, {
  initial: string;
  adapted: string;
  close: string;
  step: (value: number) => string;
  totalSteps: (value: number) => string;
  whatYouSee: string;
  howToNavigate: string;
  nav1: string;
  nav2: string;
  navButton: string;
  nav3: string;
  openModule: string;
  goToStep: (value: number) => string;
  stepOf: (current: number, total: number) => string;
  skip: string;
  back: string;
  start: string;
  next: string;
}> = {
  es: {
    initial: "Tutorial inicial",
    adapted: "Adaptado a tu acceso",
    close: "Cerrar tutorial",
    step: (value) => `Paso ${value}`,
    totalSteps: (value) => `${value} pasos`,
    whatYouSee: "Qué te muestra esta parte",
    howToNavigate: "Cómo moverte",
    nav1: "La navegación principal vive en la barra lateral y ya está recortada a los permisos efectivos de esta sesión.",
    nav2: "Si cerrás este tutorial, después podés volver a abrirlo desde el panel lateral con el botón",
    navButton: "Ver tutorial",
    nav3: "Este recorrido cambia según tu rol y solo te muestra superficies que realmente están visibles para tu cuenta.",
    openModule: "Abrir módulo",
    goToStep: (value) => `Ir al paso ${value}`,
    stepOf: (current, total) => `Paso ${current} de ${total}`,
    skip: "Omitir",
    back: "Atrás",
    start: "Empezar a usar MagicBox",
    next: "Siguiente",
  },
  en: {
    initial: "Getting started",
    adapted: "Adapted to your access",
    close: "Close tutorial",
    step: (value) => `Step ${value}`,
    totalSteps: (value) => `${value} steps`,
    whatYouSee: "What this part shows you",
    howToNavigate: "How to move around",
    nav1: "Main navigation lives in the sidebar and is already trimmed to this session's effective permissions.",
    nav2: "If you close this tutorial, you can open it again later from the side panel with the",
    navButton: "View tutorial",
    nav3: "This tour changes with your role and only shows surfaces that are actually visible to your account.",
    openModule: "Open module",
    goToStep: (value) => `Go to step ${value}`,
    stepOf: (current, total) => `Step ${current} of ${total}`,
    skip: "Skip",
    back: "Back",
    start: "Start using MagicBox",
    next: "Next",
  },
  pt: {
    initial: "Tutorial inicial",
    adapted: "Adaptado ao seu acesso",
    close: "Fechar tutorial",
    step: (value) => `Passo ${value}`,
    totalSteps: (value) => `${value} passos`,
    whatYouSee: "O que esta parte mostra",
    howToNavigate: "Como navegar",
    nav1: "A navegação principal fica na barra lateral e já está recortada para as permissões efetivas desta sessão.",
    nav2: "Se você fechar este tutorial, depois poderá abri-lo de novo pelo painel lateral com o botão",
    navButton: "Ver tutorial",
    nav3: "Este percurso muda conforme o seu papel e só mostra superfícies realmente visíveis para a sua conta.",
    openModule: "Abrir módulo",
    goToStep: (value) => `Ir para o passo ${value}`,
    stepOf: (current, total) => `Passo ${current} de ${total}`,
    skip: "Pular",
    back: "Voltar",
    start: "Começar a usar o MagicBox",
    next: "Próximo",
  },
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

export function getWebTutorialSteps(user: AuthUser | null, language: AppLanguage = "es"): TutorialStep[] {
  const name = userName(user);
  const role = getPrimaryRole(user);
  const tr = (es: string, en: string, pt: string) => (language === "en" ? en : language === "pt" ? pt : es);

  switch (role) {
    case "admin":
      return finalizeTutorialSteps(user, [
        buildStep(
          "welcome",
          tr(`Bienvenido, ${name}`, `Welcome, ${name}`, `Bem-vindo, ${name}`),
          tr(
            "Esta cuenta entra al dashboard con visión global de plataforma. La idea del tutorial es ubicar rápido dónde está cada frente operativo sin obligarte a recorrer todo a ciegas.",
            "This account enters the dashboard with a platform-wide view. The goal of the tutorial is to quickly show where each operational front lives without forcing you to explore blindly.",
            "Esta conta entra no dashboard com visão global da plataforma. A ideia do tutorial é localizar rápido cada frente operacional sem obrigar você a explorar tudo no escuro.",
          ),
          Sparkles,
          [
            tr("La home resume usuarios, instituciones, dispositivos, syncs, partidas y salud técnica.", "The home view summarizes users, institutions, devices, syncs, games, and technical health.", "A home resume usuários, instituições, dispositivos, syncs, partidas e saúde técnica."),
            tr("La navegación lateral ya está recortada por rol, así que no hace falta adivinar qué módulo corresponde.", "Side navigation is already trimmed by role, so you do not need to guess which module fits.", "A navegação lateral já está recortada por papel, então não é preciso adivinhar qual módulo corresponde."),
          ],
          { href: "/dashboard", ctaLabel: tr("Abrir dashboard", "Open dashboard", "Abrir dashboard"), badge: tr("Vista plataforma", "Platform view", "Visão plataforma") },
        ),
        buildStep(
          "governance",
          tr("Usuarios, permisos e instituciones", "Users, permissions, and institutions", "Usuários, permissões e instituições"),
          tr("Este bloque concentra gobernanza: altas, revisión de ACL, bundles de permisos y lectura institucional operativa.", "This block concentrates governance: onboarding, ACL review, permission bundles, and operational institutional reading.", "Este bloco concentra governança: altas, revisão de ACL, bundles de permissões e leitura institucional operacional."),
          Users,
          [
            tr("Usuarios: padrón, roles y revisión del alcance efectivo.", "Users: roster, roles, and review of effective scope.", "Usuários: cadastro, papéis e revisão do alcance efetivo."),
            tr("Permisos: contrato ACL y señales de sesión incompleta.", "Permissions: ACL contract and signs of an incomplete session.", "Permissões: contrato ACL e sinais de sessão incompleta."),
            tr("Instituciones: estado operativo, datos base y vínculo con usuarios/dispositivos.", "Institutions: operational state, base data, and link with users/devices.", "Instituições: estado operacional, dados-base e vínculo com usuários/dispositivos."),
          ],
          { href: "/users", ctaLabel: tr("Ir a usuarios", "Go to users", "Ir para usuários"), badge: tr("Gobernanza", "Governance", "Governança") },
        ),
        buildStep(
          "operations",
          tr("Parque, juego y sincronización", "Fleet, gameplay, and synchronization", "Parque, jogo e sincronização"),
          tr("La operación diaria vive en dispositivos, partidas y syncs. Desde ahí podés detectar parque sin owner, sesiones sin turnos o trazabilidad incompleta.", "Daily operation lives in devices, games, and syncs. From there you can detect fleet without owner, sessions without turns, or incomplete traceability.", "A operação diária vive em dispositivos, partidas e syncs. A partir daí você pode detectar parque sem owner, sessões sem turnos ou rastreabilidade incompleta."),
          Smartphone,
          [
            tr("Dispositivos: hardware visible, scope y owner.", "Devices: visible hardware, scope, and owner.", "Dispositivos: hardware visível, escopo e owner."),
            tr("Partidas: sesiones, jugadores, turnos y actividad real.", "Games: sessions, players, turns, and real activity.", "Partidas: sessões, jogadores, turnos e atividade real."),
            tr("Syncs: captura reciente y raw disponible para seguimiento.", "Syncs: recent capture and raw data available for follow-up.", "Syncs: captura recente e raw disponível para acompanhamento."),
          ],
          { href: "/devices", ctaLabel: tr("Ver dispositivos", "View devices", "Ver dispositivos"), badge: tr("Operación", "Operations", "Operação") },
        ),
        buildStep(
          "technical",
          tr("Salud y configuración", "Health and settings", "Saúde e configuração"),
          tr("Cuando necesites mirar runtime efectivo o estado técnico del sistema, la ruta está en Salud y Configuración.", "When you need to inspect effective runtime or the technical state of the system, the path is Health and Settings.", "Quando você precisar olhar o runtime efetivo ou o estado técnico do sistema, o caminho está em Saúde e Configuração."),
          HeartPulse,
          [
            tr("Salud expone checks, versión y señales del backend.", "Health exposes checks, version, and backend signals.", "Saúde expõe checks, versão e sinais do backend."),
            tr("Configuración resume runtime, catálogos y superficies administrativas.", "Settings summarizes runtime, catalogs, and administrative surfaces.", "Configuração resume runtime, catálogos e superfícies administrativas."),
          ],
          { href: "/health", ctaLabel: tr("Revisar salud", "Review health", "Revisar saúde"), badge: tr("Técnico", "Technical", "Técnico") },
        ),
      ]);
    case "government-viewer":
      return finalizeTutorialSteps(user, [
        buildStep(
          "welcome",
          tr(`Bienvenido, ${name}`, `Welcome, ${name}`, `Bem-vindo, ${name}`),
          tr("Esta vista está pensada para seguimiento territorial y lectura ejecutiva. No intenta exponer operación interna que no aporte a este perfil.", "This view is designed for territorial monitoring and executive reading. It does not try to expose internal operations that do not add value to this profile.", "Esta visão foi pensada para acompanhamento territorial e leitura executiva. Ela não tenta expor operação interna que não agregue valor a este perfil."),
          Sparkles,
          [
            tr("La home ya concentra filtros, tendencias y score territorial compuesto.", "The home view already concentrates filters, trends, and the composite territorial score.", "A home já concentra filtros, tendências e score territorial composto."),
            tr("Los módulos visibles priorizan síntesis, alertas y drilldown geográfico.", "Visible modules prioritize synthesis, alerts, and geographic drilldown.", "Os módulos visíveis priorizam síntese, alertas e drilldown geográfico."),
          ],
          { href: "/dashboard", ctaLabel: tr("Abrir home ejecutiva", "Open executive home", "Abrir home executiva"), badge: tr("Vista gobierno", "Government view", "Visão governo") },
        ),
        buildStep(
          "alerts",
          tr("Alertas territoriales", "Territorial alerts", "Alertas territoriais"),
          tr("Acá aparecen focos críticos y territorios que merecen revisión antes de entrar al detalle completo.", "This is where critical hotspots and territories that deserve review appear before you enter full detail.", "Aqui aparecem focos críticos e territórios que merecem revisão antes de entrar no detalhe completo."),
          ShieldAlert,
          [
            tr("Sirve para detectar caídas de actividad, zonas sin turnos o señales de riesgo.", "It helps detect activity drops, zones without turns, or risk signals.", "Serve para detectar quedas de atividade, zonas sem turnos ou sinais de risco."),
            tr("La lectura está organizada para priorizar rápidamente dónde mirar.", "The reading is organized to quickly prioritize where to look.", "A leitura está organizada para priorizar rapidamente onde olhar."),
          ],
          { href: "/territorial-alerts", ctaLabel: tr("Ver alertas", "View alerts", "Ver alertas"), badge: tr("Prioridad", "Priority", "Prioridade") },
        ),
        buildStep(
          "map",
          tr("Territorios e instituciones", "Territories and institutions", "Territórios e instituições"),
          tr("Este módulo baja del agregado general al territorio concreto para ver instituciones, cohortes y actividad visible.", "This module moves from the general aggregate to the concrete territory to see institutions, cohorts, and visible activity.", "Este módulo desce do agregado geral ao território concreto para ver instituições, coortes e atividade visível."),
          Map,
          [
            tr("Permite usar el drilldown país → estado → ciudad.", "It lets you use country → state → city drilldown.", "Permite usar o drilldown país → estado → cidade."),
            tr("Funciona bien como segundo paso después de detectar una alerta o un score bajo.", "It works well as a second step after detecting an alert or a low score.", "Funciona bem como segundo passo depois de detectar um alerta ou um score baixo."),
          ],
          { href: "/territorial-overview", ctaLabel: tr("Ver territorios", "View territories", "Ver territórios"), badge: "Drilldown" },
        ),
      ]);
    case "institution-admin":
    case "director":
      return finalizeTutorialSteps(user, [
        buildStep(
          "welcome",
          tr(`Bienvenido, ${name}`, `Welcome, ${name}`, `Bem-vindo, ${name}`),
          tr("Tu experiencia está recortada al alcance institucional. La home ya prioriza usuarios, dispositivos, perfiles y actividad visible sin mezclarlo con operación global.", "Your experience is trimmed to institutional scope. The home view already prioritizes users, devices, profiles, and visible activity without mixing in global operations.", "Sua experiência está recortada ao alcance institucional. A home já prioriza usuários, dispositivos, perfis e atividade visível sem misturar com operação global."),
          Sparkles,
          [
            tr("El dashboard institucional sirve para ordenar el día y detectar huecos de operación.", "The institutional dashboard helps organize the day and detect operational gaps.", "O dashboard institucional ajuda a organizar o dia e detectar lacunas operacionais."),
            tr("Los accesos visibles respetan el ACL efectivo de tu sesión.", "Visible access points respect your session's effective ACL.", "Os acessos visíveis respeitam o ACL efetivo da sua sessão."),
          ],
          { href: "/dashboard", ctaLabel: tr("Abrir home institucional", "Open institutional home", "Abrir home institucional"), badge: tr("Vista institucional", "Institution view", "Visão institucional") },
        ),
        buildStep(
          "people",
          tr("Usuarios e instituciones", "Users and institutions", "Usuários e instituições"),
          tr("Desde acá podés revisar padrón, alcance institucional y consistencia del contexto visible para tu cuenta.", "From here you can review roster, institutional scope, and the consistency of the visible context for your account.", "Daqui você pode revisar cadastro, alcance institucional e consistência do contexto visível para a sua conta."),
          Building2,
          [
            role === "institution-admin"
              ? tr("Usuarios te deja revisar altas, roles y lecturas operativas del padrón visible.", "Users lets you review onboarding, roles, and operational readings of the visible roster.", "Usuários permite revisar altas, papéis e leituras operacionais do cadastro visível.")
              : tr("Instituciones resume el contexto operativo sin exponerte superficies de superadmin.", "Institutions summarizes the operational context without exposing superadmin surfaces.", "Instituições resume o contexto operacional sem expor superfícies de superadmin."),
            tr("El objetivo es que la gobernanza cotidiana quede a mano, no escondida.", "The goal is to keep day-to-day governance close at hand, not hidden.", "O objetivo é deixar a governança cotidiana à mão, não escondida."),
          ],
          { href: role === "institution-admin" ? "/users" : "/institutions", ctaLabel: role === "institution-admin" ? tr("Ir a usuarios", "Go to users", "Ir para usuários") : tr("Ver instituciones", "View institutions", "Ver instituições"), badge: tr("Cobertura", "Coverage", "Cobertura") },
        ),
        buildStep(
          "operation",
          tr("Dispositivos, partidas y syncs", "Devices, games, and syncs", "Dispositivos, partidas e syncs"),
          tr("La operación visible del uso real vive en estos módulos. Es el mejor lugar para revisar parque, actividad de juego y trazabilidad reciente.", "Visible real-use operations live in these modules. It is the best place to review the fleet, gameplay activity, and recent traceability.", "A operação visível do uso real vive nestes módulos. É o melhor lugar para revisar parque, atividade de jogo e rastreabilidade recente."),
          Smartphone,
          [
            tr("Dispositivos: status, owner y alcance visible.", "Devices: status, owner, and visible scope.", "Dispositivos: status, owner e alcance visível."),
            tr("Partidas y syncs: lectura de actividad y consistencia de captura.", "Games and syncs: activity reading and capture consistency.", "Partidas e syncs: leitura de atividade e consistência da captura."),
          ],
          { href: "/devices", ctaLabel: tr("Ver dispositivos", "View devices", "Ver dispositivos"), badge: tr("Operación", "Operations", "Operação") },
        ),
        buildStep(
          "profiles",
          role === "institution-admin" ? tr("Perfiles y permisos", "Profiles and permissions", "Perfis e permissões") : tr("Perfiles visibles", "Visible profiles", "Perfis visíveis"),
          role === "institution-admin"
            ? tr("Perfiles te ayuda a revisar bindings y sesiones. Si tu ACL llega completa, Permisos también queda disponible para validar el contrato institucional.", "Profiles helps you review bindings and sessions. If your ACL arrives complete, Permissions also becomes available to validate the institutional contract.", "Perfis ajuda a revisar bindings e sessões. Se o seu ACL chegar completo, Permissões também fica disponível para validar o contrato institucional.")
            : tr("Perfiles resume bindings y sesiones visibles, útil para cerrar el circuito entre usuarios, juego y dispositivos.", "Profiles summarizes visible bindings and sessions, useful to close the loop between users, gameplay, and devices.", "Perfis resume bindings e sessões visíveis, útil para fechar o circuito entre usuários, jogo e dispositivos."),
          role === "institution-admin" ? KeyRound : UserRound,
          role === "institution-admin"
            ? [
                tr("Perfiles: bindings activos, sesiones y alcance real.", "Profiles: active bindings, sessions, and real scope.", "Perfis: bindings ativos, sessões e alcance real."),
                tr("Permisos: lectura del contrato ACL cuando la sesión lo habilita.", "Permissions: read the ACL contract when the session enables it.", "Permissões: leitura do contrato ACL quando a sessão habilita."),
              ]
            : [tr("Perfiles conecta la lectura de personas con el uso real visible en la institución.", "Profiles connects people reading with the visible real use in the institution.", "Perfis conecta a leitura de pessoas com o uso real visível na instituição.")],
          { href: "/profiles", ctaLabel: tr("Ver perfiles", "View profiles", "Ver perfis"), badge: tr("Seguimiento", "Follow-up", "Acompanhamento") },
        ),
      ]);
    case "researcher":
      return finalizeTutorialSteps(user, [
        buildStep(
          "welcome",
          tr(`Bienvenido, ${name}`, `Welcome, ${name}`, `Bem-vindo, ${name}`),
          tr("Esta experiencia prioriza evidencia visible, consistencia de muestra y lectura rápida de datos útiles para investigación.", "This experience prioritizes visible evidence, sample consistency, and quick reading of useful research data.", "Esta experiência prioriza evidência visível, consistência da amostra e leitura rápida de dados úteis para pesquisa."),
          Sparkles,
          [
            tr("La home researcher resume cobertura, turnos, mazos activos y señales tempranas de captura.", "The researcher home view summarizes coverage, turns, active decks, and early capture signals.", "A home researcher resume cobertura, turnos, baralhos ativos e sinais iniciais de captura."),
            tr("La navegación está enfocada en pocas superficies para no meter ruido operativo.", "Navigation is focused on a few surfaces to avoid operational noise.", "A navegação está focada em poucas superfícies para evitar ruído operacional."),
          ],
          { href: "/dashboard", ctaLabel: tr("Abrir home researcher", "Open researcher home", "Abrir home researcher"), badge: tr("Vista investigación", "Research view", "Visão pesquisa") },
        ),
        buildStep(
          "games",
          tr("Partidas", "Games", "Partidas"),
          tr("Este módulo es la puerta principal para leer sesiones, jugadores, turnos y mezcla de fuentes dentro de la muestra visible.", "This module is the main entry point to read sessions, players, turns, and source mix inside the visible sample.", "Este módulo é a porta principal para ler sessões, jogadores, turnos e mistura de fontes dentro da amostra visível."),
          Database,
          [
            tr("Sirve para separar sesiones vacías de sesiones con interacción real.", "It helps separate empty sessions from sessions with real interaction.", "Serve para separar sessões vazias de sessões com interação real."),
            tr("También ayuda a leer mazos activos y comportamiento por partida.", "It also helps read active decks and behavior per game.", "Também ajuda a ler baralhos ativos e comportamento por partida."),
          ],
          { href: "/games", ctaLabel: tr("Ver partidas", "View games", "Ver partidas"), badge: tr("Muestra", "Sample", "Amostra") },
        ),
        buildStep(
          "syncs",
          tr("Sincronizaciones", "Syncs", "Sincronizações"),
          tr("Acá podés revisar la trazabilidad reciente, la presencia de raw y la consistencia entre captura y juego.", "Here you can review recent traceability, the presence of raw data, and the consistency between capture and gameplay.", "Aqui você pode revisar a rastreabilidade recente, a presença de raw e a consistência entre captura e jogo."),
          Cable,
          [
            tr("Es el mejor lugar para detectar ingesta incompleta o correlaciones faltantes.", "It is the best place to detect incomplete ingestion or missing correlations.", "É o melhor lugar para detectar ingestão incompleta ou correlações ausentes."),
            tr("Complementa la lectura de Partidas sin mezclarla con operación de hardware.", "It complements the reading of Games without mixing it with hardware operations.", "Complementa a leitura de Partidas sem misturá-la com operação de hardware."),
          ],
          { href: "/syncs", ctaLabel: tr("Ver syncs", "View syncs", "Ver syncs"), badge: tr("Trazabilidad", "Traceability", "Rastreabilidade") },
        ),
      ]);
    case "family":
      return finalizeTutorialSteps(user, [
        buildStep(
          "welcome",
          tr(`Bienvenido, ${name}`, `Welcome, ${name}`, `Bem-vindo, ${name}`),
          tr("La vista family está hecha para seguimiento simple y amable. Evita superficies técnicas y se concentra en lo que realmente podés ver y usar.", "The family view is designed for simple, friendly follow-up. It avoids technical surfaces and focuses on what you can really see and use.", "A visão family foi feita para um acompanhamento simples e amigável. Evita superfícies técnicas e se concentra no que você realmente pode ver e usar."),
          Sparkles,
          [
            tr("Tu dashboard resume dispositivos, partidas, usuarios y syncs visibles.", "Your dashboard summarizes visible devices, games, users, and syncs.", "Seu dashboard resume dispositivos, partidas, usuários e syncs visíveis."),
            tr("Todo el lenguaje del tutorial está pensado para no cargar la experiencia con términos internos.", "All tutorial wording is designed to avoid loading the experience with internal terms.", "Toda a linguagem do tutorial foi pensada para não carregar a experiência com termos internos."),
          ],
          { href: "/dashboard", ctaLabel: tr("Abrir home family", "Open family home", "Abrir home family"), badge: tr("Vista family", "Family view", "Visão family") },
        ),
        buildStep(
          "devices",
          tr("Dispositivos y partidas", "Devices and games", "Dispositivos e partidas"),
          tr("Estos dos módulos concentran el seguimiento más importante: qué hardware ves y qué actividad reciente hubo.", "These two modules concentrate the most important follow-up: what hardware you see and what recent activity happened.", "Estes dois módulos concentram o acompanhamento mais importante: que hardware você vê e que atividade recente houve."),
          Smartphone,
          [
            tr("Dispositivos: equipos dentro de tu alcance visible.", "Devices: equipment within your visible scope.", "Dispositivos: equipamentos dentro do seu alcance visível."),
            tr("Partidas: sesiones recientes y lectura simple del uso.", "Games: recent sessions and a simple reading of usage.", "Partidas: sessões recentes e leitura simples do uso."),
          ],
          { href: "/devices", ctaLabel: tr("Ver dispositivos", "View devices", "Ver dispositivos"), badge: tr("Seguimiento", "Follow-up", "Acompanhamento") },
        ),
        buildStep(
          "people",
          tr("Usuarios y sincronizaciones", "Users and syncs", "Usuários e sincronizações"),
          tr("El cierre del circuito está en usuarios visibles y syncs recientes, sin necesidad de entrar a ACL, salud ni configuración global.", "The loop closes with visible users and recent syncs, without needing to enter ACL, health, or global settings.", "O fechamento do circuito está em usuários visíveis e syncs recentes, sem precisar entrar em ACL, saúde ou configuração global."),
          Users,
          [
            tr("Usuarios: personas visibles para tu cuenta.", "Users: people visible to your account.", "Usuários: pessoas visíveis para a sua conta."),
            tr("Syncs: actividad reciente vinculada a tu alcance.", "Syncs: recent activity linked to your scope.", "Syncs: atividade recente vinculada ao seu alcance."),
          ],
          { href: "/users", ctaLabel: tr("Ver usuarios", "View users", "Ver usuários"), badge: tr("Contexto", "Context", "Contexto") },
        ),
      ]);
    case "teacher":
    default:
      return finalizeTutorialSteps(user, [
        buildStep(
          "welcome",
          tr(`Bienvenido, ${name}`, `Welcome, ${name}`, `Bem-vindo, ${name}`),
          tr("La experiencia docente está pensada para operar el día a día: ver rápido el estado del aula, entrar a partidas y revisar parque o syncs sin dar vueltas.", "The teacher experience is designed for day-to-day operation: quickly see classroom status, jump into games, and review fleet or syncs without unnecessary steps.", "A experiência docente foi pensada para operar o dia a dia: ver rápido o estado da sala, entrar em partidas e revisar parque ou syncs sem rodeios."),
          Sparkles,
          [
            tr("La home ya actúa como centro operativo y no solo como portada visual.", "The home view already acts as an operational center and not just a visual front page.", "A home já atua como centro operacional e não apenas como capa visual."),
            tr("Los módulos visibles responden a lo que una cuenta docente usa de verdad.", "Visible modules respond to what a teacher account actually uses.", "Os módulos visíveis respondem ao que uma conta docente realmente usa."),
          ],
          { href: "/dashboard", ctaLabel: tr("Abrir home docente", "Open teacher home", "Abrir home docente"), badge: tr("Vista docente", "Teacher view", "Visão docente") },
        ),
        buildStep(
          "games",
          tr("Partidas", "Games", "Partidas"),
          tr("Entrá acá para revisar sesiones, mazos activos, jugadores y señales de uso real en el aula.", "Come here to review sessions, active decks, players, and signs of real classroom usage.", "Entre aqui para revisar sessões, baralhos ativos, jogadores e sinais de uso real na sala."),
          BookOpen,
          [
            tr("Es el mejor lugar para seguir actividad pedagógica visible.", "It is the best place to follow visible pedagogical activity.", "É o melhor lugar para acompanhar a atividade pedagógica visível."),
            tr("También ayuda a detectar sesiones sin turnos o movimientos recientes.", "It also helps detect sessions without turns or recent movement.", "Também ajuda a detectar sessões sem turnos ou movimentos recentes."),
          ],
          { href: "/games", ctaLabel: tr("Ver partidas", "View games", "Ver partidas"), badge: tr("Aula", "Classroom", "Sala") },
        ),
        buildStep(
          "devices",
          tr("Dispositivos", "Devices", "Dispositivos"),
          tr("Este módulo te sirve para chequear el parque visible antes o durante una jornada de uso.", "This module helps you check the visible fleet before or during a day of use.", "Este módulo ajuda você a checar o parque visível antes ou durante uma jornada de uso."),
          Smartphone,
          [
            tr("Permite detectar hardware sin status o con contexto operativo incompleto.", "It lets you detect hardware without status or with incomplete operational context.", "Permite detectar hardware sem status ou com contexto operacional incompleto."),
            tr("Es la puerta natural cuando querés ordenar la parte física del aula.", "It is the natural entry point when you want to organize the physical side of the classroom.", "É a porta natural quando você quer organizar a parte física da sala."),
          ],
          { href: "/devices", ctaLabel: tr("Revisar dispositivos", "Review devices", "Revisar dispositivos"), badge: tr("Parque", "Fleet", "Parque") },
        ),
        buildStep(
          "syncs",
          tr("Sincronizaciones", "Syncs", "Sincronizações"),
          tr("Acá podés validar la captura reciente y cerrar el seguimiento entre actividad visible y datos sincronizados.", "Here you can validate recent capture and close the loop between visible activity and synchronized data.", "Aqui você pode validar a captura recente e fechar o acompanhamento entre atividade visível e dados sincronizados."),
          Cable,
          [
            tr("Útil para detectar trazabilidad incompleta.", "Useful for detecting incomplete traceability.", "Útil para detectar rastreabilidade incompleta."),
            tr("Complementa la lectura de partidas sin meterte en capas más técnicas de plataforma.", "It complements the reading of games without pushing you into more technical platform layers.", "Complementa a leitura de partidas sem levar você para camadas mais técnicas da plataforma."),
          ],
          { href: "/syncs", ctaLabel: tr("Ver syncs", "View syncs", "Ver syncs"), badge: tr("Seguimiento", "Follow-up", "Acompanhamento") },
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
  const { language } = useLanguage();
  const chrome = tutorialChromeMessages[language];
  const steps = useMemo(() => getWebTutorialSteps(user, language), [language, user]);
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
                <Badge className="bg-white/14 text-white hover:bg-white/14">{chrome.initial}</Badge>
                {currentStep.badge ? <Badge className="bg-white/14 text-white hover:bg-white/14">{currentStep.badge}</Badge> : null}
                <Badge className="bg-white/10 text-white/90 hover:bg-white/10">{chrome.adapted}</Badge>
              </div>
              <h2 className="mt-3 text-[1.95rem] font-semibold leading-none tracking-tight sm:text-[2.35rem] lg:text-[2.8rem] 2xl:text-[3rem]">{currentStep.title}</h2>
              <p className="mt-2 max-w-5xl text-sm leading-6 text-white/78 sm:text-[15px] sm:leading-7 lg:text-[1rem]">{currentStep.description}</p>
            </div>
            <button
              type="button"
              onClick={onSkip}
              className="inline-flex rounded-full border border-white/15 bg-white/10 p-3 text-white transition hover:bg-white/16"
              aria-label={chrome.close}
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
                <span>{chrome.step(currentStepIndex + 1)}</span>
                <span>{chrome.totalSteps(steps.length)}</span>
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
            <p className="text-base font-semibold text-foreground">{chrome.whatYouSee}</p>
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
            <p className="text-base font-semibold text-foreground">{chrome.howToNavigate}</p>
            <div className="mt-3 space-y-3 text-[15px] leading-6 text-muted-foreground">
              <p>{chrome.nav1}</p>
              <p>{chrome.nav2} <span className="font-medium text-foreground">“{chrome.navButton}”</span>.</p>
              <p>{chrome.nav3}</p>
            </div>

            {currentStep.href ? (
              <Link href={currentStep.href} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3.5 text-sm font-semibold text-primary-foreground shadow-[0_16px_30px_rgba(71,185,239,0.26)] transition hover:-translate-y-0.5 hover:bg-primary/90">
                {currentStep.ctaLabel || chrome.openModule}
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
                  aria-label={chrome.goToStep(index + 1)}
                />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">{chrome.stepOf(currentStepIndex + 1, steps.length)}</p>
          </div>

          <div className="mt-3 flex flex-col-reverse gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3">
            <Button type="button" variant="ghost" onClick={onSkip} className="w-full sm:w-auto">{chrome.skip}</Button>
            {currentStepIndex > 0 ? (
              <Button type="button" variant="outline" onClick={() => setCurrentStepIndex((index) => index - 1)} className="w-full sm:w-auto">{chrome.back}</Button>
            ) : null}
            {isLast ? (
              <Button type="button" onClick={onComplete} className="w-full sm:w-auto">{chrome.start}</Button>
            ) : (
              <Button type="button" onClick={() => setCurrentStepIndex((index) => Math.min(index + 1, steps.length - 1))} className="w-full sm:w-auto">
                {chrome.next}
                <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
