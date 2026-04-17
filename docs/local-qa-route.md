# Local QA Route

Ruta base de prueba para desarrollo cruzado entre dashboard y backend local.

## Servicios locales

- Backend API: `http://127.0.0.1:3000`
- Dashboard web: `http://127.0.0.1:3001`
- Login web: `http://127.0.0.1:3001/login`

## Usuario QA principal

- Email: `paula.control.demo@example.com`
- Password: `DemoSeed2026!`
- Rol esperado: `admin`
- Institución esperada: `Praecepta Education`

## Ruta UI principal

1. Abrir `http://127.0.0.1:3001/login`
2. Iniciar sesión con el usuario QA principal.
3. Ir a `Dashboard`.
4. Verificar:
   - resumen operativo real de usuarios, instituciones, devices, syncs, games y health
   - accesos rápidos a módulos ya aterrizados
   - foco de revisión con señales blandas (instituciones con review, devices sin estado, syncs sin raw, profiles sin binding)
   - la home debe respetar el rol real: ocultar módulos no accesibles para `institution-admin` o `director`
5. Ir a `Instituciones`.
6. Abrir `Praecepta Education`.
7. Verificar:
   - summary institucional
   - previews de usuarios
   - previews de dispositivos
   - previews de grupos
8. Ir a `Dispositivos`.
9. Verificar:
   - tabla operativa con institución, owner y status
   - selección de detalle operativo
   - metadata cruda por dispositivo
10. Ir a `Syncs`.
11. Verificar:
   - tabla operativa con sesiones visibles para dashboard
   - selección de detalle de sync
   - payload raw más reciente y participantes proyectados
   - copy de alcance visible coherente con permisos reales (`historial personal` vs `operativo por ACL BLE`)
12. Ir a `Partidas`.
13. Verificar:
   - métricas operativas de partidas, jugadores y turnos
   - filtro por institución y modo de jugadores
   - panel de detalle con últimos turnos y composición manual/registrada
   - si la sesión queda scopeada a una sola institución, la UI debe anclar el filtro institucional y mostrar badge de alcance
14. Ir a `Profiles`.
15. Verificar:
   - listado real de perfiles Home, no usuarios proxy
   - owner, institución, bindings y sesiones por perfil
   - panel de detalle con tarjetas y dispositivos vinculados
   - si la sesión queda scopeada a una sola institución, la UI debe anclar el filtro institucional y mostrar badge de alcance
16. Ir a `Health`.
17. Verificar:
   - estado real de `/health`, `/health/ready` y `/health/live`
   - checks técnicos de readiness
   - síntesis operativa combinando dispositivos, syncs, games y profiles
   - banner explícito de que es una superficie `admin global`, no una vista institucional
18. Ir a `Settings`.
19. Verificar:
   - runtime real del backend y entorno actual
   - catálogo ACL real de features y actions
   - política OTA efectiva leída desde backend
   - banner explícito de que es una superficie `admin global`, no una vista institucional

## Estado esperado actual de `Praecepta Education`

### Summary

- `user_count`: `18`
- `device_count`: `3`
- `class_group_count`: `6`
- `student_count`: `72`
- `needs_review`: `false`

### Usuarios esperados en preview

- `Paula Control` → `admin` → `web`
- `Nicolás Bianchi` → `researcher` → `web`
- `Julieta Sosa` → `researcher` → `web`
- `Tomás Méndez` → `family` → `mobile`
- `Sofía Cabrera` → `family` → `mobile`

### Dispositivos esperados en preview

- `Puma393` → `14335C8BD462`
- `Zorro748` → `A85B00D6CDC0`
- `Lince270` → `745A00D6CDC0`

### Grupos esperados en preview

- `Quinto B` → `quinto_b` → `12 estudiantes`
- `Quinto A` → `quinto_a` → `12 estudiantes`
- `Cuarto B` → `cuarto_b` → `12 estudiantes`
- `Cuarto A` → `cuarto_a` → `12 estudiantes`
- `Tercero B` → `tercero_b` → `12 estudiantes`

## Verificación API rápida

### Login

```bash
curl -X POST http://127.0.0.1:3000/api/v1.0/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"paula.control.demo@example.com","password":"DemoSeed2026!"}'
```

### Listado de instituciones

```bash
TOKEN="<pegar access_token>"
curl http://127.0.0.1:3000/api/v1.0/educational-center \
  -H "Authorization: Bearer $TOKEN"
```

### Detalle con preview enriquecido

```bash
TOKEN="<pegar access_token>"
CENTER_ID="0ec2809c-8862-477e-8097-18b3a448a2cd"
curl http://127.0.0.1:3000/api/v1.0/educational-center/$CENTER_ID \
  -H "Authorization: Bearer $TOKEN"
```

### Listado de dispositivos enriquecido

```bash
TOKEN="<pegar access_token>"
curl http://127.0.0.1:3000/api/v1.0/ble-device \
  -H "Authorization: Bearer $TOKEN"
```

### Patch operativo de dispositivo

```bash
TOKEN="<pegar access_token>"
DEVICE_ID="<pegar id>"
curl -X PATCH http://127.0.0.1:3000/api/v1.0/ble-device/$DEVICE_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"<nombre>","status":"active"}'
```

Campos esperados por item en este slice:

- `assignment_scope` (`home` | `institution`)
- `educational_center_name`
- `owner_user_id`
- `owner_user_name`
- `owner_user_email`
- `firmware_version`
- `status`
- `device_metadata`

Semántica esperada:

- si `assignment_scope = "home"`, el dispositivo debe tratarse como Home y no como dato faltante
- en la UI `Dispositivos`, los casos Home deben verse con badge `Home` y copy explícito de que no requieren centro educativo
- la pantalla debe permitir editar nombre, owner, firmware, status y alcance (Home/institución) cuando el backend lo autoriza

