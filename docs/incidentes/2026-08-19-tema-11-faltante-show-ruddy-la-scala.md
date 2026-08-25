# Incidente · Tema 11 faltante en el show de Ruddy La Scala

| | |
|---|---|
| **Fecha del show** | 2026-08-19 |
| **Ámbito** | Operación en vivo — carpeta de música local del Capitán, no la plataforma |
| **Reportado por** | El Capitán, al día siguiente |
| **Gravedad** | Alta para la operación (falta de un tema en vivo, casi al final del show) — sin relación con el código del proyecto |
| **Estado** | Investigado con la evidencia disponible. Sin causa ni responsable identificado — ver §4 |

---

## 1 · Reporte original

Durante el show con Ruddy La Scala, ya casi terminando, faltó un tema de la carpeta de música que el Capitán tenía preparada para esa noche. La carpeta llevaba completa desde hacía tiempo; el Capitán no movió ni autorizó mover ese archivo.

## 2 · Investigación

Carpeta localizada: `~/Downloads/Ruddy La Scala show video DJ/` (macOS, equipo del Capitán). Es una carpeta local, fuera de la plataforma `miami-dj-beat-platform` — no hay código ni base de datos involucrados.

Contenido verificado:

```
01-Intro 2025.mp4
02- Volvamos a vivir -New.mp4
03- Me Cambiaste la vida.mp4
04- Es que eres tu.mp4
05-Santisima Virgen Maria.mp4
06-El cariño es.mp4
07-reyna.mp4
08-Yo Te Mataría.mp4
09-Te amo te amo.mp4
10-Cuando yo amo.mp4
12-Mi vida.mp4          ← salto: no hay "11"
13- libre.mp4
```

**Confirmado: el tema 11 no existe en esta carpeta**, ni con ese número ni con un nombre parecido. La numeración salta directo de 10 a 12.

## 3 · Dos datos duros de la carpeta

1. **La fecha de modificación de la carpeta misma es 2026-05-29, 18:58.** Esa fecha solo cambia cuando algo ENTRA o SALE de la carpeta — no cuando se edita un archivo por dentro. No ha habido ninguna adición ni eliminación de archivos en esta carpeta desde esa fecha, meses antes del show.
2. **Los archivos 01 al 12 (todos menos el 13) tienen fecha de modificación del mismo día del hallazgo**, en secuencia de minutos entre uno y otro — compatible con un proceso que los reescribió/tocó uno tras otro. El archivo 13 conserva una fecha vieja de enero, sin tocar. Causa de esto no identificada; pendiente de que el Capitán confirme si corrió alguna exportación/conversión/sincronización sobre la carpeta ese día.

## 4 · Lectura, con cautela

El hueco del tema 11 parece **preexistente** al show — la carpeta no registra ninguna entrada/salida de archivos desde el 29 de mayo, meses antes de la fecha del show. Es decir, lo más probable es que el archivo ya no estuviera ahí desde antes, y su ausencia simplemente no se notó hasta que hizo falta en vivo, no que "se movió" durante o justo antes del show.

**No se pudo identificar quién ni cuándo exactamente**, porque macOS no guarda por defecto un registro de qué usuario o proceso borra o mueve un archivo. Se le indicó al Capitán que si tiene Time Machone u otro respaldo activo con fecha anterior a mayo de 2026, podría comparar el contenido de la carpeta en ese punto para acotar la ventana.

## 5 · Cierre

El Capitán aceptó la investigación como suficiente por ahora. No se tomó ninguna acción correctiva sobre la carpeta (no se creó, movió, ni borró nada — solo lectura). Sin causa raíz confirmada. Registrado para dejar constancia y como referencia si el patrón se repite en futuros shows.
