"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type AppLanguage = "es" | "en" | "pt";

type AppMessages = {
  common: {
    languageLabel: string;
  };
  auth: {
    pages: {
      login: { title: string; description: string; loading: string };
      register: { title: string; description: string; loading: string };
      forgotPassword: { title: string; description: string; loading: string };
      verifyOtp: { title: string; description: string; loading: string };
      resetPassword: { title: string; description: string; loading: string };
    };
    loginForm: {
      emailLabel: string;
      emailPlaceholder: string;
      passwordLabel: string;
      showPassword: string;
      hidePassword: string;
      forgotPassword: string;
      createUser: string;
      submitting: string;
      submit: string;
      validation: {
        invalidEmail: string;
        requiredPassword: string;
      };
    };
    registerForm: {
      autonomousNotice: string;
      success: string;
      firstName: string;
      lastName: string;
      email: string;
      country: string;
      phone: string;
      phoneHelp: string;
      password: string;
      confirmPassword: string;
      submitting: string;
      submit: string;
      alreadyHaveAccount: string;
      goToLogin: string;
    };
    forgotPasswordForm: {
      notice: string;
      email: string;
      submitting: string;
      submit: string;
      backToLogin: string;
      createUser: string;
    };
    verifyOtpForm: {
      notice: string;
      sentTo: string;
      fallbackEmail: string;
      submitting: string;
      submit: string;
      resend: string;
      backToLogin: string;
      changeEmail: string;
    };
    resetPasswordForm: {
      notice: string;
      createFor: string;
      fallbackAccount: string;
      newPassword: string;
      confirmPassword: string;
      submitting: string;
      submit: string;
      backToLogin: string;
      resend: string;
    };
    validation: {
      requiredField: string;
      requiredEmail: string;
      invalidEmail: string;
      requiredName: string;
      nameMinLength: string;
      nameLettersOnly: string;
      requiredPassword: string;
      passwordLength: string;
      passwordNoSpaces: string;
      passwordUppercase: string;
      passwordLowercase: string;
      passwordNumber: string;
      passwordSpecial: string;
      passwordCommon: string;
      passwordRepeats: string;
      passwordSequence: string;
      requiredPasswordConfirmation: string;
      passwordMismatch: string;
      requiredPhone: string;
      phoneLength: string;
    };
  };
  appShell: {
    sections: {
      summary: string;
      operation: string;
      governance: string;
      technical: string;
    };
    roleLabels: Record<string, string>;
    experienceMeta: Record<string, { title: string; description: string }>;
    navigation: Record<string, { label: string; summary: string }>;
    desktopTitle: string;
    desktopDescription: string;
    tutorialAvailable: string;
    tutorialDeferred: string;
    newBadge: string;
    viewTutorial: string;
    reopenTutorial: string;
    apiBase: string;
    activeScreen: string;
    tutorial: string;
    logout: string;
  };
};

