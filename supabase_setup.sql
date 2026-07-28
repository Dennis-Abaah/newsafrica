-- ============================================================
-- NEWS AFRICA — Supabase SQL Setup Script
-- Paste this entire script into the Supabase SQL Editor and run.
-- ============================================================

-- ===========================================
-- 1. CREATE THE "articles" TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS public.articles (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT NOT NULL,
  excerpt     TEXT,
  content     TEXT NOT NULL,
  category    TEXT NOT NULL CHECK (category IN ('news', 'business', 'sports', 'entertainment', 'health', 'politics', 'culture', 'society')),
  image_url   TEXT,
  video_url   TEXT,
  is_breaking BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Index for common queries
CREATE INDEX IF NOT EXISTS idx_articles_category ON public.articles (category);
CREATE INDEX IF NOT EXISTS idx_articles_created_at ON public.articles (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_is_breaking ON public.articles (is_breaking) WHERE is_breaking = TRUE;

-- ===========================================
-- 2. ENABLE ROW LEVEL SECURITY
-- ===========================================

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- 3. RLS POLICIES
-- ===========================================

-- Anyone can read articles (public website)
-- Anyone can read articles (public website)
DROP POLICY IF EXISTS "Public read access" ON public.articles;
CREATE POLICY "Public read access"
  ON public.articles
  FOR SELECT
  USING (true);

-- Only authenticated users can insert
DROP POLICY IF EXISTS "Authenticated users can insert" ON public.articles;
CREATE POLICY "Authenticated users can insert"
  ON public.articles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.role() = 'authenticated');

-- Only authenticated users can update
DROP POLICY IF EXISTS "Authenticated users can update" ON public.articles;
CREATE POLICY "Authenticated users can update"
  ON public.articles
  FOR UPDATE
  TO authenticated
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Only authenticated users can delete
DROP POLICY IF EXISTS "Authenticated users can delete" ON public.articles;
CREATE POLICY "Authenticated users can delete"
  ON public.articles
  FOR DELETE
  TO authenticated
  USING (auth.role() = 'authenticated');

-- ===========================================
-- 4. MIGRATION: Update category constraint
--    (Run this if the table already exists)
-- ===========================================

-- Drop the old CHECK constraint and add the updated one
ALTER TABLE public.articles DROP CONSTRAINT IF EXISTS articles_category_check;
ALTER TABLE public.articles ADD CONSTRAINT articles_category_check
  CHECK (category IN ('news', 'business', 'sports', 'entertainment', 'health', 'politics', 'culture', 'society'));

