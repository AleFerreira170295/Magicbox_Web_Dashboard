# MagicBox Web Dashboard, blueprint de arquitectura lossless

## 1. Diagnóstico inicial del repositorio

### Repositorio web nuevo
- Estado encontrado: repositorio vacío.
- Faltaban bootstrap, estructura de frontend, documentación, contratos API, auth, navegación, módulos y Docker local.

### Backend existente (`magicbox-api`)
Endpoints reutilizables hoy:
- `POST /api/v1.0/auth/login`
- `GET /api/v1.0/auth/me`
- `POST /api/v1.0/auth/logout`
- `GET /api/v1.0/game-data/`
- `GET /api/v1.0/game-data/{id}`
- `GET /api/v1.0/ble-device`
- `GET /api/v1.0/ble-device/{id}`
- `GET /api/v1.0/home/sessions/history`
- `GET /api/v1.0/home/sessions/{id}`
- `POST /api/v1.0/home/sessions/sync`
- `POST /api/v1.0/home/sessions/sync-batch`

Fortalezas del backend actual:
- auth y permisos ya existen
- PostgreSQL y SQLAlchemy ya existen
- estructura DDD/Clean ya existe
- `game-data` y `ble-device` ya ofrecen lectura útil para la web
- `home/sessions` ya tiene deduplicación básica e idempotencia parcial por `sync_id`

Gaps críticos frente al objetivo innegociable:
- no existe capa raw lossless persistente
- no se guardan payloads crudos completos ni fragmentos originales
- no hay versionado explícito de esquema por firmware/app/backend a nivel de ingestión
- `game-data` es demasiado interpretado y no garantiza conservar todos los campos futuros
- no hay trazabilidad completa entre raw ingest, sync session y entidades analíticas
- no existe estrategia explícita para unknown fields, fragment reassembly auditado, duplicados fuertes, backfill histórico ni exports raw

Conclusión: el backend no debe rehacerse, pero sí necesita una extensión mínima y muy deliberada para cumplir el principio `store first, interpret second`.

---

## 2. Arquitectura propuesta end-to-end

```text
Firmware MagicBox
  -> BLE
App móvil MagicBox
  -> normaliza lo mínimo indispensable para transporte
  -> envía payload lossless al backend
Backend Flask
  -> Ingestion API lossless
  -> Raw storage immutable
  -> Fragment assembler / dedup / checksum / idempotency
  -> Canonical projector
  -> Analytics projector / materialized views / async jobs
  -> Query API for web + exports
Web Dashboard Next.js
  -> Auth + RBAC
  -> Exploración raw
  -> Exploración canónica
  -> Dashboards analytics
  -> Exportaciones auditables
```

Principios:
- persistir primero, interpretar después
- raw immutable
- canonical append-friendly con updates controlados
- analytics derivado, nunca fuente de verdad
- compatibilidad hacia adelante por unknown fields
- idempotencia por sync envelope + checksum + source keys
- trazabilidad completa entre raw record, sync session, game, turn, dispositivo y export

### Capas

#### A. Raw data layer
Objetivo: no perder nada.

Persistir:
- payload JSON crudo completo
- fragmentos originales si llegan fragmentados
- headers/metadatos de transporte
- checksum/hash del payload y de fragmentos
- received_at, captured_at si existe
- source_type
- firmware/app/backend schema versions
- campos desconocidos sin descartar

#### B. Canonical operational layer
Objetivo: consultas confiables, reconstrucción total de sesiones y base operativa para UI.

#### C. Analytics layer
Objetivo: vistas agregadas, comparables y exportables sin romper vínculo con raw/canonical.

---

## 3. Diseño de modelo de datos completo

### 3.1 Raw layer

#### `raw_ingestion_records`
Fuente de verdad de primer ingreso.

Campos sugeridos:
- `id UUID PK`
- `ingestion_key TEXT UNIQUE NULL` (si app manda idempotency key)
- `source_type TEXT NOT NULL` (`ble_sync`, `device_snapshot`, `game_download`, `notification`, `manual_backfill`, `api_import`)
- `source_channel TEXT NULL` (`mobile_app`, `ops_tool`, `migration`)
- `device_id TEXT NULL`
- `firmware_version TEXT NULL`
- `app_version TEXT NULL`
- `backend_schema_version TEXT NULL`
- `payload_schema_version TEXT NULL`
- `sync_session_id TEXT NULL`
- `game_id TEXT NULL`
- `captured_at TIMESTAMPTZ NULL`
- `received_at TIMESTAMPTZ NOT NULL`
- `payload_sha256 TEXT NOT NULL`
- `payload_size_bytes BIGINT NOT NULL`
- `payload_json JSONB NOT NULL`
- `payload_json_unknown JSONB NULL`
- `transport_metadata JSONB NULL`
- `request_headers JSONB NULL`
- `is_fragmented BOOLEAN NOT NULL DEFAULT FALSE`
- `fragment_count INT NULL`
- `assembler_status TEXT NOT NULL DEFAULT 'pending'`
- `duplicate_of_raw_record_id UUID NULL`
- `canonical_projection_status TEXT NOT NULL DEFAULT 'pending'`
- `analytics_projection_status TEXT NOT NULL DEFAULT 'pending'`
- `created_at TIMESTAMPTZ NOT NULL`

