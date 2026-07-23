# TICKET-V2-NOTIFICATION-CENTER-DISCOVERY-001

## Notification Center — Discovery + Architecture (Documentation Only)

| Campo | Valor |
|-------|-------|
| Ticket | V2 Notification Center — Multichannel Discovery |
| Estado | **DISCOVERY DOCUMENTADO — COMMIT LOCAL AUTORIZADO PO** |
| Rama baseline | `plan/v2-phase-4-api-client` |
| HEAD baseline | `d500de67286271158fab053bfe956f5cecde68ac` |
| Fecha discovery | 2026-07-23 |
| Modo | **Documentación únicamente** — cero implementación |

---

## 0. Declaración operativa

Este ticket **no autoriza**:

- implementación TypeScript, runtime, Supabase, migraciones, providers, adapters;
- push real (APNs, FCM, Web Push SDK), email real, SMS real;
- UI, campana, workers, colas, Edge Functions;
- modificar archivos DC-1 OFTL (`finance/`, `oftl-data-contracts.test.ts`, ticket DC-1);
- staging, commit, push, PR, merge, deploy;
- iniciar Notification Data Contracts, Push Foundation ni dependencias npm.

**Estado exitoso:** DISCOVERY DOCUMENTADO · **SIN CÓDIGO** · commit local NC discovery autorizado PO · DC-1 sin tocar.

---

## 1. Objetivo

Diseñar una arquitectura **profesional y normalizada** para el **Notification Center** de Miami DJ Beat V2 — comportamiento general comparable al de plataformas sociales (actividad relevante → registro → notificación → campana in-app → push opcional → deep link seguro → historial leído/no leído y estado de entrega), **sin copiar** diseño, código, marcas ni IP de terceros.

Cubre conceptualmente: in-app · push · deep links · email transaccional · SMS opcional · preferencias · consentimiento · historial · deduplicación · reintentos · privacidad · seguridad · auditoría · integración futura con domain events (incl. OFTL §5B).

---

## 2. Distinción obligatoria: Notification Center vs Direct Messaging

| Dominio | Qué es | Qué NO es |
|---------|--------|-----------|
| **A. Notification Center** | Informa de **actividades relevantes** (comentario, reseña, booking, legal, finanzas, seguridad) | Chat / conversación |
| **B. Direct Messaging / Chat** | Conversaciones bidireccionales entre usuarios | Parte de este ticket |

**Regla:** Notification Center y Direct Messaging son **dominios separados**. Este discovery diseña solo **A**. Un mensaje futuro (`DIRECT_MESSAGE_RECEIVED`) **puede generar una notificación** en el Center; **no** diseña ni implementa el chat.

---

## 3. Baseline Git

| Check | Valor esperado | Resultado |
|-------|----------------|-----------|
| Rama | `plan/v2-phase-4-api-client` | ✓ |
| HEAD | `d500de67286271158fab053bfe956f5cecde68ac` | ✓ |
| Untracked conocidos (DC-1, no tocados) | `finance/`, `oftl-data-contracts.test.ts`, `TICKET-V2-OFTL-DC-1-…md` | ✓ |
| Otros cambios | Ninguno | ✓ |

---

## 4. Documentos de referencia leídos / citados

| Documento | Rol |
|-----------|-----|
| `docs/V2/MIAMIDJBEAT-PROYECTO-CONSTITUCION.md` | Gobernanza V2 |
| `docs/V2/MIAMIDJBEAT-PRODUCT-OWNER-VALIDATION-PROTOCOL.md` | Protocolo PO |
| `docs/workflow-control.md` | Sin commit/deploy sin autorización |
| `docs/AGENT-MEMORY.md` | Baseline producto |
| `docs/V2/README.md` | Mapa V2 |
| `TICKET-V2-ARTIST-CASH-FLOW-MANUAL-TRANSACTION-LEDGER-DISCOVERY-001.md` | §5B financial notifications + outbox |
| `TICKET-V2-OFTL-DATA-CONTRACTS-001.md` | DC-5 notification contracts futuros |
| `MiamiDJBeat-MigracionV2/shared/notifications/NOTIFICATIONS-SPEC.md` | MOD-011 scaffold documentado · **0 runtime** |
| `TICKET-V2-LEGAL-DATA-CONTRACTS-DISCOVERY-001.md` | LDC-014 `LegalNotification` (precedente parcial legal) |
| `docs/V2/ARCHITECTURE/MODULE-INDEX.md` | MOD-011 Notifications |

