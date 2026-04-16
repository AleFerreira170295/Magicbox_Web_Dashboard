# MagicBox Web Dashboard

Plataforma web de MagicBox para explorar, auditar y analizar sincronizaciones, partidas y dispositivos sin perder trazabilidad del payload original. Además de la experiencia para clientes e instituciones, esta web también debe evolucionar como consola de superadmin para gestión operativa de usuarios, permisos, instituciones, perfiles y estado del parque de dispositivos.

## Estado de este primer entregable

Este repo estaba vacío. En esta primera iteración queda implementado:

- bootstrap con Next.js + TypeScript + Tailwind
- base de componentes estilo shadcn/ui
- TanStack Query configurado
- autenticación preparada para el backend Flask existente
- navegación por roles, con resolución provisional configurable mientras el backend expone roles/permisos explícitos
- dashboard inicial de docente
- módulos base de sincronizaciones, partidas y dispositivos
- tipos TypeScript y clientes API preparados para datos raw + normalizados
- documentación de arquitectura lossless e inventario de endpoints/requerimientos

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
- `/login`

## Reutilización del backend actual

Esta versión ya consume o prepara consumo de:

- `GET /auth/me`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /game-data/`
- `GET /ble-device`
- `GET /home/sessions/history` como fallback legacy para sincronizaciones

## Próximo paso recomendado

Además de completar la capa backend lossless mínima, la siguiente iteración de frontend debería separar explícitamente la navegación de institución y la navegación de superadmin.

Backend / datos:

1. `raw_ingestion_records`
2. `raw_ingestion_fragments`
3. `sync_sessions` canónica multi-origen
4. endpoint de ingestión lossless idempotente
5. endpoint de consultas de sincronización para web

Frontend / producto:

6. home de superadmin con métricas globales
7. módulo de usuarios y permisos
8. módulo de instituciones
9. módulo de perfiles relevantes
10. módulo de salud de dispositivos y sincronización