Índices:
- unique parcial en (`source_type`, `device_id`, `sync_session_id`, `payload_sha256`) cuando aplique
- índice por `device_id`
- índice por `sync_session_id`
- índice por `received_at`
- GIN sobre `payload_json`

#### `raw_ingestion_fragments`
- `id UUID PK`
- `raw_ingestion_record_id UUID FK logical`
- `fragment_index INT NOT NULL`
- `fragment_count INT NOT NULL`
- `fragment_sha256 TEXT NOT NULL`
- `fragment_payload JSONB NOT NULL`
- `captured_at TIMESTAMPTZ NULL`
- `received_at TIMESTAMPTZ NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL`

Unique:
- (`raw_ingestion_record_id`, `fragment_index`)

#### `raw_ingestion_audit`
Para auditoría operativa.
- recepción
- deduplicación
- reassembly
- projection started/completed/failed
- export generated

### 3.2 Canonical operational layer

#### `sync_sessions`
Unidad central de trazabilidad.
- `id UUID PK`
- `sync_session_id TEXT UNIQUE NOT NULL`
- `device_id TEXT NOT NULL`
- `ble_device_id UUID NULL`
- `firmware_version TEXT NULL`
- `app_version TEXT NULL`
- `backend_schema_version TEXT NULL`
- `payload_schema_version TEXT NULL`
- `source_type TEXT NOT NULL`
- `sync_status TEXT NOT NULL` (`received`, `assembled`, `projected`, `partial`, `duplicate`, `failed`)
- `capture_started_at TIMESTAMPTZ NULL`
- `capture_completed_at TIMESTAMPTZ NULL`
- `synced_at TIMESTAMPTZ NULL`
- `first_received_at TIMESTAMPTZ NOT NULL`
- `last_received_at TIMESTAMPTZ NOT NULL`
- `raw_record_count INT NOT NULL DEFAULT 0`
- `raw_fragment_count INT NOT NULL DEFAULT 0`
- `checksum_sha256 TEXT NULL`
- `dedup_fingerprint TEXT NULL`
- `session_metadata JSONB NULL`
- `unknown_fields JSONB NULL`
- `created_at TIMESTAMPTZ NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL`

#### `sync_session_raw_records`
Tabla puente entre sync session y raw records.

#### `devices`
Catálogo canónico por `device_id`.
- versiones observadas
- institución propietaria
- estado lógico
- metadata acumulada no destructiva

#### `device_snapshots`
Estado puntual del dispositivo por sync.
- batería
- storage
- versión firmware
- estado operativo
- metadata raw no mapeada

#### `games`
Partida reconstruible.
- `id UUID PK`
- `game_id TEXT NOT NULL`
- `device_id TEXT NOT NULL`
- `sync_session_id TEXT NOT NULL`
- `firmware_version TEXT NULL`
- `app_version TEXT NULL`
- `educational_center_id UUID NULL`
- `class_group_id UUID NULL`
- `teacher_user_id UUID NULL`
- `started_at TIMESTAMPTZ NULL`
- `ended_at TIMESTAMPTZ NULL`
- `duration_seconds NUMERIC NULL`
- `deck_name TEXT NULL`
- `deck_code TEXT NULL`
- `difficulty TEXT NULL`
- `single_player_mode BOOLEAN NULL`
- `game_end_reason TEXT NULL`
- `total_players INT NULL`
- `total_turns INT NULL`
- `score NUMERIC NULL`
- `raw_summary JSONB NULL`
- `unknown_fields JSONB NULL`
- `created_at`, `updated_at`

Unique recomendado:
- (`device_id`, `game_id`, `started_at`) o `stable_game_key`

#### `game_players`
- jugador registrado o manual
- vínculo con student si existe
- `external_player_uid` si no existe student
- color / posición / binding
- unknown_fields

