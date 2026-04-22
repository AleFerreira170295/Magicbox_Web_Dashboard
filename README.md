# MagicBox Web Dashboard

Plataforma web de MagicBox para explorar, auditar y analizar sincronizaciones, partidas y dispositivos sin perder trazabilidad del payload original. Además de la experiencia para clientes e instituciones, esta web también debe evolucionar como consola de superadmin para gestión operativa de usuarios, permisos, instituciones, perfiles y estado del parque de dispositivos.

## Estado actual

Este repo arrancó vacío y ya quedó convertido en una base funcional bastante más completa.

Hoy incluye:

- bootstrap con Next.js + TypeScript + Tailwind
- base de componentes estilo shadcn/ui
- TanStack Query configurado
- autenticación preparada para el backend Flask existente
- navegación por roles, con resolución provisional configurable mientras el backend expone roles/permisos explícitos
- dashboards y navegación diferenciados por perfil
- módulos operativos para sincronizaciones, partidas, dispositivos, usuarios, permisos, instituciones y perfiles
- tipos TypeScript y clientes API preparados para datos raw + normalizados
- documentación de arquitectura lossless e inventario de endpoints/requerimientos

## Actualizaciones recientes del dashboard operativo

En la iteración más reciente se consolidó la home operativa para superadmin y gobierno sobre el endpoint agregado `GET /api/v1.0/system/dashboard/summary`, con foco en lectura ejecutiva real y filtros compartibles.

Incluye:

- filtros por rango, institución y jerarquía territorial (país, estado, ciudad)
- cohortes por tipo de usuario y rol agrupado
- mini tendencias y comparativas entre períodos
- alertas/semaforización ejecutiva y score territorial compuesto
- modo `government-viewer` con alcance territorial de solo lectura
- presets inteligentes del sistema para detectar territorios críticos o con baja actividad
- guardado local de vistas ejecutivas
- botón directo de **copiar link** para compartir la combinación actual completa de filtros, rango y smart preset activo

Además, la ruta `/login` ya quedó ajustada para App Router con `Suspense`, evitando el bloqueo de build cuando `LoginForm` usa `useSearchParams()`.

## Estado reciente por perfil

En esta tanda se terminó de empujar la plataforma con criterio **perfil por perfil, pantalla por pantalla**, priorizando operatividad antes que polish fino.

### `admin`

- mantiene la vista global/ejecutiva en `/dashboard`
- conserva acceso a módulos técnicos y de operación completa

### `government-viewer`

- `/dashboard` con lectura ejecutiva
- `/territorial-alerts`
- `/territorial-overview`
- navegación acotada a lectura territorial y alertas

### `institution-admin` / `director`

- home institucional dedicada en `/dashboard`
- módulos núcleo reforzados:
  - `/users`
  - `/devices`
  - `/institutions`
  - `/profiles`
  - `/permissions` (para `institution-admin` cuando la ACL del backend lo permite)

### `teacher`

- home operativa dedicada en `/dashboard`
- `/games` reforzado con foco en acceso visible, asociaciones y detalle legible
- `/syncs` reforzado para cerrar mejor el tramo `sync -> game`
- `/devices` reforzado con contexto de acceso y actividad visible
- cierre visual consistente entre home, partidas, dispositivos y syncs

### `researcher`

- home dedicada en `/dashboard`
- `/games` adaptado a lectura de evidencia y composición de muestra
- `/syncs` adaptado a cobertura de captura, correlación con partidas y evidencia visible
- cierre visual consistente para investigación

### `family`

- home simple en `/dashboard`
- `/games` en versión simplificada y de solo lectura
- `/syncs` en versión simplificada y de solo lectura
- navegación deliberadamente acotada, sin abrir módulos técnicos o administrativos

## QA funcional cruzado

Además del trabajo de producto por perfil, se amplió la cobertura de tests para validar:

- routing de `dashboard-home` por rol
- matriz de navegación visible en el shell
- guards de rutas por perfil
- coherencia entre perfiles al tocar navegación o módulos compartidos

La base actual ya pasa `test`, `typecheck`, `lint` y `build` tras cada frente cerrado.

## Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui style primitives
- TanStack Query
- Recharts

## Requisitos

- Node 20+
- backend `magicbox-api` corriendo localmente en `http://localhost:3000`

## Variables de entorno

Copiar `.env.example` a `.env.local`.

```bash
cp .env.example .env.local
```

Variables principales:

- `NEXT_PUBLIC_API_BASE_URL`, por defecto `http://localhost:3000/api/v1.0`
- `NEXT_PUBLIC_DEFAULT_ROLE`, fallback visual mientras el backend no devuelve roles/permisos explícitos

## Desarrollo local

```bash
npm install
npm run dev
```

La app corre en `http://localhost:3001`.

## Docker local

```bash
docker compose up --build
```

## Credenciales / auth

La UI ya está integrada con:

- `POST /api/v1.0/auth/login`
- `GET /api/v1.0/auth/me`
- `POST /api/v1.0/auth/logout`

Importante: el backend actual no expone todavía roles/permisos de forma explícita en `/auth/me`. Por eso esta primera versión usa:

1. roles explícitos si el backend los envía,
2. `NEXT_PUBLIC_DEFAULT_ROLE` como fallback,
3. y como último recurso una heurística mínima basada en `user_type`.

Eso está documentado para ser reemplazado por claims/permisos reales del backend.

## Documentación de arquitectura

- `docs/architecture-blueprint.md`, diagnóstico, arquitectura end-to-end, modelo de datos, endpoints, compatibilidad, testing e implementación priorizada.

## Alcance de producto que guía el diseño

La web ya no debe pensarse solo como un dashboard para clientes. A partir de ahora el producto tiene dos capas claras:

1. **Vista cliente / institución**
   - seguimiento de datos, partidas, sincronizaciones y dispositivos
   - lectura pedagógica e institucional
   - acceso restringido por institución, grupo y perfil

2. **Vista superadmin / operación MagicBox**
   - alta y gestión de usuarios
   - gestión de permisos y roles
   - alta, edición y seguimiento de instituciones
   - acceso a perfiles relevantes y metadata operativa
   - monitoreo de estado de dispositivos y salud de sincronización
   - panel global con métricas agregadas y alertas

## Módulos implementados

- `/dashboard`
- `/syncs`
- `/games`
- `/devices`
- `/users`
- `/permissions`
- `/institutions`
- `/profiles`
- `/territorial-alerts`
- `/territorial-overview`
- `/login`

Dentro de `/dashboard`, la home ya contempla tanto la capa operativa de administración como la lectura territorial ejecutiva para perfiles de gobierno.

## Reutilización del backend actual

Esta versión ya consume o prepara consumo de:

- `GET /auth/me`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /game-data/`
- `GET /ble-device`
- `GET /home/sessions/history` como fallback legacy para sincronizaciones

## Próximo paso recomendado

Con la base por perfiles bastante más madura, el siguiente frente natural ya no es abrir más pantallas a ciegas, sino una de estas dos líneas:

1. **QA manual transversal** por perfil sobre datos reales del backend
2. **polish fino** de detalles visuales e interacción ahora que las funciones principales ya están operativas

En backend, sigue siendo valioso consolidar la capa lossless canónica de ingestión y consulta para sincronizaciones.
