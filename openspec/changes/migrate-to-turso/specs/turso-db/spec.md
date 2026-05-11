## ADDED Requirements

### Requirement: Database connection module
系统 SHALL 提供 `src/db.js` 模块，导出 Turso 数据库客户端实例，供 API 路由复用。客户端 SHALL 从环境变量 `TURSO_URL` 和 `TURSO_AUTH_TOKEN` 初始化。

#### Scenario: 正常初始化
- **WHEN** 环境变量 TURSO_URL 和 TURSO_AUTH_TOKEN 已配置
- **THEN** `getDb()` 返回可用的 libsql Client 实例

#### Scenario: 缺少环境变量
- **WHEN** TURSO_URL 或 TURSO_AUTH_TOKEN 未配置
- **THEN** API 请求 SHALL 返回 500 错误，包含明确的配置缺失提示

### Requirement: Cards list API uses Turso
`/api/cards` 路由 SHALL 使用 `src/db.js` 提供的 Turso 客户端查询数据，取代 sql.js 文件读取。

#### Scenario: 分页查询
- **WHEN** GET /api/cards?page=1&limit=20
- **THEN** 从 Turso 查询 cards 表并返回分页结果，结构与当前保持一致

#### Scenario: 分类筛选
- **WHEN** GET /api/cards?category=dark
- **THEN** 从 Turso 查询 categories 和 cards 表，返回对应分类的卡片

#### Scenario: 搜索
- **WHEN** GET /api/cards?search=apple
- **THEN** 从 Turso 查询匹配 name 或 url 的卡片

### Requirement: Card detail API uses Turso
`/api/card/[id]` 路由 SHALL 使用 Turso 客户端查询单条卡片。

#### Scenario: 查询已存在的卡片
- **WHEN** GET /api/card/<valid-id>
- **THEN** 返回该卡片的完整数据

#### Scenario: 卡片不存在
- **WHEN** GET /api/card/<nonexistent-id>
- **THEN** 返回 404

### Requirement: Extract API uses Turso
`/api/extract` 路由 SHALL 使用 Turso 客户端写入新提取的卡片数据。

#### Scenario: 新站点提取
- **WHEN** POST /api/extract 提取一个新站点成功
- **THEN** 数据写入 Turso 数据库并返回 cardId

#### Scenario: 重复检测
- **WHEN** POST /api/extract 提取已存在的站点
- **THEN** 从 Turso 查询已有记录并返回 isDuplicate: true
