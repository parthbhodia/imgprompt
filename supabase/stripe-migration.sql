-- Stripe subscription columns on profiles
-- Run once in Supabase SQL Editor

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credits               integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_customer_id    text,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_plan           text,         -- 'starter' | 'pro' | 'unlimited'
  ADD COLUMN IF NOT EXISTS stripe_status         text;         -- 'active' | 'past_due' | 'canceled'

-- Unique index so we can look up a profile by Stripe customer ID
CREATE UNIQUE INDEX IF NOT EXISTS profiles_stripe_customer_id_idx
  ON public.profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
