## Context

当前 3 个 API 路由使用 sql.js 从本地 `refero.db` 文件读取数据。sql.js 是 WASM 版 SQLite，每次请求将整个 .db 文件读入内存。Vercel serverless 环境中该文件不存在，导致部署后所有数据接口报错。

本地脚本（`init-db.cjs`、`sync-from-refero.js`）使用 better-sqlite3 原生模块写入本地文件，不涉及部署，保持不变。

## Goals / Non-Goals

**Goals:**
- API 路由可从 Turso 远程数据库读写数据
- 本地开发和 Vercel 生产环境使用同一套数据库连接代码
- 提供数据上传脚本，将已有 refero.db 数据一次性导入 Turso
- Vercel 部署后立即可用

**Non-Goals:**
- 不改造本地同步脚本（继续用 better-sqlite3）
- 不做数据库 schema 变更
- 不做连接池优化（Turso HTTP 模式自带连接管理）
- 不做离线/本地优先模式

## Decisions

### D1: 本地开发也连 Turso 远程（单轨）

**选择**: 开发和生产都连 Turso 远程数据库。

**备选**: 本地保持 sql.js + 文件，生产用 Turso（双轨）。需要维护两套连接代码，且本地数据与线上不同步时难以调试。

**理由**: Turso 免费额度足够开发使用，单轨代码量最少，数据一致性最好。

### D2: @libsql/client 作为客户端

**选择**: `@libsql/client` 的 `createClient()` HTTP 模式。

**备选**: `@libsql/sqlite3`（native binding），体积大且 Vercel 兼容性不确定。

**理由**: 官方推荐，纯 JS，与 Vercel serverless 完全兼容。

### D3: 共享 src/db.js 模块

**选择**: 创建 `src/db.js` 导出单例 client 实例，3 个 API 路由复用。

**理由**: 避免每个路由重复连接配置，统一错误处理。

### D4: 上传脚本使用 better-sqlite3 读本地 + @libsql/client 写远程

**选择**: 新增 `scripts/upload-to-turso.cjs`，从本地 refero.db 读取，批量 INSERT 到 Turso。

**理由**: better-sqlite3 已在本地可用，数据在本地，直接读取后上传最简单。

## Risks / Trade-offs

- **[延迟]** Turso HTTP 请求比本地文件读取慢 → 可接受，每次 API 调用 ~20-50ms，用户无感知
- **[数据同步]** 本地脚本同步新数据后需手动运行上传脚本 → 可在 sync 后自动触发
- **[免费额度]** Turso 免费版 500MB 存储 / 25M 行读 / 500K 行写 → 当前 ~400 条记录远低于限制
