# KAWIN — Roadmap de Implementación: Sistema de Scheduling

*Versión 1.1 — 21/03/2026*

---

## Resumen ejecutivo

Este roadmap detalla la implementación del sistema de calendarización de clases recurrentes para Kawin. El diseño se basa en sesiones virtuales calculadas al vuelo desde reglas de recurrencia (schedules), con materialización bajo demanda al momento de reservar o modificar una instancia específica. Se organiza en 5 sprints incrementales de 1 semana cada uno, donde cada sprint entrega valor funcional independiente.

## Principios de arquitectura

- **Sesiones virtuales:** se computan en tiempo real desde reglas de schedule, no se pre-generan.
- **Materialización bajo demanda:** una sesión se crea en la DB solo cuando hay reserva o cancelación.
- **Schedules inmutables:** un cambio de horario cierra el schedule viejo y crea uno nuevo.
- **Corte dominical de penalización:** cada domingo se define el compromiso de la semana entrante. Cancelaciones dentro de la semana en curso penalizan al tallerista (absorbe la comisión del 15%). Cancelaciones de la semana siguiente o posterior son absorbidas por Kawin (devolución completa al estudiante). En todos los casos, recalendarizar es la opción prioritaria; la devolución es el último recurso.
- **Compatibilidad hacia atrás:** talleres tipo workshop, course y event siguen usando sesiones manuales.

---

## Sprint 1 — Fundación: schema y CRUD de schedules

*Objetivo: establecer el modelo de datos y los endpoints básicos de schedules.*

### 1.1 Migración SQL

- Crear tabla `schedules` (id, workshop_id, days_of_week, time_start, duration_min, valid_from, valid_until)
- ALTER `sessions`: agregar columnas `schedule_id` (FK nullable) y `cancelled` (boolean default false)
- ALTER `bookings`: agregar columnas `cancelled_reason` (varchar 50), `migrated_from_session_id` (FK nullable) y `commission_absorbed_by` (varchar 20, valores: `platform` | `instructor`, nullable)
- Crear índices: `idx_schedules_workshop`, `idx_sessions_schedule`, `idx_sessions_cancelled`
- Actualizar `infra/db/init.sql` para que nuevas instancias partan con el schema completo

### 1.2 Backend — handlers de schedules

Archivo nuevo: `apps/api/internal/handlers/schedules.go`

- **POST /api/v1/workshops/:id/schedules**
  - Validar que el workshop pertenece al usuario autenticado
  - Validar days_of_week (enteros 1-7), time_start (formato HH:MM), duration_min (> 0)
  - Insertar en tabla schedules y retornar el id
- **GET /api/v1/workshops/:id/schedules**
  - Retornar schedules activos (valid_until IS NULL OR valid_until >= hoy) del workshop
- **DELETE /api/v1/schedules/:id**
  - Soft delete: SET valid_until = hoy (no borrar, puede haber sesiones materializadas)

### 1.3 Backend — registrar rutas

Agregar las 3 rutas al grupo auth en `routes/routes.go`.

### 1.4 Frontend — tipos en api.ts

- Agregar interface `Schedule { id, workshop_id, days_of_week, time_start, duration_min, valid_from, valid_until }`
- Agregar `Schedule[]` al tipo Workshop (campo `schedules`, opcional)

### Entregable del sprint

*Schema migrado, endpoints CRUD de schedules funcionales y testeables con curl. No hay cambios visibles en la UI todavía.*

| Archivo | Cambio | Complejidad |
|---------|--------|-------------|
| `infra/db/init.sql` | Tabla schedules + ALTER sessions/bookings + índices | Baja |
| `apps/api/internal/handlers/schedules.go` | Nuevo: CreateSchedule, GetSchedules, DeleteSchedule | Media |
| `apps/api/internal/routes/routes.go` | 3 rutas nuevas en grupo auth | Baja |
| `apps/web/src/lib/api.ts` | Interface Schedule + campo en Workshop | Baja |

---

## Sprint 2 — Motor de sesiones virtuales

*Objetivo: que el detalle de un taller tipo class muestre sesiones calculadas desde schedules, no desde la tabla sessions.*

### 2.1 Backend — generador de sesiones virtuales (Go)

Función pura `computeUpcomingSessions(schedules, from, to, materializedSessions)` que:

- Itera cada schedule activo
- Para cada día en el rango [from, to], verifica si el día de la semana está en days_of_week
- Si la fecha cae dentro de [valid_from, valid_until] del schedule, genera una sesión virtual
- LEFT JOIN con sessions materializadas: si existe y cancelled=true, marcar como cancelada
- Retorna lista de `UpcomingSession { date, time, schedule_id, session_id?, spots_remaining?, status }`

