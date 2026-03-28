# Kawin

Kawin conecta talleristas (instructores/facilitadores) con personas que quieren aprender — cursos, talleres, clases de cualquier tipo.

## Misión
Empoderar a los talleristas presenciales para que puedan compartir su conocimiento y habilidades con el mundo, y facilitar a las personas el acceso a una amplia variedad de cursos y talleres de calidad.

## Visión
Ser la plataforma líder en América Latina para la conexión entre talleristas y estudiantes, fomentando el aprendizaje continuo y el desarrollo de habilidades en diversas áreas.

## Negocio

### Modelo de Negocio
Kawin opera bajo un modelo de negocio de marketplace, donde los talleristas pueden crear y ofrecer sus cursos/talleres, y los estudiantes pueden descubrir y reservar esos cursos. La plataforma cobra una comisión por cada reserva realizada a través de la plataforma.

### Fuentes de Ingresos
1. **Comisión por Reserva**: Kawin cobra una comisión del 15% sobre el precio de cada curso/taller reservado a través de la plataforma.
2. **Suscripción Premium para Talleristas**: Ofrecemos una suscripción mensual para talleristas que incluye beneficios adicionales como mayor visibilidad, herramientas de marketing, y acceso a análisis avanzados.
3. **Publicidad**: En el futuro, planeamos introducir opciones de publicidad para que los talleristas puedan promocionar sus cursos/talleres dentro de la plataforma.

### Funcionalidades Principales
- **Registro y Perfil de Talleristas**: Los talleristas pueden registrarse, crear un perfil detallado, y listar sus cursos/talleres con descripciones, precios, y horarios.
- **Búsqueda y Descubrimiento**: Los estudiantes pueden buscar cursos/talleres por categoría, ubicación, precio, y otros filtros para encontrar opciones que se ajusten a sus intereses.
- **Reserva y Pago**: Los estudiantes pueden reservar cursos/talleres y realizar pagos seguros a través de la plataforma.
- **Calificaciones y Reseñas**: Después de completar un curso/taller, los estudiantes pueden dejar calificaciones y reseñas para ayudar a otros usuarios a tomar decisiones informadas.
- **Panel de Control para Talleristas**: Los talleristas tienen acceso a un panel de control donde pueden gestionar sus cursos/talleres, ver estadísticas de reservas, y comunicarse con los estudiantes.
- **Soporte y Atención al Cliente**: Ofrecemos soporte tanto para talleristas como para estudiantes para resolver cualquier duda o problema que puedan tener.
- Sección de rutas turisticas: Kawin también ofrece una sección dedicada a rutas turísticas, donde los usuarios pueden descubrir y reservar tours guiados en diferentes ciudades de América Latina.
- Integración con redes sociales: Los usuarios pueden compartir sus cursos/talleres favoritos en sus redes sociales para aumentar la visibilidad y atraer a más estudiantes.
- No presenta chat en vivo pero si deberia existir una sección de preeguntas frecuentes (FAQ) para resolver dudas comunes de los usuarios. La idea es canalizar la comunicación directa hacia aplicativos de mensajería como WhatsApp o Telegram, donde el equipo de cada taller pueda brindar asistencia personalizada.
- Integración con calendarios: Los estudiantes pueden sincronizar sus reservas con sus calendarios personales (Google Calendar, Outlook, etc.) para recibir recordatorios y gestionar su tiempo de manera eficiente.
- Funcionalidad de grupos: Permitir a los estudiantes formar grupos para asistir a cursos/talleres juntos, lo que puede fomentar la interacción social y aumentar la participación.
- Programa de fidelización: Implementar un programa de puntos o recompensas para incentivar a los estudiantes a reservar más cursos/talleres y a recomendar la plataforma a sus amigos.


## Tipos de Talleres
Kawin no se limita a un tipo específico de taller. Ayudame a encontrar la mejor manera de abordar los diferntes tipos de talleres que pueden existir.
- Workshops de un día.
- Cursos de varias sesiones.
- Clases regulares (por ejemplo, clases de yoga semanales).
- Eventos especiales (por ejemplo, retiros de fin de semana).
- Talleres presenciales.
- Talleres en línea (a través de videoconferencia).
- Talleres híbridos (combinación de presencial y en línea).

