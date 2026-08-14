## Context

当前 `extractDesignTokens` 函数直接接收 URL 传给 Playwright，没有任何验证。用户输入无效内容时，后端报错信息不友好。重复提取同一网站会创建多条记录。

## Goals / Non-Goals

**Goals:**
- 拦截明显无效的 URL 输入
- 检测重复网站，按主域名匹配
- 返回友好的中文错误消息
- 不浪费资源重复提取相同网站

**Non-Goals:**
- 不保证所有无效域名都能被拦截（网络层面无法访问的域名仍会失败）
- 不做子页面匹配（github.com 和 github.com/user 是两个独立提取）

## Decisions

### 1. URL 验证分层

**决策**: 前端轻量验证 + 后端兜底

```
前端验证（立即反馈）:
- 正则检查是否为域名格式
- 输入时实时提示格式错误

后端验证（最终保障）:
- 规范化 URL
- 检测重复
- 捕获 Playwright 错误
```

**理由**: 前端验证提升交互体验，后端验证防止绕过。

### 2. 主域名去重

**决策**: `www.github.com` 和 `github.com` 视为同一网站

```javascript
// 规范化函数
function normalizeUrl(input) {
  let url = input.trim().toLowerCase();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  // 去除 www 前缀用于匹配
  const host = new URL(url).hostname.replace(/^www\./, '');
  return { full: url, normalized: host };
}
```

**理由**: 用户通常不区分 www 和非 www，同一网站应该只有一条记录。

### 3. 重复时返回已有卡片

**决策**: 重复检测到后返回 `cardId` 和 `isDuplicate: true`

```json
{
  "success": true,
  "cardId": "uuid",
  "isDuplicate": true,
  "message": "该网站已提取过"
}
```

前端收到 `isDuplicate` 时：
- 仍跳转到详情页
- 可选：显示 toast 提示"已跳转到已有记录"

### 4. 错误消息友好化

**决策**: 捕获 Playwright 错误，转换为中文消息

| Playwright 错误 | 用户消息 |
|----------------|----------|
| `net::ERR_NAME_NOT_RESOLVED` | "无法访问该网站，请检查域名是否正确" |
| `net::ERR_CONNECTION_REFUSED` | "连接被拒绝，网站可能暂时不可用" |
| `net::ERR_TIMED_OUT` | "访问超时，请稍后重试" |
| 其他 | "提取失败，请检查网址是否正确" |

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 用户输入 `example.invalid`（语法正确但域名不存在） | 后端会失败，但返回友好消息 |
| 提取超时 | 设置 30s 超时，返回超时错误 |
| 数据库查询性能 | 仅在提取前查一次，简单 SQL |

## Open Questions

1. 是否需要限制同一 IP/域名的提取频率？
   - 暂不考虑，防止简单爬虫即可