### 2.2 Backend — actualizar GetWorkshop

- Para workshops tipo `class`: reemplazar query de sessions por llamada a `computeUpcomingSessions`
- Parámetros de rango: from = hoy, to = hoy + 8 semanas
- Query de sesiones materializadas: `SELECT * FROM sessions WHERE workshop_id = $1 AND schedule_id IS NOT NULL`
- Query de conteo de bookings por session_id para spots_remaining
- Para otros tipos (workshop, course, event): mantener el comportamiento actual sin cambios

### 2.3 Frontend — vista de sesiones en detalle del taller

- Agregar tipo `UpcomingSession` a api.ts
- En `/talleres/[slug]/page.tsx`: si `workshop.type === "class"` y hay upcoming_sessions, renderizar lista con:
  - Fecha formateada (Lun 7 Abr), hora, cupos restantes, badge de estado
  - Sesiones cancelled: mostrar tachadas o con badge "Cancelada"
  - Sesiones llenas: badge "Completo" en vez de botón Reservar
- Mantener la vista actual para tipos workshop/course/event

### Entregable del sprint

*La página de detalle de un taller tipo class muestra sesiones calculadas dinámicamente desde los schedules. Todavía no se puede reservar ni crear schedules desde la UI.*

| Archivo | Cambio | Complejidad |
|---------|--------|-------------|
| `apps/api/internal/handlers/workshops.go` | computeUpcomingSessions + integrar en GetWorkshop | Alta |
| `apps/web/src/lib/api.ts` | Tipo UpcomingSession | Baja |
| `apps/web/src/app/talleres/[slug]/page.tsx` | Render condicional sesiones virtuales | Media |

---

## Sprint 3 — Editor de schedules y reserva por sesión

*Objetivo: el tallerista puede crear schedules desde la UI y el estudiante puede reservar una sesión individual.*

### 3.1 Frontend — editor de schedules en crear/editar taller

- En `/dashboard/talleres/nuevo/page.tsx` y `[id]/editar/page.tsx`:
  - Si `type === "class"`, reemplazar la sección de sesiones manuales por editor de schedules:
    - Selector de días de la semana (checkboxes: Lun-Dom)
    - Input de hora inicio (time picker)
    - Input de duración en minutos (número)
    - Input de fecha desde / fecha hasta (opcional)
    - Botón "+ Agregar franja horaria" para múltiples schedules
  - Para otros tipos: mantener el editor de sesiones manuales actual
- Al guardar: POST `/api/v1/workshops/:id/schedules` por cada schedule nuevo

### 3.2 Backend — endpoint de reserva con materialización

Archivo nuevo: `apps/api/internal/handlers/bookings.go`

- **POST /api/v1/bookings**
  - Input: `{ workshop_id, schedule_id, date }` para clases, `{ workshop_id }` para otros tipos
  - Transacción PostgreSQL:
    - Validar que schedule genera sesión para esa fecha (día de semana correcto, dentro de rango válido)
    - SELECT o INSERT session (ON CONFLICT DO NOTHING) → obtener session_id
    - Verificar cancelled = false
    - COUNT bookings confirmados para esa session → si >= capacity, rechazar
    - INSERT booking con amount = workshop.price, commission = amount * 0.15

### 3.3 Frontend — botón Reservar por sesión

- En detalle del taller (tipo class): cada sesión available muestra botón "Reservar esta clase"
- onClick: POST `/api/v1/bookings` con schedule_id + date
- Feedback: toast de confirmación + actualizar spots_remaining
- Requiere autenticación: si no hay token, redirigir a /login

### 3.4 Backend — registrar rutas de bookings

POST `/api/v1/bookings` en grupo auth de `routes.go`.

### Entregable del sprint

*Flujo completo funcional: tallerista crea schedules → estudiante ve sesiones → reserva una sesión puntual. Primera versión end-to-end del scheduling.*

| Archivo | Cambio | Complejidad |
|---------|--------|-------------|
| `apps/web/.../nuevo/page.tsx` | Editor de schedules condicional por tipo | Media |
| `apps/web/.../[id]/editar/page.tsx` | Mismo editor de schedules | Media |
| `apps/api/.../handlers/bookings.go` | Nuevo: CreateBooking con materialización | Alta |
| `apps/web/.../talleres/[slug]/page.tsx` | Botón reservar por sesión + lógica auth | Media |
| `apps/api/.../routes/routes.go` | Ruta POST /bookings | Baja |