**Estado MOD-011 hoy:** especificación en repo · **no implementado** · no sustituye este discovery.

---

## 5. Experiencia de usuario (flujo canónico)

```
Actividad relevante (dominio origen)
        ↓
Domain Event (dueño = dominio origen)
        ↓
NotificationOutboxRecord (misma unidad transaccional lógica que el write de negocio)
        ↓
Notification Orchestrator (futuro — async, idempotente)
        ↓
Preferencias + Consentimiento + política de privacidad por canal
        ↓
IN_APP / PUSH / EMAIL / SMS (adaptadores)
        ↓
NotificationDelivery (estado por canal)
        ↓
Usuario toca notificación
        ↓
Autenticación + autorización + Deep-Link Resolver
        ↓
Recurso exacto (comentario, reseña, evento, legal, cash-flow, seguridad…)
        ↓
NotificationReadState actualizado
```

**Principio UX:** familiar para usuarios de redes sociales (campana, badge, lista, tap-to-open) · identidad MDJB · **privacidad en lock screen**.

---

## 6. Ejemplos obligatorios (plantillas conceptuales)

| Escenario | Mensaje (ES ejemplo) | Acción | Deep link conceptual |
|-----------|---------------------|--------|----------------------|
| **Nuevo comentario** | «Carlos comentó en tu perfil.» | Ver comentario | `/artist/profile?section=comments&commentId={id}` |
| **Nueva reseña** | «Recibiste una nueva reseña de un cliente.» | Ver reseña | `/artist/profile?section=reviews&reviewId={id}` |
| **Actualización perfil** | «Miami DJ Beat agregó información nueva a tu perfil.» | Revisar perfil | `/artist/profile?section={section}` |
| **Solicitud contratación** | «Tienes una nueva solicitud de contratación.» | Abrir solicitud | `/artist/requests?requestId={id}` |
| **Asignación evento** | «Fuiste asignado a un nuevo evento.» | Ver evento | `/artist/events?eventId={id}` |
| **Documento legal** | «Tienes un documento pendiente de revisión o firma.» | Revisar documento | `/artist/legal?documentId={id}` |
| **Actividad financiera** | «Tienes una actualización financiera en Miami DJ Beat.» | Revisar Cash Flow | `/artist/cash-flow?transactionId={id}` |
| **Mensaje futuro** | «Tienes un mensaje nuevo.» | Abrir conversación | `/artist/messages?conversationId={id}` *(dominio chat futuro)* |
| **Alerta seguridad** | «Detectamos una actividad importante en tu cuenta.» | Revisar seguridad | `/artist/account/security?eventId={id}` |

**Canonical language:** EN first for templates · ES secondary (i18n V2).

---

## 7. Política de privacidad — pantalla bloqueada / push / SMS

### 7.1 Permitido en push / lock screen

- «Tienes una actualización financiera en Miami DJ Beat.»
- «Tienes un documento pendiente.»
- «Carlos comentó en tu perfil.» *(nombre actor snapshot no sensible)*

### 7.2 Prohibido en push / lock screen / SMS predeterminado

- Montos: «Miami DJ Beat te debe $850.»
- Fiscal: «Tu formulario W-9 fue rechazado por número fiscal incorrecto.»
- Bancario, legal completo, notas internas staff, datos de terceros.

### 7.3 Detalle completo solo después de

1. Abrir app/portal · 2. Resolver deep link · 3. Validar sesión · 4. Validar permisos · 5. Verificar recurso existe · 6. Verificar acceso del usuario.

---

## 8. Inventario conceptual de eventos

**Regla:** eventos los **produce** el dominio origen · Notification Center **consume** · no todos requieren push.

### 8.1 Perfil y comunidad

