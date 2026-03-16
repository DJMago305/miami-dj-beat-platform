-- Migration: Add availability column to dj_profiles
-- Reason: Fix Supabase error in Agenda tab
-- Impact: Allows storing blocked dates and vacation mode

ALTER TABLE dj_profiles 
ADD COLUMN IF NOT EXISTS availability JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN dj_profiles.availability IS 'Stores blocked dates and vacation periods for the DJ';
