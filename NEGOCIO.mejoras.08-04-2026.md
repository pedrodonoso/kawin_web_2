---
title: "Revisión de Modelo de Negocio"
author: "Pedro"
date: "2026-04-08"
output: html_document
description: "Revisión del modelo de negocio de Kawin con enfoque en la gestión de talleres y clases recurrentes."
---


# Revisión de Modelo de Negocio - Talleres

Los schedules definidos sólo sirven para calcular las sesiones disponibles para materializar. 
No hay sesiones pre-generadas en la base de datos. Esto permite flexibilidad para cambios de horario sin necesidad de gestionar fechas individuales.

El tallerista puede tener múltiples schedules activos para un mismo taller, lo que permite ofrecer varias clases recurrentes (ej: lunes 10:00 y jueves 19:00). Cada schedule genera su propio conjunto de sesiones disponibles.
El tallerista deberá gestionar las clases disponibles en el sistema desde el panel de adminitración del taller, 
donde podrá ver las sesiones por crear usando los schedules activos, y podrá cancelar o modificar horarios específicos sin afectar el resto de las sesiones generadas por la regla de recurrencia.

El princio de sesiones virtuales ya no exisitirá porque las sesiones se materializan cuando el tallerista lo decida.

### Calendario de adminitración de tallerista

El tallerista tiene acceso a un calendario de administración donde puede visualizar todas las sesiones disponibles para instanciar (según reglas schedules) y ya instanciadas. 
En este calendario, el tallerista puede:
- Ver las sesiones programadas para cada día.
- Cancelar sesiones específicas sin afectar el resto de las sesiones generadas por la regla de recurrencia.
- Modificar horarios de sesiones específicas, lo que se gestionará a través de los procesos de migración o devolución para las reservas afectadas.
- Generar o materializar sesiones usando los schedules activos según su conveniencia, lo que permite flexibilidad para gestionar su oferta de clases.
- Generar o materializar sesiones manualmente, por ejemplo, para un taller de yoga que solo se dicta en enero y febrero, el tallerista puede generar las sesiones correspondientes a esos meses y luego cancelarlas o modificarlas según sea necesario.
- Gestionar (modificar|eliminar|crear) las reglas o schedules activos para cada taller, lo que le permite ofrecer múltiples clases recurrentes (ej: lunes 10:00 y jueves 19:00) y ajustar su oferta según la demanda y disponibilidad.

Al modificar|eliminar|crear los schedules activos, no se debe realizar ninguna validación porque las sesiones se materializan manualmente por el tallerista, lo que le da total control sobre su calendario de clases.
Lo único que cambiará serán las sesiones disponibles para materializar, pero no se afectarán las sesiones ya materializadas ni las reservas existentes, lo que garantiza estabilidad y flexibilidad para el tallerista.

### Sobre las clases

Los workshops no pueden cambiar de categoría. Ej: Una clase no puede cambiar a evento, un evento no puede cambiar a curso. 

