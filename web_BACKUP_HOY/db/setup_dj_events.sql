-- SUPABASE SQL EXPLORER COMMAND 
-- Run this directly in the Supabase Dashboard SQL Editor
-- Phase 5: Event Intelligence System

create table dj_events (
  id uuid primary key default gen_random_uuid(),
  name text,
  location text,
  lat float,
  lon float,
  event_date timestamp,
  created_at timestamp default now()
);

-- DYNAMIC MOCK SEED INITIALIZATION (48 Hours from now calculation requires JS runtime before insert, 
-- but for hardcoded testing in SQL, we can use interval mapping)
INSERT INTO dj_events (name, location, lat, lon, event_date)
VALUES ('Beach Vibes', 'Key Largo', 25.0865, -80.4473, NOW() + INTERVAL '48 HOURS');
