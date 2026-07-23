# TICKET-V1-PROFILE-READONLY-DATA-INSPECTION-001

## Estado

**READ-ONLY REMOTE INSPECTION COMPLETE**

Inspección terminada sin modificación de datos.  
Reconciliación no autorizada y pendiente de ticket separado.

**Relacionado:** TICKET-V1-PROFILE-DATA-RECONCILIATION-001 (discovery) · TICKET-V1-JOBS-EMPLOYMENT-ACCOUNT-INTENT-FIX-001 (protección altas futuras) · TICKET-V1-PROFILE-CLASSIFICATION-AUDIT-001 (flujos, chat)

---

## Baseline

| Campo | Valor |
|-------|--------|
| Proyecto Supabase | `hkuvuqupbxwkiykxvqdr` |
| Método (pasada remota) | `supabase db query --linked` |
| Rama | `plan/v2-phase-4-api-client` |
| HEAD | `07785ae` — `feat(jobs): improve employment account intent flow` |
| Working tree antes de documentar | limpio |

---

## Límites respetados

Durante la **inspección remota** (pasada anterior) y esta **pasada de documentación**:

- Solo SELECT (inspección remota ejecutada previamente)
- Sin INSERT
- Sin UPDATE
- Sin DELETE
- Sin UPSERT
- Sin service role
- Sin migraciones
- Sin cambios en Supabase
- Sin cambios de runtime
- Sin reconciliación
- Sin commit
- Sin push
- Sin PR
- Sin deploy

**Esta pasada:** únicamente creación/actualización de este documento. **No** se repitieron consultas remotas.

---

## Distribución de perfiles

Total auth users inspeccionados: **15**

| Bucket | Cantidad |
|--------|---------:|
| ARTIST_ONLY | 6 |
| CLIENT_ONLY | 3 |
| DUAL | 4 |
| MISSING | 2 |

*(Fuente: Q15 — clasificación por presencia de `client_profiles` / `dj_profiles`.)*

---

## Caso Ary DJ Productions

| Campo | Valor |
|-------|--------|
| `user_id` | `741a2a8a-138a-4c5b-9ed2-6e9e522c07f6` |
| email | `yunielaryam1984@gmail.com` |
| `client_profiles.full_name` | Ary DJ Productons |
| Nota | typo existente en DB (`Productons`) |
| `is_commercial` | `false` |
| `dj_profiles` | no existe |
| JWT `user_type` | `client` |
| MDJB | `MDJB-48AC-5FC3-C` |
| Clasificación | **CLIENT_ONLY** |

### Diagnóstico

La clasificación del CRM es coherente con los datos persistidos.  
No se trata de un error de heurística posterior.  
El usuario fue registrado históricamente como **cliente** aunque el Product Owner esperaba un **proveedor artístico**.

**Clasificación:** `HISTORICAL SIGNUP INTENT MISALIGNMENT`

**No ejecutar corrección** en este ticket.

---

## Caso Aron Rosso

| Campo | Valor |
|-------|--------|
| `user_id` | `4bf2cf75-9e4f-49b0-8b30-b8b0a9986da4` |
| email | `aron.rosso@icloud.com` |
| `client_profiles` | no existe |
| `dj_profiles` | existe |
| `status` | ACTIVE |
| `stage_name` | Aron Rosso |
| `full_name` | Aron Rosso |
| `artist_specialty` | null |
| JWT `user_type` | `talent` |
| MDJB | `MDJB-BCBE-FF67-A` |
| Clasificación | **ARTIST_ONLY** |

### Diagnóstico

La aparición en CRM DJs es coherente con la existencia de `dj_profiles`.  
No es causada por regex, heurística vacía ni EMPTY_DJ (Q8 = 0 filas; `stage_name` poblado).  
El usuario fue registrado históricamente como **talent/artista** aunque el Product Owner esperaba un **cliente**.

**Clasificación:** `HISTORICAL SIGNUP INTENT MISALIGNMENT`

**No ejecutar corrección** en este ticket.

---

## Consultas adicionales completadas

| Consulta | Resultado |
|----------|-----------|
| Q8 EMPTY_DJ | 0 filas |
| Q2 Dual profiles | 4 usuarios |
| Q6 JWT `client` + `dj_profiles` | 2 usuarios; detalle pendiente |
| Q7 JWT `talent` + solo `client_profiles` | 0 |
| Q10 Emails duplicados | 0 grupos |
| Q3 Sin ningún perfil | 2 usuarios |
| Q5 Client huérfano | 0 |

### Usuarios MISSING confirmados

- `perezshakira97@gmail.com`
- `gerardoa4@hotmail.com`

Ambos con JWT `user_type` = `client`.

### Dual profiles observados

- owner / Gerardo
- DJMago305
- DJYuyo
- Alexander Reyes

**Nota:** Los perfiles duales **no** deben clasificarse automáticamente como errores. El Owner puede constituir un caso legítimo. Todos requieren revisión caso por caso en reconciliación futura.

---

## Limitaciones

El pooler remoto activó temporalmente un **circuit breaker** después de varias consultas consecutivas durante la pasada de inspección.

No se completaron en esa pasada:

- detalle completo Q6
- export completo Q1
- Q13
- Q14
- `identity_audit_contradictions.sql`

Estas consultas quedan pendientes de una **futura pasada read-only** y no invalidan los hallazgos principales (Ary, Aron, distribución Q15).

Este ticket **no** se describe como 100% exhaustivo. Se considera **suficiente** para confirmar los dos casos prioritarios del PO y establecer la distribución global.

---

## Conclusiones

1. **Ary** no está mal clasificado por el CRM; sus datos persistidos lo definen como **cliente**.
2. **Aron** no está mal clasificado por el CRM; sus datos persistidos lo definen como **artista**.
3. Ambos representan **deuda histórica de intención de alta** (`HISTORICAL SIGNUP INTENT MISALIGNMENT`).
4. Los fixes recientes (`a787220` onboarding, `07785ae` employment intent) protegen **altas futuras**, pero **no** corrigen registros históricos.
5. La reconciliación requiere ticket separado, dry-run, aprobación explícita del PO y estrategia reversible.
6. **No** se autoriza ninguna corrección automática en el cierre de este ticket.

---

## Próximo ticket recomendado

**TICKET-V1-PROFILE-RECONCILIATION-PLAN-001**

Alcance únicamente documental / dry-run:

- definir fuente de verdad;
- revisar Ary;
- revisar Aron;
- clasificar los 2 MISSING;
- revisar los 4 DUAL;
- preparar matriz before/after;
- definir rollback;
- **no** ejecutar cambios remotos.

---

## Cierre de sesión

| Item | Estado |
|------|--------|
| Inspección remota | COMPLETE (pasada previa) |
| Documentación | COMPLETE (esta pasada) |
| Reconciliación | NOT AUTHORIZED |
| Commit / push / PR / deploy | NOT AUTHORIZED |

**Ticket cerrado:** investigación read-only documentada. Espera PO para autorizar plan de reconciliación.