### Listado operativo de partidas

```bash
TOKEN="<pegar access_token>"
curl 'http://127.0.0.1:3000/api/v1.0/game-data/?page=1&limit=5&sort_by=created_at&order=desc' \
  -H "Authorization: Bearer $TOKEN"
```

Campos esperados por item en este slice:

- `game_id`
- `deck_name`
- `educational_center_id`
- `ble_device_id`
- `players`
- `turns`
- `start_date`

Semántica esperada:

- la UI `Partidas` debe permitir filtrar por institución y composición de jugadores (registrados, manuales o mixtos)
- la tabla debe enriquecer contexto mostrando institución y dispositivo a partir de los catálogos ya cargados en dashboard
- el panel de detalle debe resumir jugadores, turnos recientes y tasa de éxito sin depender de inspección raw
- cuando solo haya una institución visible, la UI debe anclar el filtro y explicitar el alcance institucional

### Home operativa del dashboard

Semántica esperada en este slice:

- `/dashboard` ya no debe hablar de módulos "próximos" que hoy ya existen
- debe resumir datos reales de users, institutions, devices, syncs, games, profiles y health
- institution-admin y director deben caer en esta home operativa, no en la home docente
- la home debe ocultar módulos no accesibles según el rol real, en línea con la navegación lateral
- institution-admin no debe depender de queries globales de health desde esta home

### Settings read-only con configuración efectiva

```bash
curl http://127.0.0.1:3000/health

TOKEN="<pegar access_token>"
curl http://127.0.0.1:3000/api/v1.0/home/ota/release \
  -H "Authorization: Bearer $TOKEN"
```

Campos esperados en este slice:

- `health`: `status`, `service`, `version`, `environment`
- `ota`: `channel`, `configured`, `latest_version`, `mandatory`, `minimum_supported_version`
- dashboard: catálogos ACL desde `/feature` y `/access-control/action`

Semántica esperada:

- `Settings` debe mostrar configuración efectiva real aunque todavía no exista editor persistente
- la UI debe explicar runtime, readiness, OTA y catálogos ACL usando datos vivos del backend
- si OTA no está configurado, debe verse explícitamente como estado válido y no como error de pantalla
- la pantalla debe dejar claro que se trata de una superficie global-only para admin

### Health técnico real del backend

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/health/ready
curl http://127.0.0.1:3000/health/live
```

Campos esperados en este slice:

- `/health`: `status`, `service`, `version`, `environment`, `timestamp`
- `/health/ready`: `status`, `checks`, `service`, `version`, `environment`, `timestamp`
- `/health/live`: `status`, `uptime`, `service`, `version`, `timestamp`

Semántica esperada:

- la pantalla `Health` debe usar los endpoints de health reales del backend, no solo inferencias desde otros módulos
- la UI debe combinar ese estado técnico con señales operativas ya visibles en dashboard
- readiness degradado o checks no saludables deben verse como primera señal de alerta blanda
- la pantalla debe dejar claro que se trata de una superficie global-only para admin

### Listado operativo de perfiles Home

```bash
TOKEN="<pegar access_token>"
curl 'http://127.0.0.1:3000/api/v1.0/home/profiles/overview' \
  -H "Authorization: Bearer $TOKEN"
```

Campos esperados por item en este slice:

- `display_name`
- `user_name`
- `user_email`
- `educational_center_id`
- `educational_center_name`
- `binding_count`
- `active_binding_count`
- `card_uids`
- `bound_devices`
- `session_count`
- `last_session_at`

Semántica esperada:

- `Profiles` debe usar perfiles Home reales y no reutilizar el padrón `/user` como proxy
- sin ACL global/scoped de `user:read`, el overview debe caer a perfiles propios del actor autenticado
- con ACL global/scoped de `user:read`, el overview debe abrirse a visibilidad operativa respetando alcance institucional cuando corresponda
- cuando solo haya una institución visible, la UI debe anclar el filtro y explicitar el alcance institucional

### Listado operativo de syncs

```bash
TOKEN="<pegar access_token>"
curl 'http://127.0.0.1:3000/api/v1.0/sync-sessions?page=1&limit=5' \
  -H "Authorization: Bearer $TOKEN"
```

Campos esperados por item en este slice:

- `user_id`
- `sync_id`
- `ble_device_id`
- `device_id`
- `firmware_version`
- `raw_record_count`
- `participants`
- `raw_payload`

Semántica esperada:

- si el actor tiene permisos globales sobre `ble_device:read`, `GET /sync-sessions` debe comportarse como vista operativa amplia y no solo como historial propio
- si el actor solo tiene alcance institucional, la lista debe quedar limitada a syncs de dispositivos dentro de sus instituciones permitidas
- si el actor no tiene `ble_device:read`, la UI debe reconocer el modo `historial personal` y no prometer visibilidad operativa amplia
- la UI `Syncs` debe permitir buscar por sync, dispositivo, origen o usuario y mostrar un panel de detalle con participantes y raw reciente

## Cuándo usar esta ruta

Usarla como smoke test después de cambios en:

- auth/login o payload de `/auth/me`
- ACL y scoping de instituciones
- seeds QA
- listado/detalle de instituciones
- previews de usuarios/dispositivos/grupos
- UX del dashboard en `Instituciones`
- contrato, edición mínima y pantalla de `Dispositivos`
- visibilidad operativa y pantalla de `Syncs`
- pantalla operativa de `Partidas`
- vista operativa real de `Profiles`
- dashboard técnico-operativo de `Health`
- centro read-only real de `Settings`
- home operativa real de `/dashboard`
