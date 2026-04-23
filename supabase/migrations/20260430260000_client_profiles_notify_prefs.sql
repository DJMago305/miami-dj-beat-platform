-- Client communication preferences (account-settings Preferences card)
ALTER TABLE public.client_profiles
  ADD COLUMN IF NOT EXISTS notify_email_bookings BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_email_marketing BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_sms BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN public.client_profiles.notify_email_bookings IS 'Transactional email: bookings, account activity.';
COMMENT ON COLUMN public.client_profiles.notify_email_marketing IS 'Marketing / platform news (opt-in).';
COMMENT ON COLUMN public.client_profiles.notify_sms IS 'SMS alerts when product supports it; uses profile phone.';