---

## Sprint 4 — Cambio de horario + migración/devolución

*Objetivo: el tallerista puede cambiar un schedule existente y gestionar las reservas afectadas.*

### 4.1 Backend — update de schedule (cerrar viejo + crear nuevo)

- **PUT /api/v1/schedules/:id**
  - Input: `{ days_of_week, time_start, duration_min, change_date }`
  - Lógica:
    - UPDATE schedules SET valid_until = change_date - 1 WHERE id = $old
    - INSERT nuevo schedule con valid_from = change_date
    - Retornar `{ old_schedule_id, new_schedule_id, affected_bookings[] }`
- **GET /api/v1/schedules/:id/affected-bookings**
  - Query: bookings con session.schedule_id = $old AND session.starts_at >= change_date AND status != cancelled
  - Retornar lista con: booking_id, student_name, session_date, session_time, can_migrate (bool)

### 4.2 Backend — migración y devolución

- **POST /api/v1/bookings/:id/migrate**
  - Input: `{ target_schedule_id, target_date }`
  - Materializar sesión destino si no existe
  - Verificar capacidad del destino
  - UPDATE booking: session_id = target, migrated_from_session_id = old session_id
- **POST /api/v1/bookings/:id/refund**
  - Calcular corte dominical: `cutoff_sunday = session_date - ((session_date.weekday() - sunday) % 7)`. Si la fecha de cancelación (`now`) es `>= cutoff_sunday` (sesión cae en la semana en curso), entonces `commission_absorbed_by = 'instructor'`. Si `now < cutoff_sunday` (sesión es de la semana siguiente o posterior), entonces `commission_absorbed_by = 'platform'`.
  - UPDATE booking: status = cancelled, payment_status = refunded, cancelled_reason = schedule_change, commission_absorbed_by = valor calculado
  - En ambos casos el estudiante recibe devolución del 100%. La diferencia es contable: Kawin descuenta el 15% del próximo pago al tallerista (instructor) o lo absorbe (platform).
- **POST /api/v1/schedules/:id/bulk-action**
  - Input: `{ action: "migrate_all" | "refund_all", new_schedule_id }`
  - Ejecutar acción para todos los bookings afectados en una transacción

### 4.3 Frontend — pantalla de reservas afectadas

- Al editar un schedule desde el dashboard, si hay reservas afectadas:
  - Mostrar diálogo modal con la lista de reservas
  - Indicar claramente la zona de penalización: las reservas de la semana en curso muestran badge "Comisión a tu cargo" y las de semanas futuras muestran "Sin cargo"
  - Por cada reserva: radio buttons [Migrar | Devolver]
  - Botones bulk: "Migrar todas" (primario), "Devolver todas" (secundario)
  - Al confirmar: ejecutar acciones y mostrar resumen con desglose de comisiones absorbidas

### Entregable del sprint

*El tallerista puede cambiar horarios de clases recurrentes y gestionar las reservas afectadas con migración o devolución, todo desde la UI.*

| Archivo | Cambio | Complejidad |
|---------|--------|-------------|
| `apps/api/.../handlers/schedules.go` | UpdateSchedule + GetAffectedBookings | Alta |
| `apps/api/.../handlers/bookings.go` | MigrateBooking, RefundBooking, BulkAction | Alta |
| `apps/web/.../[id]/editar/page.tsx` | Modal de reservas afectadas | Alta |
| `apps/api/.../routes/routes.go` | 5 rutas nuevas | Baja |

---

## Sprint 5 — Cancelación de instancias + panel de reservas

*Objetivo: el tallerista puede cancelar fechas específicas y ver todas sus reservas. El estudiante ve sus propias reservas.*

### 5.1 Backend — cancelar instancia específica

- **POST /api/v1/sessions/cancel**
  - Input: `{ schedule_id, date }`
  - Materializar la sesión si no existe → SET cancelled = true
  - Si hay bookings en esa sesión:
    - Aplicar regla de corte dominical: calcular `cutoff_sunday` de la sesión. Si `now >= cutoff_sunday` → `commission_absorbed_by = 'instructor'` (penalización). Si `now < cutoff_sunday` → `commission_absorbed_by = 'platform'` (Kawin absorbe).
    - Marcar bookings como cancelled con cancelled_reason = instructor_cancel y commission_absorbed_by según el cálculo
    - El estudiante siempre recibe devolución del 100%

### 5.2 Backend — panel de reservas del tallerista