| Evento | Dominio origen | NC |
|--------|----------------|-----|
| `PROFILE_COMMENT_CREATED` | Social / Profile | ✓ |
| `PROFILE_COMMENT_REPLIED` | Social / Profile | ✓ |
| `PROFILE_MENTION_CREATED` | Social / Profile | ✓ |
| `PROFILE_REVIEW_CREATED` | Reviews | ✓ |
| `PROFILE_INFORMATION_UPDATED` | Profile / Staff | ✓ |
| `PROFILE_APPROVED` | Moderation | ✓ |
| `PROFILE_REJECTED` | Moderation | ✓ |
| `PROFILE_VISIBILITY_CHANGED` | Profile | ✓ |

### 8.2 Booking y eventos

| Evento | Dominio origen | NC |
|--------|----------------|-----|
| `BOOKING_REQUEST_CREATED` | Booking | ✓ |
| `BOOKING_REQUEST_UPDATED` | Booking | ✓ |
| `ARTIST_ASSIGNED_TO_EVENT` | Events / Production | ✓ |
| `EVENT_SCHEDULE_CHANGED` | Events | ✓ |
| `EVENT_CANCELLED` | Events | ✓ |
| `EVENT_REMINDER_DUE` | Events / Scheduler | ✓ |

### 8.3 Legal

| Evento | Dominio origen | NC |
|--------|----------------|-----|
| `LEGAL_DOCUMENT_ASSIGNED` | Legal Center | ✓ |
| `LEGAL_DOCUMENT_VIEWED` | Legal *(opcional — baja prioridad)* | ○ |
| `LEGAL_DOCUMENT_SIGNATURE_REQUIRED` | Legal / Signing | ✓ |
| `LEGAL_DOCUMENT_SIGNED` | Legal | ✓ |
| `LEGAL_DOCUMENT_REJECTED` | Legal | ✓ |
| `W9_ACTION_REQUIRED` | Legal / Tax | ✓ |

### 8.4 Finanzas (integración OFTL futura)

| Evento | Dominio origen | NC |
|--------|----------------|-----|
| `FINANCIAL_TRANSACTION_POSTED` | OFTL | ✓ |
| `FINANCIAL_OBLIGATION_CREATED` | OFTL | ✓ |
| `PAYMENT_RECORDED` | OFTL | ✓ |
| `PAYMENT_REVERSED` | OFTL | ✓ |
| `CASH_FLOW_UPDATED` | Projection *(derivado — evitar duplicar PAYMENT_*)* | ○ |
| `FINANCIAL_ACTION_REQUIRED` | OFTL / Legal | ✓ |

*Filtrar redundancia con OFTL §5B.3 en fase contracts.*

### 8.5 Mensajería futura

| Evento | Dominio origen | NC |
|--------|----------------|-----|
| `DIRECT_MESSAGE_RECEIVED` | Messaging *(futuro)* | ✓ notificación only |
| `CONVERSATION_MENTION_CREATED` | Messaging *(futuro)* | ✓ |

### 8.6 Seguridad

| Evento | Dominio origen | NC |
|--------|----------------|-----|
| `NEW_DEVICE_LOGIN` | Auth | ✓ |
| `PASSWORD_CHANGED` | Auth | ✓ |
| `ACCOUNT_SECURITY_ALERT` | Auth / Security | ✓ |
| `CONTACT_INFORMATION_CHANGED` | Account | ✓ |

---

## 9. Modelo conceptual (sin TypeScript)

| Entidad | Responsabilidad |
|---------|-----------------|
| **`NotificationEvent`** | Hecho notificable derivado del domain event (payload normalizado, no PII excesiva) |
| **`NotificationRecipient`** | Quién recibe (userId, portal, role context) |
| **`NotificationRecord`** | Registro canónico interno MDJB de la notificación |
| **`NotificationOutboxRecord`** | Trabajo transaccional pendiente post-commit |
| **`NotificationTemplate`** | Título, cuerpo, variables, privacidad lock-screen, acciones |
| **`NotificationChannel`** | `IN_APP` · `PUSH` · `EMAIL` · `SMS` |
| **`NotificationDelivery`** | Intento de entrega por canal |
| **`NotificationPreference`** | Preferencias por categoría/evento/canal |
| **`NotificationConsent`** | Consentimiento (promocional vs transaccional) |
| **`NotificationReadState`** | UNREAD / READ / ARCHIVED |
| **`NotificationDeepLink`** | Destino seguro resuelto |
| **`DevicePushSubscription`** | Dispositivo autorizado para push |
| **`NotificationBatch`** | Agrupación futura de actividades similares |

