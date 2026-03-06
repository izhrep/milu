-- Create user profiles table for personal information
CREATE TABLE public.user_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  phone TEXT,
  birth_date DATE,
  avatar_url TEXT,
  bio TEXT,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  work_address TEXT,
  store_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create achievements table
CREATE TABLE public.achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('innovation', 'training', 'sales', 'teamwork', 'leadership')),
  icon_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- Create user achievements junction table
CREATE TABLE public.user_achievements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id),
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- Enable RLS
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

-- Create user skills junction table
CREATE TABLE public.user_skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  skill_id UUID NOT NULL REFERENCES public.skills(id),
  current_level NUMERIC NOT NULL DEFAULT 1 CHECK (current_level >= 1 AND current_level <= 5),
  target_level NUMERIC CHECK (target_level >= 1 AND target_level <= 5),
  last_assessed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, skill_id)
);

-- Enable RLS
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;

-- Create user qualities junction table
CREATE TABLE public.user_qualities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  quality_id UUID NOT NULL REFERENCES public.qualities(id),
  current_level NUMERIC NOT NULL DEFAULT 1 CHECK (current_level >= 1 AND current_level <= 5),
  target_level NUMERIC CHECK (target_level >= 1 AND target_level <= 5),
  last_assessed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, quality_id)
);

-- Enable RLS
ALTER TABLE public.user_qualities ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own profile"
ON public.user_profiles
FOR SELECT
USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own profile"
ON public.user_profiles
FOR UPDATE
USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own profile"
ON public.user_profiles
FOR INSERT
WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Everyone can view achievements"
ON public.achievements
FOR SELECT
USING (true);

CREATE POLICY "Users can view their own achievements"
ON public.user_achievements
FOR SELECT
USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view their own skills"
ON public.user_skills
FOR SELECT
USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own skills"
ON public.user_skills
FOR UPDATE
USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can view their own qualities"
ON public.user_qualities
FOR SELECT
USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own qualities"
ON public.user_qualities
FOR UPDATE
USING (auth.uid()::text = user_id::text);

-- Admin policies
CREATE POLICY "Admins can manage user_profiles"
ON public.user_profiles
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage achievements"
ON public.achievements
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage user_achievements"
ON public.user_achievements
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage user_skills"
ON public.user_skills
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage user_qualities"
ON public.user_qualities
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create triggers for updated_at
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_achievements_updated_at
  BEFORE UPDATE ON public.achievements
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_skills_updated_at
  BEFORE UPDATE ON public.user_skills
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_qualities_updated_at
  BEFORE UPDATE ON public.user_qualities
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();