-- Add timezone_manual flag: when true, auto-detect won't overwrite user's manual choice
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS timezone_manual boolean NOT NULL DEFAULT false;