**No implementar** interfaces, schemas SQL ni contratos en este ticket.

---

## 10. Fuente de verdad y responsabilidades

1. El **dominio origen** es dueño del **Domain Event** y del estado de negocio.
2. Notification Center **no modifica** el dominio origen.
3. **`NotificationRecord`** = registro interno de la notificación.
4. **`NotificationDelivery`** = intentos por canal (no sustituye Record).
5. Push, email, SMS = **canales de distribución**, no SSOT.
6. Fallo de proveedor **no deshace** la actividad original.
7. Reintentos **sin duplicar** notificación lógica (dedupe key).
8. Deep link **no concede** permisos.
9. Autorización se **revalida** al abrir el recurso.

---

## 11. Transactional Outbox

```
Operación de negocio confirmada
        ↓
Domain Event persistido (dominio origen)
        ↓
NotificationOutboxRecord creado (misma unidad transaccional lógica)
        ↓
Worker futuro procesa outbox
        ↓
NotificationRecord idempotente
        ↓
Entregas por canal
        ↓
NotificationDelivery status actualizado
```

**Campos conceptuales:** `idempotency_key` · `deduplication_key` · `correlation_id` · `causation_id` · `event_id` · `recipient_id` · `aggregate_id` · `retry_count` · `next_attempt_at` · `dead_letter_state` · `provider_reference`

**No implementar** workers, colas ni infraestructura en este ticket.

---

## 12. Estados conceptuales (separados)

### 12.1 `NotificationLifecycleStatus` (notificación lógica)

`CREATED` · `QUEUED` · `PROCESSING` · `COMPLETED` · `PARTIALLY_COMPLETED` · `FAILED` · `CANCELLED`

### 12.2 `NotificationDeliveryStatus` (por canal)

`PENDING` · `SENDING` · `SENT` · `DELIVERED` · `OPENED` · `FAILED` · `SUPPRESSED` · `EXPIRED`

*Alineación parcial OFTL §5B.6 — normalizar en NC-DC-1.*

### 12.3 `NotificationReadState`

`UNREAD` · `READ` · `ARCHIVED`

### 12.4 `PushPermissionStatus`

`UNKNOWN` · `PROMPT_REQUIRED` · `GRANTED` · `DENIED` · `REVOKED` · `UNSUPPORTED`

**Prohibido** mezclar lifecycle · delivery · read · permiso dispositivo · estados financieros OFTL.

---

## 13. Preferencias del usuario (matriz conceptual)

| Actividad | In-app | Push | Email | SMS |
|-----------|--------|------|-------|-----|
| Comentarios perfil | Sí | Configurable | No | No |
| Reseñas nuevas | Sí | Sí | Sí | No |
| Solicitudes trabajo | Sí | Sí | Sí | Opcional |
| Cambios evento | Sí | Sí | Sí | Opcional |
| Documentos legales | Sí | Sí | Sí | Opcional |
| Actividad financiera | Sí | Sí | Sí | Opcional |
| Alertas seguridad | Sí | Sí | Sí | Opcional |
| Promociones | Config. | Config. | Config. | No |

### 13.1 No desactivables completamente

- Alertas críticas de seguridad
- Cambios legales obligatorios (cuando producto/legal lo exija)
- Comunicaciones operativas indispensables (definición PO + Legal futuro)

### 13.2 Push permission vs preferencias de usuario

| Concepto | Capa | Ejemplo |
|----------|------|---------|
| **`PushPermissionStatus`** | Dispositivo / OS (APNs, FCM, browser prompt) | `DENIED` en iPhone |
| **`NotificationPreference`** | Producto MDJB por categoría/canal | Push off para comentarios |

**Regla:** permiso push denegado → `NotificationDelivery` `SUPPRESSED` en PUSH · **in-app sigue** si la actividad lo requiere. Preferencias de usuario **no sustituyen** consentimiento promocional ni revisión legal.

### 13.3 Clasificación transaccional · operativa · seguridad · promocional

