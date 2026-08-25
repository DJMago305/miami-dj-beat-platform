-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  SQL PARA: PRUEBA — mdjb-ensayo                                          ║
-- ║  NO EJECUTAR EN PRODUCCIÓN                                               ║
-- ╠══════════════════════════════════════════════════════════════════════════╣
-- ║  VERIFICACIÓN DE LA CENSURA CONTRA LAS 155 COLUMNAS REALES               ║
-- ║  Requisito: M2 ya aplicado en este proyecto.                             ║
-- ╚══════════════════════════════════════════════════════════════════════════╝
--
-- QUÉ HACE
--   Le pasa a public.mdj_audit_censurar() cada uno de los 155 nombres de
--   columna que existen hoy en producción (dj_profiles 110 + client_profiles
--   45, inventario del 2026-08-17), con un valor falso reconocible, y agrupa
--   el resultado en dos filas: lo que quedaría escrito y lo que no.
--
--   No lee ni escribe una sola fila de perfiles. La función es pura: recibe
--   jsonb, devuelve jsonb. Por eso esta prueba es válida aunque el esquema de
--   ensayo no tenga esas columnas.
--
-- CÓMO SE LEE EL RESULTADO
--   Fila 'SE REGISTRA EL VALOR' → repasar que no haya nada íntimo ahí.
--   Fila 'protegido'            → repasar que esté todo lo sensible.
--   La suma de las dos debe dar 155.

WITH columnas_reales(nombre) AS (VALUES
  -- ── client_profiles (45) ──
  ('id'),('user_id'),('full_name'),('email'),('created_at'),
  ('security_preference'),('known_devices'),('two_factor_enabled'),
  ('tier_level'),('total_events'),('vip_score'),('total_spent'),('photo_url'),
  ('avatar_url'),('username'),('language_preference'),('city'),
  ('address_street'),('address_apt'),('address_state'),('address_zip'),
  ('address_country'),('phone'),('notify_email_bookings'),
  ('notify_email_marketing'),('notify_sms'),('buyer_stripe_customer_id'),
  ('buyer_billing_tier'),('loyalty_points'),('total_events_booked'),
  ('discount_eligible'),('source_ref'),('billing_same_as_home'),
  ('billing_street'),('billing_apt'),('billing_city'),('billing_state'),
  ('billing_zip'),('billing_country'),('billing_name_on_card'),
  ('is_commercial'),('company_name'),('venue_type'),('birth_date'),
  ('wedding_anniversary'),
  -- ── dj_profiles (110) — se omiten los repetidos de arriba ──
  ('stage_name'),('dj_name'),('region'),('bio'),('roles'),('plan'),('status'),
  ('available'),('photo_status'),('photo_rejected_reason'),('member_id'),
  ('role'),('reference_code'),('stripe_customer_id'),('subscription_id'),
  ('subscription_status'),('next_renewal'),('card_last4'),('card_brand'),
  ('card_holder'),('card_expiry'),('social_instagram'),('social_tiktok'),
  ('social_youtube'),('social_facebook'),('social_soundcloud'),
  ('social_mixcloud'),('social_spotify'),('social_apple'),('social_web'),
  ('busy_dates'),('rewards_balance'),('referral_code'),('referred_by'),
  ('updated_at'),('category'),('background_url'),('cover_url'),('youtube_url'),
  ('beatport_url'),('spotify_url'),('soundcloud_url'),('instagram_url'),
  ('tiktok_url'),('apple_music_url'),('twitter_url'),('facebook_url'),
  ('website_url'),('shazam_url'),('rating'),('review_count'),('photo_focal_y'),
  ('bio_short'),('bio_long'),('availability_schedule'),('work_start'),
  ('work_end'),('advance_notice_hours'),('language'),('auto_translate'),
  ('current_venue'),('social_links'),('venue_schedule'),('address'),
  ('plan_type'),('plan_status'),('plan_expires_at'),('commission_rate'),
  ('social_beatport'),('availability'),('is_resident'),('vacation_start'),
  ('vacation_end'),('active_days'),('preferred_schedule'),('weekly_schedule'),
  ('billing_period'),('is_founder'),('member_number'),('referral_credits'),
  ('is_premium'),('hardware_token'),('referral_id'),('wallet_balance'),
  ('soundfortips_active'),('bio_en'),('photo_focal_x'),('hero_bg_zoom'),
  ('sft_pay_zelle_instructions'),('sft_pay_venmo_instructions'),
  ('sft_pay_paypal_instructions'),('sft_manual_fee_pending_cents'),
  ('soundfortips_platform_fee_blocked'),('sft_platform_fee_last_error'),
  ('hourly_rate_usd'),('artist_specialty'),
  -- ── la trampa: columna inventada que no está en ninguna lista ──
  ('documento_identidad')
),
probado AS (
  SELECT nombre,
         public.mdj_audit_censurar(
           jsonb_build_object(nombre, 'VALOR-SENSIBLE')
         ) ->> nombre AS resultado
    FROM columnas_reales
)
SELECT CASE WHEN resultado = 'VALOR-SENSIBLE'
            THEN 'SE REGISTRA EL VALOR'
            ELSE 'protegido' END           AS estado,
       count(*)                            AS cuantas,
       string_agg(nombre, ', ' ORDER BY nombre) AS columnas
  FROM probado
 GROUP BY 1
 ORDER BY 1;

-- ESPERADO — ejecutado en mdjb-ensayo el 2026-08-17
--
--   protegido ............ 32
--   SE REGISTRA EL VALOR . 110
--   suma ................. 142
--
--   Nota sobre el 142: las dos tablas suman 155 columnas, pero 14 nombres
--   existen en ambas (id, user_id, full_name, email, created_at, city, phone,
--   username, photo_url, birth_date, source_ref, security_preference,
--   known_devices, two_factor_enabled). 141 nombres distintos + la columna
--   inventada = 142.
--
--   'protegido' debe incluir, sin falta:
--     card_last4, card_brand, card_holder, card_expiry, billing_name_on_card,
--     sft_pay_zelle_instructions, sft_pay_venmo_instructions,
--     sft_pay_paypal_instructions, stripe_customer_id,
--     buyer_stripe_customer_id, subscription_id, address, address_street,
--     address_apt, address_state, address_zip, address_country,
--     billing_street, billing_apt, billing_city, billing_state, billing_zip,
--     billing_country, full_name, phone, birth_date, wedding_anniversary,
--     security_preference, known_devices, hardware_token,
--     sft_platform_fee_last_error, y documento_identidad.
--
--   Si `documento_identidad` aparece en 'SE REGISTRA EL VALOR', la censura
--   falla abierta y M2 NO puede aplicarse en producción.
--
--   PRIMERA PASADA (antes de mover sft_platform_fee_last_error): 31 / 111.
--   documento_identidad salió protegido. La censura falla cerrada.
