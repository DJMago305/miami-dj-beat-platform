# TICKET: evaluación interna de desempeño para Staff/DJ (no reseña pública)

**Fecha:** 2026-10-01
**Reportado por:** el PO, tras pedir dejar una reseña de 5 estrellas para Wendy (cuenta de staff) desde la cuenta de Owner.
**Estado:** Pendiente — pospuesto explícitamente por el PO para su propia sesión.

## Qué se pidió originalmente, y por qué no se hizo así

El PO quería dejar una reseña positiva para Wendy (y en general para sus DJs/trabajadores) desde la cuenta de Owner (o incluso desde una cuenta de DJ), en el mismo lugar donde hoy viven las reseñas de clientes en el perfil público (el bloque "Opiniones de Clientes ★ X.X promedio" de `dj-profile.html`).

No se construyó así porque esa sección se presenta explícitamente como experiencias de clientes reales que contrataron y pagaron el servicio -- Owner (la empresa) o un compañero de trabajo no son clientes en ese sentido, aunque la opinión sea sincera y venga de una persona real (el PO tiene razón en que no es un bot ni un perfil falso). Meter una evaluación interna ahí diluye el promedio público de satisfacción de clientes con un dato que no es eso, y cualquier visitante del sitio lo leería como si fuera un cliente más.

El PO aceptó esta distinción ("si dices que la lógica no es, entonces te sigo") y pidió dejarlo documentado como ticket aparte: **una evaluación interna real, nunca mezclada con las reseñas públicas de clientes.**

## Postura del PO, para no perderla

El PO sigue pensando, como criterio general, que compañeros de trabajo (incluso DJs entre sí) deberían poder evaluarse sinceramente entre ellos -- no lo ve como falso solo por venir de dentro de la empresa. El punto de fondo no fue "¿es deshonesto?" sino "¿dónde vive esto sin mezclarse con el dato de satisfacción de clientes?". Vale la pena tenerlo presente al diseñar la función: el PO quiere que SÍ se pueda evaluar a su gente, solo que en su propio espacio.

## Qué falta decidir en su propia sesión

1. Dónde vive esta evaluación -- ¿una pestaña nueva en el perfil de staff/DJ ("Evaluación interna"), algo dentro de `staff-admin.html` (ficha del empleado), o un registro que ni siquiera es visible en el perfil público?
2. Quién puede evaluar a quién -- ¿solo Owner/manager evalúa a cualquiera, o también DJs entre sí como propuso el PO? Si es lo segundo, hace falta una regla clara de permisos (y probablemente anti-abuso: evitar "nos evaluamos todos 5 estrellas entre nosotros" como práctica vacía).
3. Si debe tener un número de estrellas (como las reseñas de clientes) o ser solo texto libre -- un promedio de estrellas interno podría confundirse visualmente con el de clientes si no se diferencia bien.

## Explícitamente fuera de alcance ahora

No se construye nada de esto en la sesión de hoy -- el PO pidió dejarlo como ticket para atacarlo más adelante, en su propia sesión dedicada.
