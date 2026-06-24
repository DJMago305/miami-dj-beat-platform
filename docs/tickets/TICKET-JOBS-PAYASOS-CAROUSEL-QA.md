# TICKET-JOBS-PAYASOS-CAROUSEL-QA

**Estado:** SUSPENDIDO — pendiente QA visual  
**Prioridad:** Baja  
**Archivo:** `web/jobs.html`  
**Función afectada:** `mdjJobsRoleInfiniteApply()`

---

## Problema reportado

La tarjeta PAYASOS (card 7 de 7 en el carrusel de categorías) no se puede seleccionar visualmente. El click no marca la tarjeta como `.active`.

## Hipótesis de causa

El `scrollLeft` inicial (`sw / 4`) coloca a Payasos en el borde derecho del viewport del carrusel. El click puede caer fuera del div `#mdj-jobs-v3-carousel` o en la zona del botón ▶ (flex sibling a la derecha).

**Línea exacta:** `web/jobs.html` — función `mdjJobsRoleInfiniteApply()`, línea ~4198.

## Cambio aplicado (NO validado en QA)

```diff
- if (sw > 120) car.scrollLeft = Math.round(sw / 4);
+ if (sw > 120) {
+     var cardW = 304;
+     car.scrollLeft = Math.max(0, Math.round(sw / 4) - cardW);
+ }
```

El cambio fue aplicado al archivo local pero **NO commiteado, NO pusheado, NO deployado**.

## Pendiente antes de cerrar

- [ ] Probar en localhost:8080/jobs.html con DevTools abierto
- [ ] Verificar que Payasos queda completamente visible al cargar
- [ ] Click en Payasos → confirmar que `.active` se aplica igual que DJ/MC
- [ ] Verificar Console sin errores
- [ ] Decidir: aprobar patch O revertir con `git checkout -- web/jobs.html`

## Para revertir si falla QA

```bash
git checkout -- web/jobs.html
```

## Notas

- Auditoría estática no encontró ningún bloqueo explícito en HTML/CSS/JS específico para Payasos.
- La causa puede ser scroll position + overflow clipping, no código explícito.
- Requiere QA visual real antes de confirmar resolución.
