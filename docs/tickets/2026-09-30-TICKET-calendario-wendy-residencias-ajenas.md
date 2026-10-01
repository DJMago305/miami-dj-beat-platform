# TICKET: Calendario de Wendy muestra residencias ajenas y le faltan eventos propios

**Fecha:** 2026-09-30
**Reportado por:** PO, en vivo, probando la cuenta de Wendy.
**Estado:** ✅ RESUELTO — confirmado en vivo con la sesión real de Wendy.

## Síntoma original

El calendario de Wendy mostraba las residencias de DJMago305 mezcladas, y a la
vez le faltaban algunos eventos propios.

## Decisión final del PO (reemplaza el diagnóstico inicial)

A mitad de la investigación el PO corrigió el enfoque: **las residencias y
fiestas deben verse por TODO el staff**, sin importar quién las asignó — es
información operativa necesaria para no asignar un DJ que ya está trabajando
ese mismo horario. Lo único privado por vendedor/manager es su **calendario
personal** (cumpleaños, notas, Google Calendar sincronizado).

> "las tablas en los calendarios deberían dejar ver a los staff quien esta
> trabajando en residencia y en fiestas porque es un dato importante para no
> asignar un dj que ya esta trabajando ahora en el caso de los clientes de
> cumpleaños que vienen desde su agenda son solo de cada vendedor esto si es
> privado"

## Solución construida (`web/calendario-operacional-inteligente.html`)

Se reemplazó el botón único "Owner · Matrix" por un sistema de pestañas según
rol:

- **Owner/Admin:** 3 pestañas — **Owner · Matrix** (todo: leads, residencias,
  reservas privadas con detalle completo), **Performance** (quién está
  trabajando: residencias + reservas en modo "Ocupado", sin venue/notas/pago),
  **Personal** (su propio calendario de Google sincronizado).
- **Manager/Seller:** 2 pestañas — **Performance**, **Personal** (sin acceso a
  Matrix).

Performance muestra **únicamente** DJs asignados a un evento de trabajo real
(residencia o reserva privada/boda) — nunca cumpleaños ni aniversarios de
clientes (esos solo aparecen en Owner · Matrix). Personal muestra el
calendario de Google de cada cuenta, una vez emparejado y autorizado por esa
persona — mecanismo que ya existía (`elixis_agenda_eventos` con
`tipo IN ('cumpleanos','nota')`, RLS por `user_id = auth.uid()`), reusado sin
cambios.

Columna de atribución agregada a `residency_schedule`
(`assigned_staff_id`/`assigned_staff_name`, FK a `auth.users(id)`): registra
quién creó/reasignó cada residencia — no se usa para filtrar visibilidad, sino
como base para el futuro aviso cuando un vendedor mueve el DJ asignado por
otro (ver "Pendiente" abajo).

## Verificación realizada

- RLS simulado con el UUID real de Wendy (`seller`) y pruebas en vivo en el
  navegador con su sesión real activa.
- Performance: confirmado que muestra solo "Residencia · ..." (sin cliente,
  sin cumpleaños, sin venue/pago) — incluyendo el caso puntual "Mildrey
  Sotelo — cumpleaños" que inicialmente se colaba y fue corregido.
- Personal: vacío y correctamente aislado (Wendy aún no tiene Google
  sincronizado).
- Botones Artista/Cliente estables (sin colapso "acordeón") al cambiar entre
  Performance y Personal.
- Consola limpia, sin errores.
- **Confirmado por el PO**, 2026-09-30: "en performan solo los dij que estan
  trabajando asignados aun evento o a una recidencia en personal los de cada
  persona sea quien sea su calendario de gogles que tienen que emparegar y
  autorizar ya eso esta creado y trabajando."

## Pendiente (fuera de este ticket, anotado aparte)

- Notificación al dueño original de un DJ cuando otro staff reasigna su
  residencia (ej. Wendy mueve un DJ que Gerardo había asignado) — groundwork
  de datos ya existe (`assigned_staff_id`/`assigned_staff_name`), falta
  construir la notificación en sí.
- Extender el patrón Performance/Personal a **Artista** (sus eventos
  asignados + Personal) y **Cliente** (fecha de su evento + Personal) —
  confirmado en alcance por el PO, no iniciado todavía.