- **GET /api/v1/my-bookings**
  - Lista de reservas para todos los workshops del tallerista autenticado
  - Incluir: student name, workshop title, session date/time, status, amount
  - Filtros opcionales: `?workshop_id=`, `?status=`, `?from=`, `?to=`

### 5.3 Backend — reservas del estudiante

- **GET /api/v1/bookings**
  - Lista de reservas del estudiante autenticado
  - Incluir: workshop title, session date/time, status, amount

### 5.4 Frontend — vista de reservas en dashboard tallerista

- Nueva sección en /dashboard: tabla de reservas recientes
- Cada fila: estudiante, taller, fecha/hora de la sesión, estado, monto
- Link a las sesiones desde cada reserva

### 5.5 Frontend — cancelación de instancia desde la UI

- En la vista de detalle del taller (modo instructor): botón "Cancelar esta clase" por sesión
- Confirmación modal con información de penalización:
    - Si la sesión es de la semana en curso: "¿Cancelar la clase del [fecha]? Se notificará a N estudiantes. La comisión de $X será descontada de tu próximo pago."
    - Si la sesión es de la semana siguiente+: "¿Cancelar la clase del [fecha]? Se notificará a N estudiantes. No se aplicará cargo."
  - Ofrecer "Recalendarizar" como botón primario y "Cancelar y devolver" como secundario
- Ejecutar POST /sessions/cancel y refrescar la lista

### Entregable del sprint

*Sistema de scheduling completo: crear schedules, reservar sesiones, cambiar horarios con gestión de afectados, cancelar fechas puntuales, y visibilidad de reservas para ambos lados (tallerista y estudiante).*

| Archivo | Cambio | Complejidad |
|---------|--------|-------------|
| `apps/api/.../handlers/sessions.go` | Nuevo: CancelSession | Media |
| `apps/api/.../handlers/bookings.go` | GetMyBookings (tallerista), GetBookings (estudiante) | Media |
| `apps/web/.../dashboard/page.tsx` | Sección de reservas recientes | Media |
| `apps/web/.../talleres/[slug]/page.tsx` | Botón cancelar instancia (modo instructor) | Baja |

---

## Vista general de sprints

| Sprint | Foco | Entregable clave | Riesgo |
|--------|------|-------------------|--------|
| 1 | Schema + CRUD schedules | Migración SQL + endpoints testables con curl | Bajo |
| 2 | Motor de sesiones virtuales | Detalle de taller muestra sesiones desde schedules | Medio: lógica de cómputo en Go |
| 3 | Editor + reserva por sesión | Flujo end-to-end funcional | Medio: materialización atómica |
| 4 | Cambio de horario + migración | Gestión de reservas afectadas | Alto: transacciones complejas + UI modal |
| 5 | Cancelación + panel reservas | Sistema completo | Bajo |

## Dependencias entre sprints

Cada sprint depende del anterior. No se pueden paralelizar.

- Sprint 1 → Sprint 2: el motor de sesiones virtuales necesita la tabla schedules
- Sprint 2 → Sprint 3: el editor y la reserva necesitan que el detalle muestre sesiones
- Sprint 3 → Sprint 4: la migración de bookings necesita que existan bookings
- Sprint 4 → Sprint 5: la cancelación de instancias y el panel cierran el ciclo

## Fuera de alcance (Fase 3)

- Integración con MercadoPago para cobros y reembolsos reales
- Suscripciones y packs de clases (reserva recurrente)
- Notificaciones por email (Resend) al migrar/devolver/cancelar
- Reviews y calificaciones post-sesión
- Sincronización con Google Calendar / Outlook

## Política de comisión en cancelaciones (definida)

El corte es el **domingo fijo**. Cada domingo se establece el compromiso de sesiones para la semana entrante (lunes a domingo).

- **Cancelación dentro de la semana en curso** (el domingo ya pasó): el tallerista absorbe la comisión del 15%. Kawin descuenta ese monto del próximo pago al tallerista. El estudiante recibe devolución del 100%.
- **Cancelación de la semana siguiente o posterior** (el domingo aún no llegó): Kawin absorbe la comisión y devuelve el 100% al estudiante. El tallerista no recibe penalización.
- **Prioridad de recalendarización:** en ambos casos, antes de ejecutar la devolución se debe ofrecer al tallerista la opción de migrar las reservas afectadas a otra sesión. La devolución es siempre el último recurso.
- **El domingo cuenta como semana en curso** (el compromiso ya fue generado ese día).

Campo en DB: `bookings.commission_absorbed_by` con valores `'instructor'` (Zona A) o `'platform'` (Zona B).
