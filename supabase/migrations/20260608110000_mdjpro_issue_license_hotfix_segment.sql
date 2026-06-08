-- Hotfix: _mdjpro_random_key_segment(smallint) vs literal integer 4 in _mdjpro_generate_license_key.
-- PostgreSQL treats untyped numeric literals as integer; callers use _mdjpro_random_key_segment(4).
-- No data changes. Safe to re-run after Fase 2 DDL.

DROP FUNCTION IF EXISTS public._mdjpro_random_key_segment(smallint);

CREATE OR REPLACE FUNCTION public._mdjpro_random_key_segment(p_len integer DEFAULT 4)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $fn$
DECLARE
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_out      text := '';
  v_i        integer;
  v_idx      integer;
BEGIN
  IF p_len IS NULL OR p_len < 1 THEN
    RAISE EXCEPTION 'invalid segment length';
  END IF;

  FOR v_i IN 1..p_len LOOP
    v_idx := 1 + floor(random() * length(v_alphabet))::integer;
    v_out := v_out || substr(v_alphabet, v_idx, 1);
  END LOOP;

  RETURN v_out;
END
$fn$;

REVOKE ALL ON FUNCTION public._mdjpro_random_key_segment(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public._mdjpro_random_key_segment(integer) TO service_role;
