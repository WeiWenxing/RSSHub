# RSSHub Redis 缓存清除指南

本文档说明了如何清除 RSSHub 使用 Redis 作为缓存后端时的路由级别缓存。这在调试路由或希望强制刷新所有路由的 Feed 内容时非常有用。

## 清除路由级别缓存

以下命令将删除所有已缓存的路由（Feed 输出）及其对应的 TTL（Time To Live，生存时间）记录。执行这些命令后，下次请求任何路由时，RSSHub 都会重新执行该路由的 `handler` 函数来生成新的 Feed 内容。

**重要提示：**
*   这些命令假定您的 Redis 实例中 RSSHub 的缓存键前缀是 `rsshub:`。如果您的配置中 `CACHE_PREFIX` (或 `config.cache.prefix`) 不同，请相应修改命令中的前缀。
*   执行这些命令会清除 **所有** 路由的缓存，不仅仅是特定某个路由。

在您的 RSSHub 服务器或任何可以访问 Redis 实例的终端中执行以下命令：

1.  **删除路由缓存数据：**
    ```bash
    redis-cli KEYS "rsshub:koa-redis-cache:*" | xargs redis-cli DEL
    ```
    这条命令会查找所有以 `rsshub:koa-redis-cache:` 开头的键（这些是实际的路由缓存内容）并将它们删除。

2.  **删除路由缓存的TTL记录：**
    ```bash
    redis-cli KEYS "rsshub:cacheTtl:rsshub:koa-redis-cache:*" | xargs redis-cli DEL
    ```
    这条命令会查找并删除与上述路由缓存相关的TTL管理键。

成功执行后，您应该会看到类似 `(integer) X` 的输出，其中 `X` 是被删除的键的数量。

## 关于内容缓存 (`cache.tryGet`)

请注意，上述命令 **不会** 清除由路由代码内部通过 `cache.tryGet()` 创建的内容缓存（例如，缓存的网页HTML、API响应等）。

*   内容缓存的键通常是 URL 字符串本身（例如 `https://example.com/page1.html`）。
*   这些缓存有其自身的 TTL（可以是全局默认的，也可以是在 `cache.tryGet` 调用时自定义的）。

如果您也需要清除特定的内容缓存，您需要知道该内容的URL（即用作缓存键的URL），然后使用：
```bash
redis-cli DEL "内容缓存的URL键名"
# 例如: redis-cli DEL "https://xiurenwang.me/?k=%E7%A7%80%E4%BA%BA%E7%BD%91&page=1"

# 同时，也可能需要删除其对应的TTL管理键（如果存在）
redis-cli DEL "rsshub:cacheTtl:内容缓存的URL键名"
# 例如: redis-cli DEL "rsshub:cacheTtl:https://xiurenwang.me/?k=%E7%A7%80%E4%BA%BA%E7%BD%91&page=1"
```

在调试特定路由时，通常先清除路由缓存，如果问题依旧或者您怀疑是内容缓存过旧，再考虑清除相关的内容缓存。