#### `game_turns`
Nivel más importante para investigación.
- `game_id UUID FK logical`
- `turn_number INT NOT NULL`
- `player_id UUID NULL`
- `student_id UUID NULL`
- `external_player_uid TEXT NULL`
- `position INT NULL`
- `card_id TEXT NULL`
- `deck_card_id TEXT NULL`
- `success BOOLEAN NULL`
- `attempt_count INT NULL`
- `response_time_ms NUMERIC NULL`
- `play_time_seconds NUMERIC NULL`
- `difficulty TEXT NULL`
- `started_at TIMESTAMPTZ NULL`
- `ended_at TIMESTAMPTZ NULL`
- `turn_metadata JSONB NULL`
- `unknown_fields JSONB NULL`

Integridad:
- unique (`game_id`, `turn_number`)

#### `device_notifications`
- tipo
- severidad
- raw payload
- source_type
- timestamps

#### `battery_snapshots`
#### `storage_snapshots`
#### `class_groups`
#### `students`
#### `educational_centers`
Reutilizar las existentes cuando ya existen y solo extender con metadata/versioning/audit cuando haga falta.

### 3.3 Analytics layer

Vistas o tablas materializadas:
- `analytics_student_performance_daily`
- `analytics_group_performance_daily`
- `analytics_teacher_performance_daily`
- `analytics_device_usage_daily`
- `analytics_deck_difficulty_daily`
- `analytics_response_time_daily`
- `analytics_error_patterns_daily`
- `analytics_sync_quality_daily`

Regla: cada vista debe conservar claves de trazabilidad hacia `sync_sessions`, `games` o `raw_ingestion_records` cuando corresponda.

---

## 4. Contrato de sincronización recomendado

### Endpoint principal recomendado
`POST /api/v1.0/ingestion/raw-syncs`

### Envelope recomendado

```json
{
  "source_type": "ble_sync",
  "source_channel": "mobile_app",
  "ingestion_key": "uuid-or-stable-idempotency-key",
  "device_id": "A1B2C3D4E5F6",
  "sync_session_id": "mb-A1B2C3D4E5F6-2001-20260415T143000Z",
  "firmware_version": "V2.2",
  "app_version": "1.4.0",
  "backend_schema_version": "2026-04-v1",
  "payload_schema_version": "firmware.v2.2.session-sync.v1",
  "captured_at": "2026-04-15T14:30:00Z",
  "received_at": "2026-04-15T14:31:00Z",
  "is_fragmented": true,
  "fragment_index": 1,
  "fragment_count": 3,
  "payload": {
    "...": "raw payload lossless"
  },
  "transport_metadata": {
    "mobile_platform": "android",
    "ble_rssi": -65
  }
}
```

Reglas:
- aceptar campos desconocidos en envelope y payload
- guardar envelope y payload completos
- si `fragment_index/fragment_count` existen, guardar fragmentos individuales y también ensamblado cuando se complete
- responder con ids de raw record + sync session cuando sea posible
- soportar idempotencia por `ingestion_key` y por fingerprint derivado

---

## 5. Endpoints reutilizables y endpoints nuevos necesarios

