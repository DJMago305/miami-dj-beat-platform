-- ENTORNO: PRODUCCION (proyecto hkuvuqupbxwkiykxvqdr) - Mario Valerio (Cachita Restaurante) es un amigo del PO -> lista «Amigo» del Network
-- Dato del PO (2026-10-05). Agrega a la lista «Amigo» que ya existe; NO lo saca de «Venues». Idempotente.
insert into public.network_list_members (list_id, fuente, contacto_id)
select l.id, 'referencia', '311936f8-853e-472a-9a1b-6d58745e0826'   -- Mario Valerio (Cachita Restaurante)
  from public.network_lists l
 where lower(btrim(l.name)) = 'amigo'
on conflict do nothing;

-- Comprobacion: «Amigo» debe pasar de 1 a 2 miembros
select l.name, count(m.*) as miembros
  from public.network_lists l left join public.network_list_members m on m.list_id = l.id
 where lower(btrim(l.name)) = 'amigo' group by l.name;
