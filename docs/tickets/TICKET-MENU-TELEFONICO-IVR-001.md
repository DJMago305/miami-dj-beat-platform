# TICKET: Menú telefónico (IVR) con filtro anti-robots
**Estado:** 🟡 ABIERTO — diseñado, sin construir. Se hace más adelante (orden del PO, 2026-10-05).
**Fecha inicio:** 2026-10-05
**Archivos en scope (cuando se haga):** función nueva de Supabase para la voz (`supabase/functions/voice-ivr/`), tabla nueva `voice_calls` (SQL en `supabase/scripts/`, lo corre el PO), configuración en la consola de Twilio. **No toca** `web/` ni `contracts-engine.html`.

---

## Origen

El 5 de octubre de 2026 el PO recibió **más de 100 llamadas de estafa en una mañana** (y un SMS falso del "perfil de Google Business"). Bloquear números uno por uno no sirve: los robots falsean números locales distintos en cada llamada.

El **(305) 607-1780** está publicado unas **304 veces** en el sitio (enlace de llamada, schema.org, `llms.txt`, barra social, páginas de servicio) y es también el número personal del PO (firmas de correo, cuentas de terceros). Por eso lo encuentran los robots.

## Objetivo

Un **número nuevo de Twilio** con un menú de voz que:
1. Elimina los robots (no pulsan teclas).
2. Dice qué busca el cliente antes de contestar (idioma y departamento).
3. Respeta el horario de atención.
4. **Deja intacto el celular del PO y el 607-1780.**

## Decisiones ya tomadas por el PO

- **Horario de atención: lunes a sábado, de 10:00 a.m. a 8:00 p.m. (hora de Miami).** Fuera de horario: mensaje y buzón con transcripción.
- **El celular no se quita.** El menú reenvía la llamada al celular del PO dentro del horario.
- **No se porta el 607-1780 a Twilio.** Motivos: se romperían los códigos de verificación por SMS (bancos, Stripe, Apple, Google) y se dejaría todo el negocio en manos de un proveedor que ya falló antes con los SMS.
- **El primer paso del PO es gratuito y no depende de Twilio:** Concentración "Dormir" (solo contactos, llamadas repetidas), silenciar desconocidos de noche, y preguntar a T-Mobile por **Scam Shield / ScamBlock** en la línea de negocio.

## Diseño propuesto

```
Llamada al número nuevo
 → "Para español, pulse 1. For English, press 2."
 → Menú de departamentos (nombres copiados de las páginas del sitio)
 → ¿Dentro de horario?
      sí → suena el celular del PO; antes de conectar, voz al oído:
           "Llamada de <departamento>, en <idioma>"
      no → mensaje de fuera de horario + buzón (transcrito)
 → Cada llamada se registra: idioma, departamento, hora, número de quien llama, resultado
```

**Departamentos (propuesta, el PO decide cuáles y el orden):** 1 DJ · 2 Hora Loca · 3 pantallas LED e iluminación · 4 bodas y quinceañeras · 5 otro servicio / hablar con una persona. Páginas existentes en el sitio: `dj-miami`, `hora-loca`, `led-screens-dj`, `lighting-dj`, `mc-dj`, `weddings`, `quinceanera`, `furniture-dj`. Los rótulos se **copian** de las páginas, no se inventan.

## Defensas contra el fallo de Twilio (el PO ya lo vivió con los SMS)

- Si la función o el menú fallan, la llamada **pasa directa al celular** en vez de perderse (URL de respaldo en Twilio).
- Se prueba varios días con llamadas reales antes de publicar el número.
- Se valida la firma de Twilio en cada petición.
- Es **reversible**: el sitio sigue usando el 607-1780 hasta que el PO decida cambiarlo.
- Recordatorio de [[project_sms_aceptado_no_es_entregado]]: aceptado ≠ entregado; las llamadas de voz no dependen de la verificación de SMS (el toll-free sigue sin verificar), pero hay que probarlas en uso real.

## Pendiente por decidir

1. Quién atiende en **español** y quién en **inglés** (¿el PO en ambos o hay otro número por idioma?).
2. Departamentos definitivos y su orden.
3. Mensaje y voz del saludo (¿grabado por el PO o voz automática?).
4. **Dónde se publica el número nuevo** y cuándo se reemplaza al 607-1780 en el sitio, Google Business y directorios. Es un cambio grande (304 apariciones) que va en **un solo PR** aprobado por el PO. Ojo: no tocar el teléfono de la ficha de Google sin confirmar cuál es el publicado allí (el 423-5814 se había marcado como legítimo, NO tocar).
5. Si se envía un aviso por SMS al PO con el resumen de llamadas perdidas.

## Quién hace qué

- **PO:** compra el número en Twilio y aprueba el gasto; corre el SQL de la tabla; decide horario, departamentos y quién atiende.
- **Hilo que tome el ticket:** escribe la función y la tabla como cambio revisable, la prueba y documenta. **No despliega sin autorización escrita del PO.**
- Costo aproximado (a verificar en Twilio): un dólar y poco al mes por el número, más centavos por minuto de voz.

## Criterios de aceptación

- [ ] Una llamada de prueba en español llega al celular dentro del horario, con el aviso del departamento.
- [ ] Una llamada de prueba en inglés, igual.
- [ ] Fuera de horario: mensaje y buzón transcrito, y se registra.
- [ ] Una llamada que no pulsa tecla no llega al celular.
- [ ] Si se simula un fallo de la función, la llamada pasa directa al celular.
- [ ] Cada llamada queda en `voice_calls`.
- [ ] El PO ve y confirma el resultado antes de publicar el número (regla 7 del CLAUDE.md).

## Relacionado

- Reglas del repo: nada de PR sin el "aprobado" del PO; el SQL de producción lo corre el PO, con encabezado PRUEBA/PRODUCCIÓN.
- Este ticket es un documento: **no se envía solo a un PR**, va en la jornada que el PO apruebe (regla de no hacer micro-commits).
