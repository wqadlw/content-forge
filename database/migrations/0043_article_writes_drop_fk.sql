-- 批次 F4：技术文档线成稿不来自 publications（来源=站点产品库），去掉外键约束、保留唯一性。
ALTER TABLE article_writes DROP CONSTRAINT IF EXISTS article_writes_article_id_fkey;