| Clase | Consentimiento |
|-------|----------------|
| Transaccional | Implícito operativo + preferencia canal |
| Operativa | Preferencia + in-app mínimo |
| Seguridad | Push/email fuerte; no silenciable total |
| Promocional | **Consentimiento separado** |

---

## 14. Push notifications (conceptual)

Plataformas: iPhone · Android · navegador compatible · PWA posible · app nativa futura.

**No asumir** paridad Web Push / iOS / Android.

### 14.1 `DevicePushSubscription` (futuro)

| Campo conceptual | Notas |
|------------------|-------|
| `user_id` | Propietario |
| `device_id` | Identificador dispositivo |
| `platform` | ios / android / web |
| `push_token_ref` | Referencia; **no** en perfil público |
| `authorized_at` / `last_seen_at` | Auditoría |
| `status` | active / revoked / invalid |
| `app_environment` | prod / staging |
| `provider_metadata` | Mínima |

**No implementar** Firebase, APNs, Web Push SDK.

### 14.2 Comparación documental (sin selección)

| Opción | Notas discovery |
|--------|-----------------|
| **FCM** | Android + web común |
| **APNs** | iOS obligatorio |
| **Web Push (VAPID)** | PWA; limitaciones iOS |
| **OneSignal / similar** | SaaS; costo + vendor lock-in |

Selección = ticket futuro post-PO.

### 14.3 Múltiples dispositivos y revocación de tokens

- Un usuario puede tener **varios** `DevicePushSubscription` activos (teléfono, tablet, PWA).
- Cada entrega PUSH apunta al subscription correcto; fallo en uno **no** invalida otros.
- Token inválido / revocado → marcar subscription `invalid` o `revoked` · no reintentar infinitamente (§19, R-NC-05).
- Rotación de token → actualizar subscription sin duplicar `NotificationRecord`.

---

## 15. In-app Notification Center (sin UI implementada)

**Componentes UX documentados:**

- Campana + badge no leídas
- Lista cronológica · agrupación por fecha
- Icono/categoría · mensaje · actor · hora
- Acción principal · marcar leída · marcar todas leídas
- Historial · paginación / infinite scroll
- Empty / error / loading states
- Filtro opcional por categoría

### 15.1 Por portal

| Portal | Tipos principales |
|--------|-------------------|
| **Artist** | Perfil, booking, legal, finanzas, mensajes, seguridad |
| **Client** | Solicitudes, contratos, pagos, eventos, mensajes, seguridad |
| **Staff** | Operación, asignaciones, compliance, finanzas, legal, incidentes, seguridad |

Cada portal: permisos + privacidad + tenant isolation.

---

## 16. Deep links — estrategia

### 16.1 Requisitos obligatorios

`destination_type` · `route` · `resource_id` · `section?` · `action?` · `fallback_route` · `expiration_policy?` · `auth_required` · `authorization_required` · `source_notification_id`

### 16.2 Resolución al tap

1. Abrir MDJB · 2. Autenticación · 3. Restaurar sesión · 4. Validar permisos · 5. Recurso existe · 6. Abrir sección · 7. Marcar leída

### 16.3 Recurso eliminado / inaccesible

- Fallback seguro · sin PII · «contenido ya no disponible» · historial conservado según política retención

### 16.4 Seguridad

- Sin tokens permanentes en URL · sin enumeración predecible · re-auth para sensibles · deep link **no sustituye** autorización

---

## 17. Actor y perfil (snapshot)

| Campo | Uso |
|-------|-----|
| `actor_id` | Referencia estable |
| `actor_type` | user / staff / system |
| `display_name_snapshot` | Texto notificación |
| `avatar_ref?` | UI in-app |
| `target_profile_id` | Destinatario contexto |
| `action_type` | comment / review / assign / … |

Auditoría histórica **no depende** del nombre actual del actor.

---

## 18. Deduplicación y agrupación

**Ejemplo:** 5 comentarios en ventana corta → «5 personas comentaron en tu perfil» (una notificación lógica agrupada).

| Concepto | Propósito |
|----------|-----------|
| `deduplication_window` | Evitar duplicados mismo evento |
| `aggregation_window` | Agrupar eventos similares |
| `group_key` | category + target + time bucket |
| `event_count` · `latest_actor` · `actors_preview` | UI agrupada |
| `group_destination` | Deep link al listado |

