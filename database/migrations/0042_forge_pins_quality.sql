-- 批次 F3：人工在环——车间编辑的"必写"短名单 + 成稿抽检判定
CREATE TABLE IF NOT EXISTS forge_pins (
  article_id text PRIMARY KEY REFERENCES publications(article_id) ON DELETE CASCADE,
  pinned_by text NOT NULL,
  pinned_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE article_writes ADD COLUMN IF NOT EXISTS quality text;
ALTER TABLE article_writes ADD COLUMN IF NOT EXISTS quality_note text;
ALTER TABLE article_writes ADD COLUMN IF NOT EXISTS quality_by text;
ALTER TABLE article_writes ADD COLUMN IF NOT EXISTS quality_at timestamptz;