### Reutilizables ya
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`
- `GET /game-data/`
- `GET /game-data/{id}`
- `GET /ble-device`
- `GET /ble-device/{id}`
- `GET /home/sessions/history` (solo fallback temporal para sync views)
- `GET /home/sessions/{id}`

### Nuevos mínimos indispensables

#### Ingesta raw
- `POST /ingestion/raw-syncs`
- `POST /ingestion/raw-syncs/batch`
- `GET /ingestion/raw-syncs`
- `GET /ingestion/raw-syncs/{id}`
- `GET /ingestion/raw-syncs/{id}/fragments`

#### Sincronizaciones completas
- `GET /sync-sessions`
- `GET /sync-sessions/{id}`
- `GET /sync-sessions/{id}/raw`
- `POST /sync-sessions/backfill`

#### Snapshots de dispositivo
- `POST /device-snapshots`
- `GET /device-snapshots`
- `GET /devices/{device_id}/snapshots`

#### Notificaciones
- `POST /device-notifications`
- `GET /device-notifications`
- `GET /devices/{device_id}/notifications`

#### Analytics
- `GET /analytics/teacher/dashboard`
- `GET /analytics/students/performance`
- `GET /analytics/groups/performance`
- `GET /analytics/devices/usage`
- `GET /analytics/errors/patterns`
- `GET /analytics/sync-quality`

#### Exportaciones
- `POST /exports/raw-syncs`
- `POST /exports/games`
- `POST /exports/analytics`
- `GET /exports/{job_id}`

---

## 6. Estrategia de compatibilidad futura con firmware

1. versionar envelope y payload por separado
2. guardar unknown fields en raw siempre
3. guardar unknown fields en canonical cuando no exista mapeo todavía
4. projection code backward-compatible por versión
5. nunca usar validaciones cerradas que rechacen campos extra si no son críticos
6. usar feature flags por versión de firmware solo para interpretación, no para persistencia
7. mantener tests de golden payloads por firmware version

---

## 7. Validaciones de integridad para garantizar cero pérdida

- si llega un campo no mapeado, se guarda en `payload_json` y opcionalmente en `unknown_fields`
- si cambia firmware, la ingestión nunca depende de un schema rígido cerrado
- si llega en fragmentos, se guardan fragmentos + ensamblado + huella + estado del assembler
- contar turnos recibidos vs turnos proyectados
- comparar players recibidos vs players proyectados
- detectar duplicados por `ingestion_key`, `sync_session_id`, checksum y fingerprint
- idempotencia: reingesta del mismo payload no crea dobles partidas ni dobles turnos
- auditoría: quién envió, cuándo llegó, desde qué app/device/source, qué proyecciones disparó
- backfill: migrar históricos desde `game-data`/`home-sessions` hacia raw surrogate cuando el raw real no exista

---

## 8. Privacidad y permisos

Roles objetivo:
- docente
- director
- familia
- investigador
- administrador institucional
- superadmin MagicBox

Reglas:
- aislamiento por institución
- filtrado por grupo y estudiante
- familia solo ve su/s estudiante/s
- investigador accede a datasets anonimizados o pseudonimizados
- administrador institucional gestiona su propia institución sin acceder a otras
- superadmin MagicBox puede administrar usuarios, instituciones, permisos, perfiles operativos y estado global de dispositivos
- exportaciones con plantillas de anonimización
- minimizar PII en vistas analíticas por defecto
- logs y exports auditados

---

## 9. Lista priorizada de tareas de implementación

### P0
1. crear tablas raw ingestion y fragmentos
2. endpoint `POST /ingestion/raw-syncs` idempotente
3. assembler de fragmentos + checksums
4. projector raw -> canonical
5. endpoint `GET /sync-sessions`
6. exponer roles/permisos en `/auth/me`
7. dashboard web base + módulos navegación
8. definir separación explícita entre experiencia institución y consola superadmin
9. diseñar módulos iniciales de usuarios, permisos e instituciones para superadmin

### P1
8. exports raw/canonical/analytics
9. analytics materializados básicos
10. backfill histórico desde tablas existentes
11. auditoría de calidad de sincronización

### P2
12. anonimización para investigación
13. scheduler/queues para reproyección
14. calidad de datos y alertas operativas

---

## 10. Estructura de carpetas propuesta del proyecto web

```text
src/
  app/
    (auth)/
    (app)/
    providers.tsx
  components/
    ui/
  features/
    auth/
    dashboard/
    devices/
    games/
    syncs/
  lib/
    api/
    query-client.ts
    utils.ts
docs/
  architecture-blueprint.md
```

---

## 11. Plan de pruebas de integridad

### Backend
- test de ingestión con campos extra no mapeados
- test de ingestión por firmware vActual y firmware futuro ficticio
- test de fragmentación incompleta / completa / reorder
- test de checksum y deduplicación
- test de idempotencia exacta y semántica
- test de consistencia turn_count raw vs canonical
- test de backfill histórico
- test RBAC por rol / institución / grupo / estudiante

### Frontend
- smoke test auth
- test de parsing de responses actuales y futuras
- test de render seguro ante unknown fields
- test de tablas vacías / error / loading

### End-to-end
- firmware/app payload -> raw record -> canonical -> dashboard
- duplicado -> no duplica canonical
- fragmentos -> ensamblado correcto y auditable

---

## 12. Primer entregable implementable

Implementado en este repo:
- bootstrap Next.js
- layout principal
- auth integrada/preparada con backend existente
- navegación por roles
- dashboard inicial docente
- módulo base de sincronizaciones
- módulo base de partidas
- módulo base de dispositivos
- tipos TypeScript y API clients preparados para raw + normalized

Nueva dirección confirmada de producto:
- este frontend no será solo una vista para clientes o instituciones
- también debe funcionar como consola de superadmin para alta de usuarios, permisos, instituciones, perfiles relevantes y monitoreo global de dispositivos/sincronización
- la arquitectura y la navegación futura deben contemplar ambas capas desde el principio

Limitaciones transparentes en esta iteración:
- el backend actual aún no expone raw ingestion/query endpoints para la web
- el backend actual aún no expone roles/permisos explícitos en `/auth/me`
- el módulo de sincronizaciones usa fallback legacy a `home/sessions/history` mientras se implementa el endpoint canónico `sync-sessions`
- analytics avanzados todavía no se calculan server-side; el dashboard inicial deriva métricas básicas desde datasets visibles