**No agrupar:** eventos críticos que requieren acciones independientes (seguridad, legal blocking, reversión financiera).

**Claves conceptuales (OFTL §5B.7 alineado):**

```
deduplication_key = event_id + recipient_id + channel + template_version
group_key = notification_category + target_resource_id + aggregation_bucket
```

---

## 19. Reintentos y fallos

| Escenario | Política conceptual |
|-----------|---------------------|
| Proveedor caído | Retry exponential backoff |
| Token push inválido | Marcar subscription invalid · no retry infinito |
| Email rebotado | FAILED permanent · alert ops |
| SMS rechazado | SUPPRESSED / FAILED |
| Sin permiso push | SUPPRESSED · in-app sigue |
| Deep link expirado | Fallback route |
| Evento duplicado outbox | Idempotent skip |
| Entrega parcial | PARTIALLY_COMPLETED |

**Parámetros documentados:** max attempts · dead-letter · provider error normalization · manual replay autorizado (staff) · **retry no crea segunda NotificationRecord lógica**

---

## 20. Seguridad y autorización

- Tenant + portal isolation
- Recipient ownership
- RBAC + capability-based (`mdj_access_snapshot` futuro)
- Resource-level permission al resolver deep link
- No PII/finanzas/fiscal en push lock screen
- Rate limiting futuro · anti-abuse comentarios/menciones
- Audit trail · anti-spoofing (firmar notification_id interno)
- **Notificación ≠ autorización del recurso**

---

## 21. Retención y auditoría

**Timestamps conceptuales:** `created_at` · `queued_at` · `sent_at` · `delivered_at` · `opened_at` · `read_at` · `archived_at` · `failed_at` · `expires_at`

**Trazabilidad:** provider ref · error code · retry history · actor · recipient · source event · correlation_id

**Retención legal:** no inventar plazos definitivos — ticket Legal/Privacy futuro.

---

## 22. Relación con OFTL (conceptual — no modificar DC-1)

```
Owner Financial Transaction (OFTL canonical)
        ↓
FinancialDomainEvent
        ↓
NotificationOutboxRecord
        ↓
Notification Center (este discovery)
        ↓
In-app / Push / Email / SMS
```

| OFTL | Notification Center |
|------|---------------------|
| Produce evento financiero | Consume evento |
| No envía push/email/SMS directo | Orquesta canales |
| No decide preferencias | Aplica preferencias |
| No controla historial entrega | Registra Delivery + ReadState |
| Fallo canal no revierte pago | §5B.1 OFTL discovery |

---

## 23. Casos de uso NC-UC-01 … NC-UC-18

| ID | Escenario | Resultado esperado |
|----|-----------|-------------------|
| **NC-UC-01** | Comentario en perfil artista | Record + in-app + push si permitido |
| **NC-UC-02** | Varios comentarios ventana corta | Agrupación · un push lógico |
| **NC-UC-03** | Tap push → comentario | Deep link abre comentario exacto |
| **NC-UC-04** | Sin sesión | Auth gate · luego recurso |
| **NC-UC-05** | Comentario eliminado | Fallback seguro · sin PII |
| **NC-UC-06** | Push denegado | In-app permanece |
| **NC-UC-07** | Token dispositivo inválido | Subscription revoked · retry no spam |
| **NC-UC-08** | Proveedor push caído | Retry idempotente · negocio intacto |
| **NC-UC-09** | Transacción financiera OFTL | Alerta privada · sin monto en lock screen |
| **NC-UC-10** | Reversión financiera | Nueva notificación independiente |
| **NC-UC-11** | Staff agrega documento legal | Notificación legal + deep link |
| **NC-UC-12** | Marcar una leída | ReadState READ |
| **NC-UC-13** | Marcar todas leídas | Bulk read |
| **NC-UC-14** | Push off comentarios · on reseñas | Preferencias respetadas |
| **NC-UC-15** | Alerta seguridad crítica | Ignora silencio promocional |
| **NC-UC-16** | Mensaje futuro | Notificación sin chat implementado |
| **NC-UC-17** | Deep link otro artista | Acceso rechazado |
| **NC-UC-18** | Evento duplicado outbox | Sin segunda NotificationRecord |

