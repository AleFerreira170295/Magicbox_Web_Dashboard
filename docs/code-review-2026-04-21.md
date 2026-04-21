# Code review, 2026-04-21

## Resumen ejecutivo

La base del frontend está bien encaminada y ya supera el alcance que todavía describe el README. Los principales riesgos actuales no están en "faltan pantallas", sino en:

1. setup local frágil,
2. flujo de auth incompleto,
3. archivos demasiado grandes,
4. normalización API duplicada,
5. fallbacks que pueden ocultar errores reales.

---

## P0, resolver primero

### 1) Login local frágil por `localhost` vs `127.0.0.1`
- **Síntoma:** el login puede fallar si la web se abre en `http://127.0.0.1:3001`.
- **Causa probable:** el backend permite `CORS_ORIGINS=http://localhost:3001`, pero no `http://127.0.0.1:3001`.
- **Impacto:** bloquea QA local aunque backend y frontend estén funcionando.
- **Acción recomendada:**
  - agregar `http://127.0.0.1:3001` y `http://127.0.0.1:3000` al CORS del backend, o
  - normalizar toda la documentación y arranque a `localhost`.
- **Archivos/superficie:** backend `.env`, documentación local del dashboard, flujo de arranque.
- **Criterio de aceptación:** login exitoso desde `localhost` y `127.0.0.1`.

### 2) Falta `.env.example` en el dashboard
- **Síntoma:** el README indica copiar `.env.example`, pero el archivo no existe.
- **Impacto:** onboarding confuso, setup inconsistente.
- **Acción recomendada:** crear `.env.example` con:
  - `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1.0`
  - `NEXT_PUBLIC_DEFAULT_ROLE=teacher`
  - `NEXT_PUBLIC_APP_NAME=MagicBox Web Dashboard`
- **Archivo:** `README.md`, nuevo `.env.example`.
- **Criterio de aceptación:** repo clonable y arrancable sin adivinanzas.

### 3) `next` del login no se respeta
- **Síntoma:** `AuthGuard` redirige a `/login?next=...`, pero luego el login siempre manda a `/dashboard`.
- **Impacto:** rompe deep links y empeora UX.
- **Acción recomendada:** leer `next` desde query params en `login-form.tsx` y usarlo tras login exitoso.
- **Archivos:**
  - `src/components/auth-guard.tsx`
  - `src/features/auth/login-form.tsx`
- **Criterio de aceptación:** entrar a una ruta protegida redirige a login y luego vuelve a la ruta original.

### 4) No hay refresh automático de sesión
- **Síntoma:** se guarda `refreshToken`, pero no existe flujo visible de refresh automático ante expiración del `accessToken`.
- **Impacto:** la sesión puede romperse de forma abrupta tras expirar el token.
- **Acción recomendada:**
  - implementar refresh centralizado en `apiRequest`, o
  - eliminar `refreshToken` del contrato frontend hasta que el flujo exista de verdad.
- **Archivos:**
  - `src/features/auth/auth-context.tsx`
  - `src/lib/api/fetcher.ts`
  - `src/features/auth/storage.ts`
- **Criterio de aceptación:** una sesión expirada se renueva o expulsa al usuario de forma clara y consistente.

---

## P1, alta prioridad técnica

### 5) Tokens en `localStorage`
- **Riesgo:** superficie XSS mayor de la deseable para producción.
- **Acción recomendada:** documentar que es una decisión temporal o migrar a cookies httpOnly si backend y despliegue lo permiten.
- **Archivo:** `src/features/auth/storage.ts`
- **Criterio de aceptación:** estrategia de sesión explícita y documentada.

### 6) Fallback de rol puede ocultar bugs reales
- **Síntoma:** si no reconoce roles reales del backend, cae a `NEXT_PUBLIC_DEFAULT_ROLE`.
- **Riesgo:** el sistema puede aparentar funcionar con permisos equivocados.
- **Acción recomendada:**
  - permitir alias de roles comunes (`institution_admin`, `institution-admin`, etc.),
  - loggear o exponer warning cuando se aplica fallback,
  - limitar el fallback a entornos dev.
- **Archivo:** `src/features/auth/role-resolver.ts`
- **Criterio de aceptación:** un rol desconocido no se degrada silenciosamente sin señal visible.

