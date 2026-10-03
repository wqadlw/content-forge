CREATE TABLE IF NOT EXISTS article_writes (
  article_id text PRIMARY KEY REFERENCES publications(article_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'written',
  genre text NOT NULL,
  title text NOT NULL,
  slug text NOT NULL,
  category text NOT NULL,
  summary text NOT NULL,
  seo_title text NOT NULL,
  seo_keywords text NOT NULL,
  seo_description text NOT NULL,
  body text NOT NULL,
  reject_reason text,
  prompt_version text NOT NULL,
  imported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS article_writes_status_created_idx ON article_writes (status, created_at);
