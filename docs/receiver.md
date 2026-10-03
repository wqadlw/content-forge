# 接收端点参考实现

Content Forge 把成品 POST 到你网站的接收端点（`SITE_IMPORT_BASE` + `/internal-api/v1/content/import`，头 `X-Internal-Token: <SITE_IMPORT_TOKEN>`）。本页给两个最小可用的参考实现。

## 载荷契约

```json
{
  "items": [
    {
      "title": "文章标题（必填）",
      "slug": "url-slug（必填，唯一键，幂等去重依据）",
      "type": "news | guide | repair | wiki（可选，默认 news）",
      "category": "分类（可选）",
      "summary": "摘要（可选）",
      "body": "HTML 正文（必填）",
      "seo_title": "SEO 标题（可选）",
      "seo_keywords": "SEO 关键词，逗号分隔（可选）",
      "seo_description": "SEO 描述（可选）",
      "author": "作者（可选）",
      "source": "来源标注（可选）",
      "featured": true | false（可选，是否进精选位）
    }
  ]
}
```

响应：`{ "created": <n>, "skipped": <n> }`——按 slug 幂等，重推安全。

## WordPress 参考实现（自定义端点插件）

```php
<?php
/**
 * Plugin Name: Content Forge Receiver
 * 接收 Content Forge 推送，wp_insert_post 入库（title/slug/content/ excerpt）。
 */
add_action('rest_api_init', function () {
    register_rest_route('forge/v1', '/import', [
        'methods'  => 'POST',
        'callback' => 'forge_import',
        'permission_callback' => function ($req) {
            return hash_equals(get_option('forge_token', ''), (string) $req->get_header('X-Internal-Token'));
        },
    ]);
});

function forge_import(WP_REST_Request $req) {
    $items = $req->get_json_params()['items'] ?? [];
    $created = 0;
    foreach ($items as $item) {
        if (empty($item['title']) || empty($item['body'])) continue;
        $exists = get_page_by_path($item['slug'], OBJECT, 'post');
        if ($exists) continue; // 幂等
        $post_id = wp_insert_post([
            'post_title'   => $item['title'],
            'post_name'    => $item['slug'],
            'post_content' => wp_kses_post($item['body']),
            'post_excerpt' => $item['summary'] ?? '',
            'post_status'  => 'publish',
            'post_type'    => 'post',
        ]);
        if ($post_id) {
            update_post_meta($post_id, 'forge_source', $item['source'] ?? '');
            $created++;
        }
    }
    return rest_ensure_response(['created' => $created, 'skipped' => count($items) - $created]);
}
```

## 通用 CMS / 自建站参考实现（Node/Express）

```js
app.post('/internal-api/v1/content/import', (req, res) => {
  if (req.get('X-Internal-Token') !== process.env.SITE_IMPORT_TOKEN) {
    return res.status(401).json({ error: 'bad token' });
  }
  let created = 0, skipped = 0;
  for (const item of req.body.items ?? []) {
    if (!item.title || !item.slug || !item.body) { skipped++; continue; }
    if (db.findBySlug(item.slug)) { skipped++; continue; }   // 幂等
    db.insert({ slug: item.slug, title: item.title, body: item.body, type: item.type ?? 'news' });
    created++;
  }
  res.json({ created, skipped });
});
```

## 安全要点

1. Token 长度 ≥ 16 且走 HTTPS 传输（不要放在 URL 参数里）
2. body 必须过 HTML 净化（白名单标签：p/h3/h4/ul/ol/li/a[href]/strong/em——脚本与事件属性一律剥除）
3. 限流（建议 ≤10 次/分钟），成功响应里回传 created/skipped 供车间核对