## Requerimientos de Scheduling (analizados y aprobados)

### Reserva de sesión individual en clases recurrentes

Para talleres de tipo `class` (clases regulares recurrentes), los estudiantes pueden reservar una sesión puntual de forma independiente. Por ejemplo: "Yoga todos los jueves 19:00" → el estudiante reserva solo este jueves.

El modelo de reserva distingue:
- `session_id = NULL` → reserva del taller completo (cursos, workshops, eventos)
- `session_id = <uuid>` → reserva de una sesión específica (clases)

Cada sesión muestra cupos disponibles en tiempo real. Las reservas sueltas son el modelo de Fase 2. Las suscripciones o packs de clases son Fase 3.

### Calendarización de clases recurrentes (Schedules)

Las clases recurrentes se definen mediante **reglas de recurrencia** (schedules), no fechas individuales. Un schedule especifica: días de la semana, hora de inicio, duración y rango de fechas válido.

**Principio de sesiones virtuales:** las sesiones no se pre-generan. Se calculan en tiempo real desde la regla y solo se materializan en la base de datos cuando hay una reserva o cuando el instructor cancela/modifica esa fecha específica. Esto evita datos huérfanos y cron jobs de mantenimiento.

**Modelo de publicación:** un taller = una disciplina en una ubicación. Para organizaciones con múltiples disciplinas (ej: un gimnasio con Boxeo, Kickboxing, Striking), se crea un taller por disciplina. La página de detalle muestra otras publicaciones del mismo tallerista/organización.

### Cambios de horario

Los schedules son inmutables. Un cambio de horario cierra el schedule viejo (se le asigna `valid_until`) y crea uno nuevo (`valid_from`). Las reservas existentes bajo el horario antiguo conservan su hora original, honrando el contrato con el estudiante. Las nuevas sesiones se computan desde el schedule nuevo.

### Migración y devolución de reservas por cambio de horario

Cuando un tallerista cambia un schedule con reservas activas, el sistema detecta las reservas afectadas y presenta al tallerista dos opciones por reserva:

1. **Migrar al nuevo horario:** mueve la reserva a la sesión equivalente en el nuevo schedule (misma fecha, nueva hora). Si los días también cambiaron y no hay equivalente directo, solo está disponible la devolución.

2. **Devolver la reserva:** cancela la reserva y marca el reembolso. En Fase 2 (sin pago real): cambio de estado y resolución fuera de la plataforma. En Fase 3 (con MercadoPago): reembolso automático vía API.

**Política de comisión en cancelaciones (definida):** El corte es el domingo fijo. Cada domingo se establece el compromiso de sesiones para la semana entrante. Si el tallerista cancela o cambia horario de una sesión de la semana en curso (domingo ya pasó), absorbe la comisión del 15% — Kawin lo descuenta de su próximo pago. Si cancela una sesión de la semana siguiente o posterior (domingo aún no llegó), Kawin absorbe la comisión y devuelve el 100% al estudiante sin penalización al tallerista. El domingo cuenta como semana en curso. En todos los casos, recalendarizar tiene prioridad sobre devolver. Campo DB: `bookings.commission_absorbed_by` (`'instructor'` | `'platform'`).

Todas las acciones de migración/devolución quedan registradas con razón (`schedule_change`) para trazabilidad y futura notificación a los estudiantes.

## Estrategia de Crecimiento
1. **Alianzas Estratégicas**: Colaborar con instituciones educativas, centros culturales, y organizaciones comunitarias para atraer talleristas y estudiantes a la plataforma.
2. **Marketing Digital**: Implementar campañas de marketing digital en redes sociales, Google Ads   y otras plataformas para aumentar la visibilidad de Kawin y atraer a nuevos usuarios.
3. **Expansión Geográfica**: Comenzar en ciudades clave de América Latina y expandirse gradualmente a otras regiones.
4. **Mejora Continua**: Recopilar feedback de los usuarios para mejorar continuamente la plataforma, agregar nuevas funcionalidades, y asegurar una experiencia de usuario excepcional.

