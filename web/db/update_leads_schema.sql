-- SUPABASE SQL EXPLORER COMMAND 
-- Run this directly in the Supabase Dashboard SQL Editor
-- Phase 5 - Critical Update: Add precise Geospatial tracking to Leads for Weather Intelligence

ALTER TABLE leads
ADD COLUMN lat float,
ADD COLUMN lon float;

-- Optional: If you want to mock coordinates on the current dummy Lead for testing
-- UPDATE leads SET lat = 25.0865, lon = -80.4473 WHERE id = 'your-lead-id';
