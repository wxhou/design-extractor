## Why

应用部署到 Vercel 后数据全部丢失——当前使用 sql.js / better-sqlite3 读写本地 `refero.db` 文件，Vercel serverless 环境无持久文件系统，每次函数调用都是全新环境，数据库文件不存在。

## What Changes

- 新增 Turso (libSQL) 远程数据库层，替代本地 SQLite 文件读取
- 3 个 API 路由（`/api/cards`、`/api/card/[id]`、`/api/extract`）从 sql.js 切换到 `@libsql/client`
- 新增数据上传脚本 `scripts/upload-to-turso.cjs`，将本地 refero.db 数据一次性推送到 Turso
- 新增共享数据库连接模块 `src/db.js`
- 本地开发脚本（`init-db.cjs`、`sync-from-refero.js`）保持 better-sqlite3 不变

## Capabilities

### New Capabilities
- `turso-db`: Turso 远程数据库连接模块——统一的数据库访问层，API 路由通过此模块连接 Turso
- `data-upload`: 本地数据上传工具——将本地 SQLite 数据推送到 Turso 的脚本

### Modified Capabilities

（无现有 specs）

## Impact

- **代码**: `src/db.js`（新增）、`app/api/cards/route.js`、`app/api/card/[id]/route.js`、`app/api/extract/route.js`、`scripts/upload-to-turso.cjs`（新增）
- **依赖**: 新增 `@libsql/client`，移除 `sql.js`（仅从 API 路由移除，本地脚本保留）
- **环境变量**: `TURSO_URL`、`TURSO_AUTH_TOKEN`（已在 `.env.local` 配置，Vercel Dashboard 需同步配置）
- **部署**: 部署前需运行上传脚本初始化 Turso 数据
