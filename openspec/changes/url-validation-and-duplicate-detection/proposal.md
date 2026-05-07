## Why

当前提取功能存在两个问题：1) 用户输入无效网址（如"hello world"）时，后端直接报错，体验差；2) 重复提取同一网站会创建多条记录，浪费资源且造成数据冗余。

## What Changes

1. **URL 格式验证** — 前端和后端双重验证输入是否为有效域名格式
2. **重复网站检测** — 提取前检查数据库是否已存在该网站，按主域名匹配（github.com 和 www.github.com 视为同一网站）
3. **友好错误提示** — 无效 URL 或网络错误时返回用户友好的中文错误消息
4. **URL 规范化** — 统一处理 www 前缀、尾随斜杠等，用于重复检测

## Capabilities

### New Capabilities

- `url-validation`: 验证输入是否为有效域名格式的能力
- `duplicate-detection`: 检测网站是否已提取过的能力
- `error-handling`: 返回友好错误消息的能力

### Modified Capabilities

- `extraction-save`: 改为先检测重复再决定是否新建记录

## Impact

- **前端**: `app/page.js` — 输入验证和已有卡片提示
- **API**: `app/api/extract/route.js` — URL 规范化、重复检测、错误处理