const messages: Record<AppLanguage, AppMessages> = {
  es: {
    common: {
      languageLabel: "Idioma",
    },
    auth: {
      pages: {
        login: {
          title: "MagicBox",
          description: "Ingresá con tu cuenta para seguir en la web.",
          loading: "Cargando formulario...",
        },
        register: {
          title: "Crear usuario",
          description: "El alta autónoma está disponible solo para cuentas family.",
          loading: "Cargando alta...",
        },
        forgotPassword: {
          title: "Recuperar contraseña",
          description: "Te enviamos un código al correo para seguir con el restablecimiento.",
          loading: "Cargando recuperación...",
        },
        verifyOtp: {
          title: "Verificar código",
          description: "Ingresá el código de 6 dígitos que te llegó por correo.",
          loading: "Cargando verificación...",
        },
        resetPassword: {
          title: "Nueva contraseña",
          description: "Elegí una clave segura para volver a entrar.",
          loading: "Cargando formulario...",
        },
      },
      loginForm: {
        emailLabel: "Email",
        emailPlaceholder: "tu@magicbox.com",
        passwordLabel: "Contraseña",
        showPassword: "Mostrar",
        hidePassword: "Ocultar",
        forgotPassword: "¿Olvidaste tu contraseña?",
        createUser: "Crear usuario",
        submitting: "Ingresando...",
        submit: "Entrar",
        validation: {
          invalidEmail: "Ingresá un email válido",
          requiredPassword: "Ingresá tu contraseña",
        },
      },
      registerForm: {
        autonomousNotice:
          "El alta autónoma está pensada solo para cuentas family. Si necesitás otro rol, debe crearlo un administrador.",
        success: "Cuenta creada. Ya podés iniciar sesión con esos datos.",
        firstName: "Nombre",
        lastName: "Apellido",
        email: "Email",
        country: "País",
        phone: "Teléfono",
        phoneHelp: "Usamos el mismo backend y la misma base de usuarios que la app móvil.",
        password: "Contraseña",
        confirmPassword: "Confirmar contraseña",
        submitting: "Creando...",
        submit: "Crear usuario",
        alreadyHaveAccount: "Ya tengo cuenta",
        goToLogin: "Ir al login",
      },
      forgotPasswordForm: {
        notice: "Te enviamos un código al correo asociado a tu cuenta para continuar con el restablecimiento.",
        email: "Email",
        submitting: "Enviando...",
        submit: "Enviar código",
        backToLogin: "Volver al login",
        createUser: "Crear usuario",
      },
      verifyOtpForm: {
        notice: "Si no lo ves en tu bandeja, revisá spam. El código expira rápido.",
        sentTo: "Enviamos un código a:",
        fallbackEmail: "tu correo",
        submitting: "Continuando...",
        submit: "Continuar",
        resend: "Reenviar código",
        backToLogin: "Volver al login",
        changeEmail: "Cambiar email",
      },
      resetPasswordForm: {
        notice: "Elegí una nueva clave segura y no la reutilices en otros servicios.",
        createFor: "Creá una nueva contraseña para:",
        fallbackAccount: "tu cuenta",
        newPassword: "Nueva contraseña",
        confirmPassword: "Confirmar contraseña",
        submitting: "Actualizando...",
        submit: "Actualizar contraseña",
        backToLogin: "Volver al login",
        resend: "Reenviar código",
      },
      validation: {
        requiredField: "Campo requerido",
        requiredEmail: "Ingresá tu email",
        invalidEmail: "Ingresá un email válido",
        requiredName: "Ingresa tu nombre",
        nameMinLength: "El nombre debe tener al menos 2 caracteres",
        nameLettersOnly: "El nombre solo puede contener letras y espacios",
        requiredPassword: "Ingresa tu contraseña",
        passwordLength: "Debe tener entre 8 y 128 caracteres",
        passwordNoSpaces: "No puede contener espacios",
        passwordUppercase: "Debe contener al menos una mayúscula",
        passwordLowercase: "Debe contener al menos una minúscula",
        passwordNumber: "Debe contener al menos un número",
        passwordSpecial: "Debe contener al menos un carácter especial",
        passwordCommon: "La contraseña es demasiado común",
        passwordRepeats: "Evita repeticiones de caracteres",
        passwordSequence: "Evita secuencias simples",
        requiredPasswordConfirmation: "Confirma tu contraseña",
        passwordMismatch: "Las contraseñas no coinciden",
        requiredPhone: "Ingresa tu teléfono",
        phoneLength: "El teléfono debe tener entre {{min}} y {{max}} dígitos para {{country}}",
      },
    },
    appShell: {
      sections: {
        summary: "Resumen",
        operation: "Operación",
        governance: "Gobernanza",
        technical: "Técnico",
      },
      roleLabels: {
        teacher: "docente",
        director: "director",
        researcher: "investigación",
        family: "familia",
        "institution-admin": "institution admin",
        "government-viewer": "gobierno",
        admin: "admin",
      },
      experienceMeta: {
        government: {
          title: "Vista gobierno",
          description: "Seguimiento territorial, alertas ejecutivas y lectura agregada sin mezclar capas técnicas que no aportan a este perfil.",
        },
        researcher: {
          title: "Vista investigación",
          description: "Evidencia capturada, consistencia entre sync y partida, y lectura de muestra con menos ruido técnico.",
        },
        family: {
          title: "Vista familia",
          description: "Seguimiento simple y claro de la actividad, sin fricción técnica ni administrativa.",
        },
        teacher: {
          title: "Vista docente",
          description: "Juego, dispositivos y sincronizaciones a mano para operar el aula con rapidez.",
        },
        institution: {
          title: "Vista institucional",
          description: "Seguimiento institucional, gobernanza cotidiana y foco en lo que requiere acción hoy.",
        },
        platform: {
          title: "Vista plataforma",
          description: "Visión global, módulos técnicos y superficies transversales para operar toda la plataforma.",
        },
        fallback: {
          title: "Vista institucional",
          description: "Seguimiento pedagógico claro, cálido y accionable.",
        },
      },
      navigation: {
        dashboard: { label: "Dashboard", summary: "Estado general, alertas y próximos focos del rol actual." },
        territorialAlerts: { label: "Alertas territoriales", summary: "Incidentes y territorios que necesitan revisión rápida." },
        territorialOverview: { label: "Territorios e instituciones", summary: "Drilldown territorial con foco en cohortes e instituciones." },
        devices: { label: "Dispositivos", summary: "Parque, ownership y estado de los dispositivos." },
        games: { label: "Partidas", summary: "Sesiones, jugadores, turnos y uso reciente con contexto real." },
        syncs: { label: "Sincronizaciones", summary: "Trazabilidad reciente, captura y consistencia de sincronizaciones." },
        users: { label: "Usuarios", summary: "Padrón, roles y contexto de usuarios." },
        institutions: { label: "Instituciones", summary: "Seguimiento institucional con foco en observaciones y cobertura." },
        profiles: { label: "Perfiles", summary: "Bindings, sesiones y trazabilidad entre personas y uso." },
        permissions: { label: "Permisos", summary: "Contrato ACL, bundles y consistencia de permisos efectivos." },
        health: { label: "Salud", summary: "Checks técnicos, readiness y señales del backend real." },
        settings: { label: "Configuración", summary: "Runtime efectivo, catálogos y configuración del sistema." },
      },
      desktopTitle: "Web Dashboard",
      desktopDescription: "Navegación desktop más clara para recorrer rápido cada superficie.",
      tutorialAvailable: "Recorrido guiado disponible",
      tutorialDeferred: "Lo dejé fuera del arranque para no tapar la pantalla.",
      newBadge: "Nuevo",
      viewTutorial: "Ver tutorial",
      reopenTutorial: "Reabrir tutorial",
      apiBase: "API base",
      activeScreen: "Pantalla activa",
      tutorial: "Tutorial",
      logout: "Salir",
    },
  },
  en: {
    common: {
      languageLabel: "Language",
    },
    auth: {
      pages: {
        login: { title: "MagicBox", description: "Sign in to continue on the web.", loading: "Loading form..." },
        register: { title: "Create account", description: "Self-signup is available only for family accounts.", loading: "Loading signup..." },
        forgotPassword: { title: "Recover password", description: "We’ll send a code by email so you can continue the reset flow.", loading: "Loading recovery..." },
        verifyOtp: { title: "Verify code", description: "Enter the 6-digit code sent to your email.", loading: "Loading verification..." },
        resetPassword: { title: "New password", description: "Choose a secure password to sign back in.", loading: "Loading form..." },
      },
      loginForm: {
        emailLabel: "Email",
        emailPlaceholder: "you@magicbox.com",
        passwordLabel: "Password",
        showPassword: "Show",
        hidePassword: "Hide",
        forgotPassword: "Forgot your password?",
        createUser: "Create account",
        submitting: "Signing in...",
        submit: "Sign in",
        validation: { invalidEmail: "Enter a valid email", requiredPassword: "Enter your password" },
      },
      registerForm: {
        autonomousNotice: "Self-signup is intended only for family accounts. If you need a different role, an administrator must create it.",
        success: "Account created. You can now sign in with those details.",
        firstName: "First name",
        lastName: "Last name",
        email: "Email",
        country: "Country",
        phone: "Phone",
        phoneHelp: "We use the same backend and user database as the mobile app.",
        password: "Password",
        confirmPassword: "Confirm password",
        submitting: "Creating...",
        submit: "Create account",
        alreadyHaveAccount: "I already have an account",
        goToLogin: "Go to login",
      },
      forgotPasswordForm: {
        notice: "We’ll send a code to the email linked to your account so you can continue the reset.",
        email: "Email",
        submitting: "Sending...",
        submit: "Send code",
        backToLogin: "Back to login",
        createUser: "Create account",
      },
      verifyOtpForm: {
        notice: "If you don’t see it in your inbox, check spam. The code expires quickly.",
        sentTo: "We sent a code to:",
        fallbackEmail: "your email",
        submitting: "Continuing...",
        submit: "Continue",
        resend: "Resend code",
        backToLogin: "Back to login",
        changeEmail: "Change email",
      },
      resetPasswordForm: {
        notice: "Choose a new secure password and don’t reuse it in other services.",
        createFor: "Create a new password for:",
        fallbackAccount: "your account",
        newPassword: "New password",
        confirmPassword: "Confirm password",
        submitting: "Updating...",
        submit: "Update password",
        backToLogin: "Back to login",
        resend: "Resend code",
      },
      validation: {
        requiredField: "Required field",
        requiredEmail: "Enter your email",
        invalidEmail: "Enter a valid email",
        requiredName: "Enter your name",
        nameMinLength: "Name must be at least 2 characters",
        nameLettersOnly: "Name can only contain letters and spaces",
        requiredPassword: "Enter your password",
        passwordLength: "Password must be between 8 and 128 characters",
        passwordNoSpaces: "Password cannot contain spaces",
        passwordUppercase: "Include at least one uppercase letter",
        passwordLowercase: "Include at least one lowercase letter",
        passwordNumber: "Include at least one number",
        passwordSpecial: "Include at least one special character",
        passwordCommon: "Password is too common",
        passwordRepeats: "Avoid repeated characters",
        passwordSequence: "Avoid simple sequences",
        requiredPasswordConfirmation: "Confirm your password",
        passwordMismatch: "Passwords do not match",
        requiredPhone: "Enter your phone number",
        phoneLength: "Phone number must have between {{min}} and {{max}} digits for {{country}}",
      },
    },
    appShell: {
      sections: { summary: "Overview", operation: "Operations", governance: "Governance", technical: "Technical" },
      roleLabels: {
        teacher: "teacher",
        director: "director",
        researcher: "researcher",
        family: "family",
        "institution-admin": "institution admin",
        "government-viewer": "government",
        admin: "admin",
      },
      experienceMeta: {
        government: { title: "Government view", description: "Territorial tracking, executive alerts and aggregated reading without mixing in technical layers that add no value for this profile." },
        researcher: { title: "Research view", description: "Captured evidence, sync/game consistency and sample reading with less technical noise." },
        family: { title: "Family view", description: "Simple, clear activity tracking without technical or administrative friction." },
        teacher: { title: "Teacher view", description: "Games, devices and syncs close at hand to operate the classroom quickly." },
        institution: { title: "Institution view", description: "Institution follow-up, day-to-day governance and focus on what needs action today." },
        platform: { title: "Platform view", description: "Global visibility, technical modules and cross-cutting surfaces to operate the whole platform." },
        fallback: { title: "Institution view", description: "Clear, warm and actionable educational follow-up." },
      },
      navigation: {
        dashboard: { label: "Dashboard", summary: "General status, alerts and next priorities for the current role." },
        territorialAlerts: { label: "Territorial alerts", summary: "Incidents and territories that need quick review." },
        territorialOverview: { label: "Territories and institutions", summary: "Territorial drilldown focused on cohorts and institutions." },
        devices: { label: "Devices", summary: "Fleet, ownership and device status." },
        games: { label: "Games", summary: "Sessions, players, turns and recent usage with real context." },
        syncs: { label: "Syncs", summary: "Recent traceability, capture and sync consistency." },
        users: { label: "Users", summary: "Roster, roles and user context." },
        institutions: { label: "Institutions", summary: "Institution follow-up focused on observations and coverage." },
        profiles: { label: "Profiles", summary: "Bindings, sessions and traceability across people and usage." },
        permissions: { label: "Permissions", summary: "ACL contract, bundles and effective permission consistency." },
        health: { label: "Health", summary: "Technical checks, readiness and real backend signals." },
        settings: { label: "Settings", summary: "Effective runtime, catalogs and system configuration." },
      },
      desktopTitle: "Web Dashboard",
      desktopDescription: "Clearer desktop navigation to move quickly through every surface.",
      tutorialAvailable: "Guided tour available",
      tutorialDeferred: "I kept it out of the initial load so it wouldn’t cover the screen.",
      newBadge: "New",
      viewTutorial: "View tutorial",
      reopenTutorial: "Reopen tutorial",
      apiBase: "API base",
      activeScreen: "Active screen",
      tutorial: "Tutorial",
      logout: "Sign out",
    },
  },
  pt: {
    common: {
      languageLabel: "Idioma",
    },
    auth: {
      pages: {
        login: { title: "MagicBox", description: "Entre com sua conta para continuar na web.", loading: "Carregando formulário..." },
        register: { title: "Criar conta", description: "O cadastro autônomo está disponível apenas para contas family.", loading: "Carregando cadastro..." },
        forgotPassword: { title: "Recuperar senha", description: "Vamos enviar um código por e-mail para continuar a redefinição.", loading: "Carregando recuperação..." },
        verifyOtp: { title: "Verificar código", description: "Digite o código de 6 dígitos enviado para seu e-mail.", loading: "Carregando verificação..." },
        resetPassword: { title: "Nova senha", description: "Escolha uma senha segura para entrar novamente.", loading: "Carregando formulário..." },
      },
      loginForm: {
        emailLabel: "Email",
        emailPlaceholder: "voce@magicbox.com",
        passwordLabel: "Senha",
        showPassword: "Mostrar",
        hidePassword: "Ocultar",
        forgotPassword: "Esqueceu sua senha?",
        createUser: "Criar conta",
        submitting: "Entrando...",
        submit: "Entrar",
        validation: { invalidEmail: "Digite um email válido", requiredPassword: "Digite sua senha" },
      },
      registerForm: {
        autonomousNotice: "O cadastro autônomo foi pensado apenas para contas family. Se você precisar de outro papel, um administrador deve criá-lo.",
        success: "Conta criada. Você já pode entrar com esses dados.",
        firstName: "Nome",
        lastName: "Sobrenome",
        email: "Email",
        country: "País",
        phone: "Telefone",
        phoneHelp: "Usamos o mesmo backend e a mesma base de usuários do app móvel.",
        password: "Senha",
        confirmPassword: "Confirmar senha",
        submitting: "Criando...",
        submit: "Criar conta",
        alreadyHaveAccount: "Já tenho conta",
        goToLogin: "Ir para login",
      },
      forgotPasswordForm: {
        notice: "Enviaremos um código para o email associado à sua conta para continuar a redefinição.",
        email: "Email",
        submitting: "Enviando...",
        submit: "Enviar código",
        backToLogin: "Voltar ao login",
        createUser: "Criar conta",
      },
      verifyOtpForm: {
        notice: "Se você não o encontrar na caixa de entrada, verifique o spam. O código expira rápido.",
        sentTo: "Enviamos um código para:",
        fallbackEmail: "seu email",
        submitting: "Continuando...",
        submit: "Continuar",
        resend: "Reenviar código",
        backToLogin: "Voltar ao login",
        changeEmail: "Trocar email",
      },
      resetPasswordForm: {
        notice: "Escolha uma nova senha segura e não a reutilize em outros serviços.",
        createFor: "Crie uma nova senha para:",
        fallbackAccount: "sua conta",
        newPassword: "Nova senha",
        confirmPassword: "Confirmar senha",
        submitting: "Atualizando...",
        submit: "Atualizar senha",
        backToLogin: "Voltar ao login",
        resend: "Reenviar código",
      },
      validation: {
        requiredField: "Campo obrigatório",
        requiredEmail: "Digite seu email",
        invalidEmail: "Digite um email válido",
        requiredName: "Digite seu nome",
        nameMinLength: "O nome deve ter pelo menos 2 caracteres",
        nameLettersOnly: "O nome só pode conter letras e espaços",
        requiredPassword: "Digite sua senha",
        passwordLength: "A senha deve ter entre 8 e 128 caracteres",
        passwordNoSpaces: "A senha não pode conter espaços",
        passwordUppercase: "Inclua pelo menos uma letra maiúscula",
        passwordLowercase: "Inclua pelo menos uma letra minúscula",
        passwordNumber: "Inclua pelo menos um número",
        passwordSpecial: "Inclua pelo menos um caractere especial",
        passwordCommon: "A senha é muito comum",
        passwordRepeats: "Evite repetir caracteres",
        passwordSequence: "Evite sequências simples",
        requiredPasswordConfirmation: "Confirme sua senha",
        passwordMismatch: "As senhas não coincidem",
        requiredPhone: "Digite seu telefone",
        phoneLength: "O telefone deve ter entre {{min}} e {{max}} dígitos para {{country}}",
      },
    },
    appShell: {
      sections: { summary: "Resumo", operation: "Operação", governance: "Governança", technical: "Técnico" },
      roleLabels: {
        teacher: "docente",
        director: "diretor",
        researcher: "pesquisa",
        family: "família",
        "institution-admin": "institution admin",
        "government-viewer": "governo",
        admin: "admin",
      },
      experienceMeta: {
        government: { title: "Visão governo", description: "Acompanhamento territorial, alertas executivos e leitura agregada sem misturar camadas técnicas que não agregam valor a esse perfil." },
        researcher: { title: "Visão pesquisa", description: "Evidência capturada, consistência entre sync e partida e leitura de amostra com menos ruído técnico." },
        family: { title: "Visão família", description: "Acompanhamento simples e claro da atividade, sem atrito técnico ou administrativo." },
        teacher: { title: "Visão docente", description: "Partidas, dispositivos e sincronizações à mão para operar a sala com rapidez." },
        institution: { title: "Visão institucional", description: "Acompanhamento institucional, governança cotidiana e foco no que precisa de ação hoje." },
        platform: { title: "Visão plataforma", description: "Visão global, módulos técnicos e superfícies transversais para operar toda a plataforma." },
        fallback: { title: "Visão institucional", description: "Acompanhamento pedagógico claro, acolhedor e acionável." },
      },
      navigation: {
        dashboard: { label: "Dashboard", summary: "Estado geral, alertas e próximos focos do papel atual." },
        territorialAlerts: { label: "Alertas territoriais", summary: "Incidentes e territórios que precisam de revisão rápida." },
        territorialOverview: { label: "Territórios e instituições", summary: "Drilldown territorial com foco em coortes e instituições." },
        devices: { label: "Dispositivos", summary: "Parque, ownership e estado dos dispositivos." },
        games: { label: "Partidas", summary: "Sessões, jogadores, turnos e uso recente com contexto real." },
        syncs: { label: "Sincronizações", summary: "Rastreabilidade recente, captura e consistência das sincronizações." },
        users: { label: "Usuários", summary: "Cadastro, papéis e contexto dos usuários." },
        institutions: { label: "Instituições", summary: "Acompanhamento institucional com foco em observações e cobertura." },
        profiles: { label: "Perfis", summary: "Bindings, sessões e rastreabilidade entre pessoas e uso." },
        permissions: { label: "Permissões", summary: "Contrato ACL, bundles e consistência das permissões efetivas." },
        health: { label: "Saúde", summary: "Checks técnicos, readiness e sinais do backend real." },
        settings: { label: "Configuração", summary: "Runtime efetivo, catálogos e configuração do sistema." },
      },
      desktopTitle: "Web Dashboard",
      desktopDescription: "Navegação desktop mais clara para percorrer rapidamente cada superfície.",
      tutorialAvailable: "Tour guiado disponível",
      tutorialDeferred: "Eu deixei fora da abertura para não cobrir a tela.",
      newBadge: "Novo",
      viewTutorial: "Ver tutorial",
      reopenTutorial: "Reabrir tutorial",
      apiBase: "API base",
      activeScreen: "Tela ativa",
      tutorial: "Tutorial",
      logout: "Sair",
    },
  },
};

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: AppMessages;
};

const STORAGE_KEY = "magicbox-language";

function detectInitialLanguage(): AppLanguage {
  if (typeof window === "undefined") return "es";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === "es" || saved === "en" || saved === "pt") return saved;
  const preferred = window.navigator.language.toLowerCase();
  if (preferred.startsWith("pt")) return "pt";
  if (preferred.startsWith("en")) return "en";
  return "es";
}

const LanguageContext = createContext<LanguageContextValue>({
  language: "es",
  setLanguage: () => undefined,
  t: messages.es,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>("es");

  useEffect(() => {
    setLanguage(detectInitialLanguage());
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(
    () => ({ language, setLanguage, t: messages[language] }),
    [language],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
