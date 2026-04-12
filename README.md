# Kawin

Marketplace de talleres, cursos y clases que conecta talleristas con estudiantes en América Latina.

---

## Stack

| Capa | Tecnología |
|---|---|
| Web | Next.js 15 (App Router) + React 19 + TypeScript + Tailwind + shadcn/ui |
| API | Go 1.24 + Gin + pgx/v5 + JWT |
| Base de datos | PostgreSQL 16 |
| Cache | Redis 7 |
| Dev | Docker Compose + Turborepo |

Estructura del monorepo:

```
kawin_web_2/
├── apps/
│   ├── web/          # Next.js frontend (puerto 3000)
│   └── api/          # Go backend (puerto 8080)
├── infra/
│   └── db/           # Schema SQL + seeds
└── docker-compose.yml
```

---

## Requisitos previos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado y corriendo
- Git

No necesitas tener Node.js, Go ni PostgreSQL instalados localmente — Docker lo maneja todo.

---

## Levantar el proyecto

### 1. Clonar el repositorio

```bash
git clone https://github.com/pedrodonoso/kawin_web_2.git
cd kawin_web_2
```

### 2. Levantar los contenedores

```bash
docker compose up -d
```

Esto levanta cuatro servicios:

| Servicio | URL | Descripción |
|---|---|---|
| Web | http://localhost:3000 | Frontend Next.js |
| API | http://localhost:8080 | Backend Go |
| PostgreSQL | localhost:5432 | Base de datos |
| Redis | localhost:6379 | Cache |

La base de datos se inicializa automáticamente con el schema y las categorías seed.

### 3. Cargar datos de prueba (opcional)

```bash
# Seed de 12 talleres con descripciones completas
docker compose exec db psql -U kawin -d kawin -f /dev/stdin < infra/db/seed_workshops.sql

# Seed de sesiones para los talleres
docker compose exec db psql -U kawin -d kawin -f /dev/stdin < infra/db/seed_sessions.sql
```

### 4. Verificar que todo funcione

```bash
curl http://localhost:8080/health
# → {"status":"ok","service":"kawin-api"}
```

---

## Variables de entorno

Los valores por defecto funcionan para desarrollo local. No necesitas crear ningún archivo `.env` para empezar.

Si quieres personalizar, crea un archivo `.env` en `apps/api/`:

```env
PORT=8080
DATABASE_URL=postgres://kawin:kawin@db:5432/kawin?sslmode=disable
REDIS_URL=redis://redis:6379
API_SECRET=dev-secret-change-in-prod
GO_ENV=development
```

Y en `apps/web/` crea `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
API_INTERNAL_URL=http://api:8080
```

---

## Comandos útiles

```bash
# Ver logs en tiempo real
docker compose logs web -f    # Next.js
docker compose logs api -f    # Go

# Reiniciar un servicio (útil al cambiar código Go)
docker compose restart api

# Detener todos los servicios
docker compose down

# Detener y borrar volúmenes (resetea la DB)
docker compose down -v
```

---

## Usuarios de prueba

Todos tienen contraseña `test1234` y rol `instructor`:

| Email | Nombre |
|---|---|
| maria@kawin.app | María González |
| carlos@kawin.app | Carlos Rodríguez |
| rodrigo@kawin.app | Rodrigo Muñoz |
| ana@kawin.app | Ana Torres |
| tomas@kawin.app | Tomás Herrera |
| sofia@kawin.app | Sofía Vargas |
| jorge@kawin.app | Jorge Castillo |
| camila@kawin.app | Camila Reyes |
| pablo@kawin.app | Pablo Soto |

---

## Rutas disponibles

| Ruta | Descripción |
|---|---|
| `/` | Landing con buscador |
| `/buscar` | Explorar talleres con filtros |
| `/talleres/[slug]` | Detalle de un taller |
| `/login` | Iniciar sesión |
| `/registro` | Crear cuenta |
| `/dashboard` | Panel del tallerista (requiere auth) |
| `/dashboard/talleres/nuevo` | Crear taller (requiere auth) |

---

## API Endpoints

**Públicos**

```
GET  /health
GET  /api/v1/categories
GET  /api/v1/workshops
GET  /api/v1/workshops/:slug
POST /api/v1/auth/register
POST /api/v1/auth/login
```

**Protegidos** (requieren `Authorization: Bearer <token>`)

```
GET  /api/v1/my-workshops
POST /api/v1/workshops
```

---

## Instalación de componentes shadcn/ui

Siempre instalar desde dentro del contenedor:

```bash
docker compose exec web npx shadcn@latest add <componente>
```

Ejemplo:

```bash
docker compose exec web npx shadcn@latest add calendar
```
