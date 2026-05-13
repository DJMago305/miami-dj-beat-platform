-- MDJ — Identificar actores para pruebas JWT event_notes (solo SELECT, sin modificar datos)

-- 1) Usuario management válido para TEST 1
SELECT
  d.user_id AS auth_user_id,
  u.email,
  d.role,
  public.is_staff_management(d.user_id) AS is_staff_management
FROM public.dj_profiles d
JOIN auth.users u ON u.id = d.user_id
WHERE public.is_staff_management(d.user_id) = true
ORDER BY d.role, u.email;

-- 2) DJs disponibles
SELECT
  d.id AS dj_profile_id,
  d.user_id AS auth_user_id,
  d.stage_name,
  u.email,
  d.role
FROM public.dj_profiles d
JOIN auth.users u ON u.id = d.user_id
ORDER BY d.stage_name NULLS LAST, u.email;

-- 3) Leads asignados
SELECT
  l.id AS event_id,
  l.assigned_dj_id,
  dj.user_id AS dj_uuid_for_event_notes,
  dj.stage_name,
  u.email,
  l.event_type,
  l.location,
  l.status
FROM public.leads l
JOIN public.dj_profiles dj ON dj.id = l.assigned_dj_id
JOIN auth.users u ON u.id = dj.user_id
WHERE l.assigned_dj_id IS NOT NULL
ORDER BY l.event_date DESC NULLS LAST, l.created_at DESC;
