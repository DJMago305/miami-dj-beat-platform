# TICKET: Calendario de Wendy muestra residencias ajenas y le faltan eventos propios

**Fecha:** 2026-09-30
**Reportado por:** PO, en vivo, probando la cuenta de Wendy.
**Estado:** Pendiente de investigación — no resuelto todavía, solo documentado.

## Síntoma reportado

El calendario de Wendy (`staff-agenda.html` o la vista de Agenda que corresponda
a su cuenta) muestra las **residencias de DJMago305** — un DJ que no es ella —
y, al mismo tiempo, **le faltan algunos eventos propios**. Ambos síntomas a la
vez: ve datos que no son suyos Y no ve todos los que sí debería.

## Comportamiento correcto esperado (según el PO)

Wendy debe ver en su calendario únicamente:
1. **Su propio calendario** (eventos/residencias que son directamente de ella).
2. **Los eventos de los DJs que ELLA asigna** como manager/vendedora — porque
   esos son sus clientes y los DJs que ella reserva, y por eso le interesan.
   Cuando Wendy asigna un DJ a un evento, ese evento debe quedar registrado
   también en SU calendario.

Nunca debe ver residencias o eventos de un DJ con el que ella no tiene relación
de asignación (como las residencias propias de DJMago305, que no fueron
asignadas por ella).

## Por qué importa

Esto es un problema de **alcance de datos** (quién ve qué), no solo una
molestia visual — mezcla datos de cuentas distintas sin que medie una relación
real (asignación hecha por Wendy). Mismo tipo de preocupación que la fuga de
sesión reportada en paralelo hoy (ver `docs/ESTADO_MAESTRO.md` / ticket de
sesión Owner↔Wendy del mismo día), aunque técnicamente son dos causas distintas
(esto parece ser una consulta/filtro de agenda mal acotado, no una mezcla de
sesión de autenticación).

## Qué falta investigar (próxima sesión)

- Encontrar la consulta real que carga el calendario de Wendy (probablemente
  en `staff-agenda.html`) y confirmar el filtro actual: ¿filtra por
  `assigned_dj_id`, por `created_by`, por algún otro campo, o no filtra lo
  suficiente?
- Confirmar qué campo de la base de datos representa "Wendy asignó este DJ a
  este evento" (relación manager↔DJ↔evento) y si ese campo existe ya o hay que
  crearlo.
- Explicar por qué aparecen residencias de DJMago305 específicamente — ¿hay un
  filtro roto, un valor por defecto incorrecto, o una consulta sin `WHERE`
  completo?
- Explicar también la otra mitad del síntoma: por qué le faltan eventos
  propios — ¿mismo filtro roto excluyendo de más, o es un problema distinto?

No se toca el código todavía — el PO pidió solo dejarlo anotado como ticket.