### 7) Componentes demasiado grandes
- **Síntoma:** varios archivos concentran demasiada UI, lógica de estado, filtros, mutaciones y normalización.
- **Archivos más críticos:**
  - `src/features/users/users-table.tsx`
  - `src/features/institutions/institutions-overview.tsx`
  - `src/features/permissions/permissions-center.tsx`
  - `src/features/devices/devices-table.tsx`
- **Riesgo:** mantenimiento lento, testing difícil, mayor chance de regresiones.
- **Acción recomendada:** separar por módulo en:
  - `components/`
  - `hooks/`
  - `mappers/`
  - `mutations/`
  - `filters/`
- **Criterio de aceptación:** cada archivo principal queda más chico y con una única responsabilidad dominante.

### 8) Lógica de visibilidad de navegación duplicada
- **Síntoma:** reglas de acceso y visibilidad viven tanto en `app-shell.tsx` como en dashboards y módulos.
- **Riesgo:** inconsistencias entre lo que el usuario ve en menú y lo que ve en home o módulos.
- **Archivos:**
  - `src/components/app-shell.tsx`
  - `src/features/dashboard/superadmin-dashboard.tsx`
- **Acción recomendada:** centralizar capacidades por rol/permiso en una sola fuente.
- **Criterio de aceptación:** navegación y tarjetas respetan exactamente las mismas reglas.

---

## P2, refactor recomendado

### 9) Normalización API duplicada en muchos módulos
- **Síntoma:** helpers como `asRecord`, `readString`, mapeos snake/camel y paginación se repiten.
- **Archivos representativos:**
  - `src/features/users/api.ts`
  - `src/features/institutions/api.ts`
  - varios `api.ts` de features
- **Riesgo:** inconsistencias sutiles cuando cambie backend.
- **Acción recomendada:** extraer utilidades comunes:
  - `src/lib/api/normalize.ts`
  - `src/lib/api/pagination.ts`
  - `src/lib/api/record.ts`
- **Criterio de aceptación:** la mayoría de los módulos consumen helpers compartidos en vez de duplicar parsing.

### 10) Contrato de envelope poco claro
- **Síntoma:** `apiRequest` ya unwrappea `payload.data`, pero algunos normalizadores todavía contemplan estructuras anidadas adicionales.
- **Riesgo:** complejidad accidental y debugging más difícil.
- **Archivo:** `src/lib/api/fetcher.ts`, más `api.ts` por feature.
- **Acción recomendada:** definir una convención única:
  - o `apiRequest` entrega siempre datos ya desempaquetados,
  - o los módulos reciben el envelope completo.
- **Criterio de aceptación:** una sola convención de respuesta para todo el frontend.

### 11) Error handling mejorable en auth
- **Síntoma:** si falla `/auth/me` después del login, el sistema hace fallback silencioso al usuario de login.
- **Riesgo:** sesión aparentemente válida pero perfil incompleto o inconsistente.
- **Archivo:** `src/features/auth/auth-context.tsx`
- **Acción recomendada:** diferenciar entre:
  - login OK + perfil OK,
  - login OK + perfil degradado,
  - login fallido.
- **Criterio de aceptación:** errores distinguibles y trazables.

### 12) Revisar estrategia de queries globales por pantalla
- **Síntoma:** pantallas como superadmin home hacen muchas queries en paralelo para armar métricas.
- **Riesgo:** carga lenta y UX frágil si falla un solo slice.
- **Archivo:** `src/features/dashboard/superadmin-dashboard.tsx`
- **Acción recomendada:**
  - tolerancia parcial a errores,
  - skeletons por bloque,
  - consolidar algunos agregados en backend si la pantalla crece.
- **Criterio de aceptación:** una falla parcial no rompe toda la home.

---

## Backlog sugerido, orden de ataque

### Sprint técnico 1
1. arreglar `localhost`/`127.0.0.1`
2. crear `.env.example`
3. respetar `next` en login
4. definir estrategia de refresh/session expiry

### Sprint técnico 2
5. centralizar reglas de acceso
6. refactor `users-table.tsx`
7. refactor `institutions-overview.tsx`
8. refactor `permissions-center.tsx`

### Sprint técnico 3
9. unificar normalización API
10. endurecer manejo de errores de auth
11. revisar performance y resiliencia de dashboard home

---

## Nota final

El proyecto no necesita una reescritura. Necesita endurecer la base para que la próxima iteración de producto no se vuelva lenta, frágil o engañosa durante QA.