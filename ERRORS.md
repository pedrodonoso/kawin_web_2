```bash
[GIN-debug] GET    /api/v1/workshops/:id/schedules --> github.com/pedrodonoso/kawin/api/internal/handlers.GetSchedules (5 handlers)


github.com/gin-gonic/gin.(*node).addRoute(0xacbfa2?, {0xc0000ca860, 0x1f}, {0xc0001f2720, 0x5, 0x5})

	/go/pkg/mod/github.com/gin-gonic/gin@v1.10.0/tree.go:247 +0xb6a

panic: ':id' in new path '/api/v1/workshops/:id/schedules' conflicts with existing wildcard ':slug' in existing prefix '/api/v1/workshops/:slug'


github.com/gin-gonic/gin.(*Engine).addRoute(0xc0005be1a0, {0xacbfa2, 0x3}, {0xc0000ca860, 0x1f}, {0xc0001f2720, 0x5, 0x5})

	/go/pkg/mod/github.com/gin-gonic/gin@v1.10.0/gin.go:, 0x1?}, {0xc000070240, 0x1, 0x0?})

	/go/pkg/mod/github.com/gin-gonic/gin@v1.10.0/routergroup.go:89 +0x13e

goroutine 1 [running]:349 +0x252

github.com/gin-gonic/gin.(*RouterGroup).handle(0xc00011a480, {0xacbfa2, 0x3}, {0xae1eeb?github.com/gin-gonic/gin.(*RouterGroup).GET(...)

	/go/pkg/mod/github.com/gin-gonic/gin@v1.10.0/routergroup.go:117

github.com/pedrodonoso/kawin/api/internal/routes.Register(0xc0005be1a0)

	/app/internal/routes/routes.go:35 +0x3a9

main.main()

	/app/cmd/main.go:33 +0x13c

Process Exit with Code: 2
```
