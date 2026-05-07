## Why

当前用户无法通过网站名称搜索已提取的设计。需要添加搜索功能，让用户能快速找到之前提取过的网站。

## What Changes

1. **添加搜索框** — 在图库顶部添加搜索输入框
2. **搜索 API** — 新增 `/api/cards/search` 端点，支持按名称搜索
3. **搜索结果展示** — 搜索时显示匹配结果，支持清空搜索返回全部

## Capabilities

### New Capabilities

- `card-search`: 按网站名称搜索卡片的能力

### Modified Capabilities

- （无）

## Impact

- **前端**: `app/page.js` — 添加搜索框和搜索逻辑
- **API**: `app/api/cards/route.js` — 添加搜索参数处理
