# CLAUDE.md

Guía de contexto para Claude Code al trabajar en este repositorio.

## Proyecto

**Kawin** — marketplace de talleres, cursos y clases recurrentes. Monorepo con:

| Sub-proyecto | Tech | Ubicación |
|---|---|---|
| API backend | Go 1.22 + Gin + pgx | `apps/api/` |
| Frontend web | Next.js 14 + React + TypeScript + Tailwind | `apps/web/` |
| Infraestructura | PostgreSQL 16 + Docker Compose | `infra/` |

---

## Comandos

### Levantar todo (Docker)
```bash
docker compose up --build     # API en :8080, Web en :3000, DB en :5432
docker compose down -v        # Borrar contenedores y volúmenes
```

### Backend (Go) — sin Docker
```bash
cd apps/api
go mod tidy
go run cmd/main.go            # Puerto 8080
```

### Frontend (Next.js) — sin Docker
```bash
cd apps/web
npm install
npm run dev                   # Puerto 3000
npm run build
npm run lint
```

---

## Arquitectura del backend

```
apps/api/
├── cmd/main.go                    # Entry point
├── internal/
│   ├── config/                    # Vars de entorno
│   ├── db/                        # Pool pgx
│   ├── middleware/auth.go         # JWT middleware
│   ├── routes/routes.go           # Registro de rutas
│   └── handlers/
│       ├── auth.go                # Register, Login
│       ├── categories.go          # GetCategories
│       ├── workshops.go           # GetWorkshops, GetWorkshop + motor sesiones virtuales
│       ├── workshops_write.go     # CreateWorkshop, UpdateWorkshop, DeleteWorkshop, GetMyWorkshop/s
│       ├── schedules.go           # CRUD schedules + UpdateSchedule + BulkAction
│       ├── bookings.go            # CreateBooking, GetMyBookings, GetInstructorBookings, MigrateBooking, RefundBooking
│       └── sessions.go            # CancelSession
```

### Rutas API

**Públicas**
| Método | Ruta | Handler |
|--------|------|---------|
| GET | /health | — |
| GET | /api/v1/categories | GetCategories |
| GET | /api/v1/workshops | GetWorkshops |
| GET | /api/v1/workshops/:id | GetWorkshop (acepta UUID o slug) |
| POST | /api/v1/auth/register | Register |
| POST | /api/v1/auth/login | Login |

**Protegidas (Bearer JWT)**
| Método | Ruta | Handler |
|--------|------|---------|
| GET | /api/v1/my-workshops | GetMyWorkshops |
| GET | /api/v1/my-workshops/:id | GetMyWorkshop |
| POST | /api/v1/workshops | CreateWorkshop |
| PUT | /api/v1/workshops/:id | UpdateWorkshop |
| DELETE | /api/v1/workshops/:id | DeleteWorkshop (soft-archive) |
| POST | /api/v1/workshops/:id/schedules | CreateSchedule |
| GET | /api/v1/workshops/:id/schedules | GetSchedules |
| PUT | /api/v1/schedules/:id | UpdateSchedule |
| DELETE | /api/v1/schedules/:id | DeleteSchedule (soft-delete) |
| GET | /api/v1/schedules/:id/affected-bookings | GetAffectedBookings |
| POST | /api/v1/schedules/:id/bulk-action | BulkAction |
| POST | /api/v1/bookings | CreateBooking |
| GET | /api/v1/my-bookings | GetMyBookings (estudiante) |
| GET | /api/v1/instructor-bookings | GetInstructorBookings (tallerista) |
| POST | /api/v1/bookings/:id/migrate | MigrateBooking |
| POST | /api/v1/bookings/:id/refund | RefundBooking |
| POST | /api/v1/sessions/cancel | CancelSession |

---

## Arquitectura del frontend

```
apps/web/src/
├── app/
│   ├── (auth)/login, registro    # Páginas de autenticación
│   ├── buscar/                   # Búsqueda pública de talleres
│   ├── talleres/[slug]/          # Detalle taller (server component)
│   │   ├── page.tsx
│   │   ├── BookingButton.tsx     # Client: botón reservar sidebar
│   │   └── UpcomingSessionCard.tsx  # Client: card por sesión (reservar/cancelar)
│   ├── dashboard/                # Panel del tallerista
│   │   ├── page.tsx
│   │   ├── reservas/page.tsx     # Panel completo de reservas
│   │   └── talleres/
│   │       ├── nuevo/page.tsx    # Crear taller
│   │       └── [id]/editar/
│   │           ├── page.tsx      # Editar taller
│   │           └── AffectedBookingsModal.tsx  # Modal cambio horario
│   └── mis-reservas/page.tsx     # Reservas del estudiante
├── components/
│   ├── layout/navbar.tsx         # Navegación principal
│   └── ui/                       # shadcn/ui components
└── lib/api.ts                    # Cliente HTTP + tipos TypeScript
```

---

## Modelo de datos clave

- **workshops**: tipo (`workshop` | `course` | `class` | `event`), modality, price, capacity
- **schedules**: regla de recurrencia para `type=class` — days_of_week[], time_start, duration_min, valid_from/until
- **sessions**: instancias (manuales o materializadas desde schedule). UNIQUE(workshop_id, schedule_id, starts_at)
- **bookings**: reservas — status, payment_status, commission (15%), commission_absorbed_by, cancelled_reason, migrated_from_session_id

### Tipos de workshop y su flujo de sesiones

| Tipo | Sesiones | Reserva |
|------|----------|---------|
| `class` | Virtuales (calculadas desde schedules) | Por sesión individual (schedule_id + date) |
| `workshop` / `course` / `event` | Manuales (tabla sessions) | Directa al workshop |

### Lógica de comisiones en cancelaciones

- Corte: **domingo** de la semana en curso
- Si `now >= cutoff_sunday` → `commission_absorbed_by = 'instructor'` (penalización)
- Si `now < cutoff_sunday` → `commission_absorbed_by = 'platform'` (Kawin absorbe)
- Estudiante siempre recibe devolución 100%

---

## Usuarios de prueba

| Email | Password | Rol |
|-------|----------|-----|
| maria@kawin.app | test1234 | instructor |
| carlos@kawin.app | test1234 | student |

---

## ROADMAP

Ver `ROADMAP_SCHEDULING.md` para el plan de sprints del sistema de scheduling.
Estado actual: **Sprints 1-5 completos** en rama `dev`.
