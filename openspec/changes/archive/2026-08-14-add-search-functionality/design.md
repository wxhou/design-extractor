## Context

用户提取网站后，希望通过网站名称快速找到之前提取过的设计。当前图库只有分类筛选，没有搜索功能。

## Goals / Non-Goals

**Goals:**
- 支持按网站名称（部分）搜索
- 搜索结果实时更新
- 清空搜索返回全部卡片

**Non-Goals:**
- 不支持模糊匹配（LIKE %keyword%）
- 不支持多关键词搜索

## Decisions

### 1. 搜索框位置

**决策**: 放在分类筛选按钮左侧

```
[🔍 搜索... ] [全部(405)] [AI(57)] [SaaS(40)] ...
```

### 2. 搜索实现

**决策**: 使用现有 `/api/cards` 接口，添加 `?search=keyword` 参数

- 保持分页功能
- 搜索时清除分类筛选
- 支持 debounce（300ms）避免频繁请求

### 3. 搜索逻辑

使用 SQL LIKE 匹配：
```sql
WHERE name LIKE '%keyword%' OR url LIKE '%keyword%'
```

## Risks / Trade-offs

| Risk | Mitigation |
|------|------------|
| 搜索性能（大量数据） | 添加 LIMIT 和索引 |
| 空搜索结果 | 显示"未找到"提示 |
