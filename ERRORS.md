# ERRORS.md — Registro de errores y resoluciones

---

## ✅ RESUELTO — Gin wildcard conflict al iniciar el API

**Fecha:** 2026-03-27
**Rama:** `feat/sprint-1-2-scheduling`

### Error

```
panic: ':id' in new path '/api/v1/workshops/:id/schedules' conflicts
with existing wildcard ':slug' in existing prefix '/api/v1/workshops/:slug'
```

El API no podía iniciar. Gin no permite dos nombres de wildcard distintos en el mismo segmento de ruta.

### Causa

Al agregar las rutas de Sprint 1:
```go
auth.POST("/workshops/:id/schedules", handlers.CreateSchedule)
auth.GET("/workshops/:id/schedules", handlers.GetSchedules)
```
...chocaban con la ruta pública existente:
```go
v1.GET("/workshops/:slug", handlers.GetWorkshop)
```
Gin trata `:slug` y `:id` como wildcards distintos en la misma posición → panic.

### Solución

Renombrar la ruta pública de `:slug` a `:id`:
```go
// antes
v1.GET("/workshops/:slug", handlers.GetWorkshop)

// después
v1.GET("/workshops/:id", handlers.GetWorkshop)
```
Actualizar el handler para usar `c.Param("id")` y hacer que la query acepte tanto UUID como slug:
```sql
WHERE (w.id::text = $1 OR w.slug = $1)
```
Esto preserva la compatibilidad con el frontend que usa slugs en las URLs.

---

## ✅ RESUELTO — Duplicate function `itoa` en el mismo package

**Fecha:** 2026-03-27
**Rama:** `dev` (commit directo)

### Error

Go compile error: `itoa redeclared in this block` — la función estaba definida tanto en `workshops.go` como en `bookings.go`.

### Solución

Eliminar la definición duplicada de `bookings.go`. La función está en `workshops.go` y es accesible a todo el package `handlers`.

También eliminar el import de `strconv` que quedó huérfano en `bookings.go`.

---

## ✅ RESUELTO — NULL session_id en MigrateBooking y RefundBooking

**Fecha:** 2026-03-27
**Rama:** `fix/null-session-id-scan`

### Error

Para bookings de tipo `workshop`/`course`/`event` (no-class), `session_id` es NULL en la DB. Al scan-ear como `string` (no nullable) → runtime error en pgx.

En `RefundBooking`: `JOIN sessions` fallaba para bookings sin sesión.

### Solución

- `MigrateBooking`: cambiar `var oldSessionID string` → `var oldSessionID *string`
- `RefundBooking`: cambiar `JOIN sessions` → `LEFT JOIN sessions` + `COALESCE(starts_at, '')` + valor default de `sessionDate = time.Now()` para no-class bookings.

---

## ✅ RESUELTO — Hydration mismatch en UpcomingSessionCard

**Fecha:** 2026-03-27
**Rama:** `fix/hydration-instructor-check`

### Error

`UpcomingSessionCard` calculaba `isInstructor` leyendo `localStorage` directamente en el render (IIFE). En SSR `typeof window === "undefined"`, lo que podía causar diferencias entre el HTML del servidor y el cliente → React hydration warning.

### Solución

Mover el check a `useEffect + useState`:
```tsx
const [isInstructor, setIsInstructor] = useState(isInstructorProp);
useEffect(() => {
  // leer localStorage solo en cliente
  const user = JSON.parse(localStorage.getItem("user") ?? "{}");
  setIsInstructor(user?.id === instructorId);
}, [instructorId, isInstructorProp]);
```

---

## ✅ RESUELTO — UpdateWorkshop borraba sesiones materializadas

**Fecha:** 2026-03-27
**Rama:** `fix/crud-improvements`

### Error

`UpdateWorkshop` hacía `DELETE FROM sessions WHERE workshop_id = $1` eliminando también las sesiones materializadas de workshops tipo `class` que podían tener bookings activos.

### Solución

Filtrar para eliminar solo sesiones manuales (sin schedule):
```sql
DELETE FROM sessions WHERE workshop_id = $1 AND schedule_id IS NULL
```

---

## 🔶 PENDIENTE — `session_id` en URL de `/talleres/[slug]` no normalizado

**Estado:** Conocido, baja prioridad
**Descripción:** La ruta pública usa `slug` como identificador visible en URL pero el parámetro interno del router se llama `id`. El nombre en la URL no cambió (`/talleres/acuarela-principiantes` sigue funcionando) pero puede confundir si alguien lee las rutas del router sin contexto.

**Solución propuesta:** Renombrar el directorio `[slug]` a `[id]` en el frontend o agregar un comentario en routes.go explicando que `:id` acepta tanto UUID como slug.

---

## 🔶 PENDIENTE — `instructor_id` no expuesto en `GetMyWorkshop`

**Estado:** Conocido, baja prioridad
**Descripción:** `GET /api/v1/my-workshops/:id` (endpoint protegido para el propio tallerista) no retorna `instructor_id` en el JSON. No es necesario porque el caller ya lo es, pero podría ser útil para el frontend en contextos donde se reutilice el tipo `Workshop`.

---

## 🔶 PENDIENTE — Panel de reservas sin paginación

**Estado:** Conocido, funcional con límite de 100
**Descripción:** `GET /api/v1/instructor-bookings` retorna hasta 100 resultados sin paginación. Para talleristas con muchas reservas esto puede ser insuficiente.

**Solución propuesta:** Agregar `?page=&limit=` o cursor-based pagination en el endpoint.

---

## 🔶 PENDIENTE — `isInstructor` en sidebar de `/talleres/[slug]`

**Estado:** TODO en código
**Descripción:** `talleres/[slug]/page.tsx` pasa `instructorId={workshop.instructor_id}` a `UpcomingSessionCard`. El botón "Cancelar esta clase" aparece correctamente cuando el usuario logueado es el instructor. Sin embargo, el sidebar "Reservar cupo" (`BookingButton`) no verifica si el user es instructor — un instructor podría reservar su propia clase.

**Solución propuesta:** En `BookingButton`, verificar si `localStorage user.id === workshop.instructor_id` y ocultar el botón si es así.
