-- ═══════════════════════════════════════════════════════════════════════════
-- ENTORNO: PRODUCCIÓN  ·  proyecto hkuvuqupbxwkiykxvqdr
-- NO EJECUTAR EN PRUEBA (rtbsovavmtnjpbbpwsin) — no hay nada que liberar allí.
-- Fecha: 2026-09-02
--
-- QUÉ LIBERA Y POR QUÉ
-- Sesiones de voz que quedaron en estado 'open' sin haber existido nunca:
-- OpenAI rechazó la llamada (400 invalid_offer el 30-ago, 429 sin crédito el
-- 2-sep) y la vía de reembolso reventaba con
--     TypeError: ADMIN.rpc(...).catch is not a function
-- antes de devolver el bloque de 900 s. Cada intento fallido retuvo 15 minutos
-- contra safety_cap_seconds del propio usuario. Medido: 25 sesiones · 22.500 s.
--
-- El fallo de código ya está corregido (helper devolverReserva); esto solo
-- limpia lo que quedó atascado ANTES del arreglo.
--
-- SEGURO POR CONSTRUCCIÓN: solo toca filas que llevan más de 30 minutos sin
-- latido. Una sesión viva manda heartbeat cada 4 minutos, así que una llamada
-- en curso NUNCA entra en este conjunto.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── PASO 1 · MIRAR ANTES DE TOCAR. Ejecuta esto solo y revisa el resultado.
select id,
       to_char(opened_at    at time zone 'UTC', 'DD-Mon HH24:MI') as abierta_utc,
       to_char(last_seen_at at time zone 'UTC', 'DD-Mon HH24:MI') as ultimo_latido_utc,
       reserved_seconds,
       round(extract(epoch from (now() - coalesce(last_seen_at, opened_at))) / 60) as minutos_sin_latido
from elixis_voice_sessions
where status = 'open'
  and coalesce(last_seen_at, opened_at) < now() - interval '30 minutes'
order by opened_at;

-- ── PASO 2 · LIBERAR. Usa la MISMA función de liquidación que usa la app
-- (p_used = 0: no se consumió ni un segundo), para que el saldo se devuelva
-- por el camino oficial y no a mano sobre las tablas.
select s.id,
       (elixis_voice_settle(s.id, 0)).*
from elixis_voice_sessions s
where s.status = 'open'
  and coalesce(s.last_seen_at, s.opened_at) < now() - interval '30 minutes';

-- ── PASO 3 · COMPROBAR. Debe quedar 0 filas colgadas y bajar el consumo.
select status, count(*) as sesiones, sum(reserved_seconds) as reservado_s
from elixis_voice_sessions
group by status;

select flagship_used_seconds, safety_cap_seconds
from elixis_voice_quotas
where user_id = '01f4f6b5-1e3c-48e9-9fb7-a58b78c9eee4';
