# 🛡️ MODO BLINDADO CEO — Ley de Desarrollo (SOP)
v1.0 - MDJPRO Standard

## 0. Regla Suprema
**Nunca se toca "producción" sin un punto de retorno.**
Traducción: sin Git limpio + commit, no hay cambios.

---

## 1. Fase de Apertura — "Arranque con Cinturón"
Antes de tocar un archivo:

✅ **Checklist de Inicio:**
1. **Ubicación Correcta**: `pwd` y `ls` para confirmar el directorio.
2. **Git Existe**: `ls -la | grep .git`
3. **Estado Limpio**: `git status` y `git log -n 1 --oneline`

Si NO aparece Git inicializado:
```bash
git init
git add .
git commit -m "BASELINE: stable snapshot"
```

---

## 2. Política de Cambios — "Una bala, un objetivo"

✅ **Regla 1: Un cambio = un commit**
Nada de 20 cosas mezcladas en un solo commit.

✅ **Regla 2: Cambios pequeños**
- 1 archivo idealmente.
- 2 máximo.
- Si afecta más: se considera “refactor” y requiere plan formal.

✅ **Regla 3: No tocar CSS global si el problema es local**
- Si el bug está en `rentals.html`, se arregla en `rentals.html` mediante `#rentals-visual-lock`.
- CSS global (`styles.css`) solo con “cambio aprobado”.

---

## 3. Ciclo de Trabajo (Loop) — "Construye → Verifica → Sella"

**A) Crear rama de trabajo**
```bash
git checkout -b fix/nombre-del-cambio
```

**B) Editar (1 sola cosa)**
No arregles hover + background + grid al mismo tiempo.

**C) Verificación técnica (5 puntos)**
1. **Hard refresh**: `Cmd+Shift+R`
2. **Desktop hover test**: Confirmar no clipping ni saltos.
3. **Mobile sanity**: DevTools -> iPhone. Verificar no desbordes.
4. **Console clean**: F12 -> No errores rojos.
5. **Computed check**: Inspeccionar overflow, width, line-height.

**D) Sellado (Commit inmediato)**
```bash
git add <archivo>
git commit -m "Fix: descripción clara del cambio"
```

---

## 4. Auditoría Anti-Regresión — "Antes de cerrar"
Antes de dar por terminado el día:
- `git status`: Debe estar limpio.
- `git diff --stat`: Debe estar vacío (ya commiteado).
Si hay cambios sin commit: **NO se cierra.**

---

## 5. Política de Emergencia — "Rollback sin drama"
Si algo se rompe:
- **Opción 1**: Volver al último commit: `git reset --hard HEAD`
- **Opción 2**: Revertir un commit específico: `git revert <hash>`

---

## 6. Regla de Oro Visual — "CSS Lock Contract"
✅ **Permitido**: Selectores solo dentro del scope local (`.tile`, `#rentals-gallery`, etc.)
🚫 **Prohibido**: `body { ... }` global sin scope o comentarios de verificación.
- Ejemplo requerido: `/* BODY CHANGE: Verified no side effects (checked: index, login, profile) */`

---

## 7. Protocolo de Licencias (macOS)
```bash
sudo xcodebuild -license
# Enter -> Space -> agree -> Enter
xcode-select --install
git --version
```

---

## 8. Deploy a Supabase — "Pipeline CEO"
1. **Tag de release local**: `git tag release-v1`
2. **Deploy quirúrgico**: Solo lo que toca.
3. **Verificación post-deploy**: URL live + Console check.

---

## 9. Regla de Oro de Agentes
✅ **El agente propone.**
❌ **Tú ejecutas.** (Control manual del commit final).

---

## 10. Regla Fortune 500 — "No Inline CSS"
🔐 **Regla 10: No style="" en producción**
- Todo estilo nuevo debe ir dentro de `#rentals-visual-lock` (o el equivalente local).
- O en un archivo dedicado (`.css`).
- Prohibido el uso de `style=""` disperso en el HTML para evitar deuda técnica.

---

## 11. Regla de Integridad — "Pre-Commit Test"
🔐 **Regla 11: Inspección Final Obligatoria**
Antes de cada commit, es obligatorio ejecutar:
```bash
git diff --stat
```
**Acción Crítica**: Revisar manualmente que:
- No se tocaron archivos inesperados.
- No hay cambios accidentales.

---

## 12. Regla de Estabilidad — "Tag de Estabilidad"
🔐 **Regla 12: Sellado del Hito**
Cuando un componente (ej. Rentals) esté sólido y verificado tras una serie de cambios:
```bash
git tag STABLE_RENTALS_V1
```
Para marcar puntos de restauración permanentes.

---
**MDJPRO Engineering Standard**
