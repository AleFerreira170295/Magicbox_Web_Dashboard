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
3. Ir a `Instituciones`.
4. Abrir `Praecepta Education`.
5. Verificar:
   - summary institucional
   - previews de usuarios
   - previews de dispositivos
   - previews de grupos
6. Ir a `Dispositivos`.
7. Verificar:
   - tabla operativa con institución, owner y status
   - selección de detalle operativo
   - metadata cruda por dispositivo

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

Campos esperados por item en este slice:

- `educational_center_name`
- `owner_user_id`
- `owner_user_name`
- `owner_user_email`
- `firmware_version`
- `status`
- `device_metadata`

## Cuándo usar esta ruta

Usarla como smoke test después de cambios en:

- auth/login o payload de `/auth/me`
- ACL y scoping de instituciones
- seeds QA
- listado/detalle de instituciones
- previews de usuarios/dispositivos/grupos
- UX del dashboard en `Instituciones`
- contrato y pantalla de `Dispositivos`
