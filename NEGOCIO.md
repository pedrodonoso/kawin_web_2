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

## Requerimientos de Scheduling (revisados 2026-04-08)

### Tipos de talleres y su inmutabilidad

El tipo de un taller (`workshop`, `course`, `class`, `event`) se define al momento de la creación y **no puede modificarse**. Una clase no puede convertirse en evento, un evento no puede convertirse en curso.

### Reserva de sesión individual en clases recurrentes

Para talleres de tipo `class` (clases regulares recurrentes), los estudiantes pueden reservar una sesión puntual de forma independiente. Por ejemplo: "Yoga todos los jueves 19:00" → el estudiante reserva solo este jueves.

El modelo de reserva distingue:
- `session_id = NULL` → reserva del taller completo (cursos, workshops, eventos)
- `session_id = <uuid>` → reserva de una sesión específica (clases)

**Los estudiantes solo pueden reservar sesiones que el tallerista haya materializado explícitamente.** No existen reservas sobre slots calculados. Cada sesión muestra cupos disponibles en tiempo real. Las reservas sueltas son el modelo de Fase 2. Las suscripciones o packs de clases son Fase 3.

### Calendarización de clases recurrentes (Schedules)

Las clases recurrentes se definen mediante **reglas de recurrencia** (schedules), no fechas individuales. Un schedule especifica: días de la semana, hora de inicio, duración y rango de fechas válido. Un tallerista puede tener múltiples schedules activos para un mismo taller (ej: lunes 10:00 y jueves 19:00).

**Las schedules son solo reglas de cálculo.** No generan sesiones automáticamente. Su único rol es:
1. Mostrar al estudiante en la publicación del taller cuándo se dictan las clases ("clases los lunes y jueves a las 19:00").
2. Ofrecer al tallerista los slots disponibles para materializar en su calendario de administración.

**No existe el principio de sesiones virtuales.** Las sesiones existen en la base de datos solo cuando el tallerista las materializa explícitamente.

**Modelo de publicación:** un taller = una disciplina en una ubicación. Para organizaciones con múltiples disciplinas (ej: un gimnasio con Boxeo, Kickboxing, Striking), se crea un taller por disciplina. La página de detalle muestra otras publicaciones del mismo tallerista/organización.

### Calendario de administración del tallerista

El tallerista gestiona sus sesiones desde un **calendario de administración** accesible en el panel de su taller. Desde este calendario puede:

- **Ver slots disponibles para materializar**: calculados en tiempo real desde los schedules activos, sin persistencia hasta que el tallerista decida crearlos.
- **Materializar sesiones**: convertir un slot calculado en una sesión real en la base de datos, dejándola disponible para reserva por estudiantes.
- **Cancelar sesiones**: marcar una sesión materializada como cancelada, lo que dispara la política de comisiones y devolución a los estudiantes con reservas activas.
- **Gestionar schedules (reglas)**: crear, modificar y eliminar schedules sin restricciones. Los cambios a schedules no afectan sesiones ya materializadas ni reservas existentes. Solo impactan los slots disponibles para futuras materializaciones.

### Cambios de horario y schedules

Los schedules pueden modificarse o eliminarse libremente. Un cambio de schedule **no tiene efecto sobre sesiones ya materializadas ni sobre las reservas existentes**. Las sesiones materializadas conservan su horario original independientemente de los cambios en la regla.

Si el tallerista quiere cambiar el horario de una sesión ya materializada con reservas, debe cancelar esa sesión (disparando el flujo de devolución) y materializar la nueva sesión en el horario deseado.

### Migración y devolución de reservas por cancelación de sesión

Cuando el tallerista cancela una sesión materializada con reservas activas, el sistema aplica la política de comisión y registra las devoluciones. No existe flujo automático de migración al cambiar schedules — la migración es siempre una acción explícita del tallerista sesión por sesión.

**Política de comisión en cancelaciones (definida):** El corte es el domingo fijo de cada semana. Si el tallerista cancela una sesión de la semana en curso (el domingo ya pasó), absorbe la comisión del 15%. Si cancela una sesión de la semana siguiente o posterior, Kawin absorbe la comisión. En todos los casos el estudiante recibe devolución del 100%. Campo DB: `bookings.commission_absorbed_by` (`'instructor'` | `'platform'`).

Todas las acciones de cancelación quedan registradas con razón para trazabilidad y futura notificación a los estudiantes.

## Estrategia de Crecimiento
1. **Alianzas Estratégicas**: Colaborar con instituciones educativas, centros culturales, y organizaciones comunitarias para atraer talleristas y estudiantes a la plataforma.
2. **Marketing Digital**: Implementar campañas de marketing digital en redes sociales, Google Ads   y otras plataformas para aumentar la visibilidad de Kawin y atraer a nuevos usuarios.
3. **Expansión Geográfica**: Comenzar en ciudades clave de América Latina y expandirse gradualmente a otras regiones.
4. **Mejora Continua**: Recopilar feedback de los usuarios para mejorar continuamente la plataforma, agregar nuevas funcionalidades, y asegurar una experiencia de usuario excepcional.