---

## 24. Roadmap futuro (documental)

| Fase | Ticket sugerido | Entrega |
|------|-----------------|---------|
| **NC-DC-1** | Notification Data Contracts | Types + guards |
| **NC-DC-2** | Notification Preferences Contracts | Preference matrix |
| **NC-DC-3** | Notification Outbox Provider | Outbox persistence |
| **NC-DC-4** | Notification Orchestrator | Processing pipeline |
| **NC-DC-5** | In-App Notification Center UI | Campana + lista |
| **NC-DC-6** | Deep-Link Resolver | AuthZ + fallback |
| **NC-DC-7** | Push Subscription Foundation | DevicePushSubscription |
| **NC-DC-8** | Push Delivery Adapter | FCM/APNs/Web |
| **NC-DC-9** | Email and SMS Delivery Integration | Adaptadores |
| **NC-DC-10** | Notification Audit and Retry Operations | Ops + DLQ |
| **NC-DC-11** | Portal Notification Wires | Artist/Client/Staff |
| **NC-DC-12** | Mobile/PWA Validation | Cross-platform QA |

**Ninguno autorizado** por este ticket.

---

## 25. Dependency Matrix

Dependencia **arquitectónica** (no orden de implementación estricto):

```
NotificationEvent (domain)
        ↓
NotificationOutboxRecord
        ↓
NotificationRecord
        ↓
NotificationPreference + NotificationTemplate (paralelo posible)
        ↓
NotificationDelivery
        ↓
Channel Adapter (PUSH / EMAIL / SMS — opcionales entre sí)
        ↓
DevicePushSubscription (solo PUSH)
        ↓
Deep-Link Resolver (paralelo con templates)
        ↓
Portal UI (campana — no depende de proveedor push)
```

| Paralelo permitido | Notas |
|--------------------|-------|
| Deep-link model ∥ templates | Sin adapter push |
| Preferencias ∥ templates | Sin UI |
| In-app center ∥ push adapter | In-app no bloqueado por FCM/APNs |
| Email/SMS | Adaptadores opcionales |
| Direct Messaging | **No bloquea** Notification Center |

---

## 26. Riesgos

| ID | Riesgo |
|----|--------|
| R-NC-01 | Notification fatigue / exceso de push |
| R-NC-02 | Duplicación lógica |
| R-NC-03 | Pérdida eventos sin outbox |
| R-NC-04 | Permisos push denegados |
| R-NC-05 | Tokens expirados / rotación |
| R-NC-06 | PII en lock screen |
| R-NC-07 | Deep links inseguros |
| R-NC-08 | Divergencia read vs delivery |
| R-NC-09 | Vendor lock-in push |
| R-NC-10 | Costos SMS |
| R-NC-11 | Restricciones iOS / browsers / PWA |
| R-NC-12 | Múltiples dispositivos por usuario |
| R-NC-13 | Cuentas compartidas |
| R-NC-14 | Comentarios abusivos / spam |
| R-NC-15 | Recurso eliminado post-notificación |
| R-NC-16 | Localización ES/EN |
| R-NC-17 | Accesibilidad campana/lista |
| R-NC-18 | Retención / GDPR-style *(Legal futuro)* |
| R-NC-19 | Consentimiento promocional |
| R-NC-20 | Escalabilidad outbox workers |
| R-NC-21 | Observabilidad cross-canal |

---

## 27. Supervisión legal y compliance

**ESTADO LEGAL:**

**ARQUITECTURA TÉCNICA — PENDIENTE DE REVISIÓN LEGAL PROFESIONAL**

Este documento **no afirma**:

- legalmente aprobado · compliant de forma definitiva · cumplimiento garantizado;
- consentimiento suficiente en todas las jurisdicciones;
- plazos legales definitivos · política de retención legal definitiva.

Las decisiones legales definitivas serán revisadas por **abogado competente** antes de producción. **No** se citan leyes específicas en este discovery salvo investigación legal autorizada futura.

### 27.1 Gates futuros de revisión legal (documentales)

| Área | Gate futuro |
|------|-------------|
| Privacidad general | Legal + Privacy PO |
| Consentimiento push | Legal + producto |
| Consentimiento email | Legal + CAN-SPAM / equivalente *(revisión profesional)* |
| Consentimiento SMS | Legal + carrier rules *(revisión profesional)* |
| Comunicaciones promocionales | Consentimiento separado · opt-in |
| Comunicaciones transaccionales | Clasificación + mínimos operativos |
| Opt-in / opt-out / revocación | Legal Center + account settings |
| Retención / eliminación | Legal + Privacy ticket |
| Datos personales | Minimización · snapshot actor |
| Información financiera / fiscal | Lock-screen policy §7 |
| Menores *(si aplica)* | Legal PO |
| Términos de uso · política de privacidad | Legal PO |
| Proveedores externos (FCM, email, SMS) | DPA / subprocessors review |
| Transferencias de datos | Legal PO |
| Logs y auditoría | Retención legal futura |

---

## 28. Control de riesgo de regresiones

Este ticket es **documentation-only**. Confirmación explícita:

| Área | ¿Modificado por este ticket? |
|------|------------------------------|
| Contratos TypeScript runtime | No |
| Portales / navegación / auth / permisos | No |
| Legal Center · Artist Cash Flow · OFTL | No |
| Supabase · configuración · dependencias npm | No |

**RIESGO FUNCIONAL DIRECTO:**

**NULO EN RUNTIME, PORQUE EL COMMIT ES EXCLUSIVAMENTE DOCUMENTAL.**

**RIESGO ARQUITECTÓNICO:**

**CONTROLADO MEDIANTE FUTUROS GATES PO, SEGURIDAD, PRIVACIDAD Y REVISIÓN LEGAL ANTES DE IMPLEMENTACIÓN.**

---

## 29. Criterios de aceptación (discovery)

- [x] Objetivo y alcance documentados
- [x] Fuera de alcance explícito (§0)
- [x] Notification Center ≠ Direct Messaging (§2)
- [x] UX flujo social-like (§5)
- [x] Inventario eventos (§8)
- [x] Modelo conceptual (§9)
- [x] Estados separados (§12)
- [x] Canales IN_APP/PUSH/EMAIL/SMS (§13–14)
- [x] Preferencias + consentimiento (§13)
- [x] Push conceptual (§14)
- [x] In-app center (§15)
- [x] Deep links (§16)
- [x] Privacidad lock screen (§7)
- [x] Seguridad (§20)
- [x] Transactional outbox (§11)
- [x] Deduplicación + agrupación (§18)
- [x] Retries (§19)
- [x] Auditoría (§21)
- [x] NC-UC-01…18 (§23)
- [x] Integración OFTL conceptual (§22)
- [x] Roadmap (§24)
- [x] Dependency Matrix (§25)
- [x] Riesgos (§26)
- [x] Gates PO (§30)
- [x] Supervisión legal §27 · regresiones §28
- [x] Sin código · DC-1 no modificado

---

## 30. Gates de aprobación PO

1. Aprobar discovery Notification Center (POAC).
2. Autorizar NC-DC-1 Data Contracts (ticket separado).
3. Autorizar commit de **este** documento (frase explícita PO).
4. **No** seleccionar proveedor push hasta ticket NC-DC-8 + PO.
5. **No** mezclar implementación chat con NC.

---

## 31. Confirmación final

| Afirmación | Estado |
|------------|--------|
| Discovery documentado | ✓ |
| Commit local NC discovery | Autorizado PO · ver post-commit |
| Código TypeScript | ✗ |
| Supabase / migraciones | ✗ |
| Push / email / SMS real | ✗ |
| UI implementada | ✗ |
| DC-1 OFTL modificado | ✗ |
| Push remoto | ✗ |

**Estado post-commit autorizado:**

**NOTIFICATION CENTER DISCOVERY — DOCUMENTADO Y COMMITTED LOCALMENTE**

**PENDIENTE DE:** aprobación arquitectónica PO · revisión seguridad · privacidad · **revisión legal profesional** · NC-DC-1 · implementación · validación visual · release V2.

No marcar: IMPLEMENTADO · LEGALMENTE APROBADO · COMPLIANT · PRODUCTION READY · RELEASED.

*Documento canónico discovery Notification Center V2. Implementación requiere ticket + aprobación PO.*
