## 1. 依赖与数据库连接模块

- [x] 1.1 安装 @libsql/client 依赖
- [x] 1.2 创建 src/db.js — 共享 Turso 客户端模块，从环境变量初始化，导出 getDb()

## 2. 上传脚本

- [x] 2.1 创建 scripts/upload-to-turso.cjs — 读取本地 refero.db，创建 Turso 表结构，批量上传 cards 和 categories 数据
- [x] 2.2 运行上传脚本，验证 Turso 数据正确

## 3. API 路由改造

- [x] 3.1 改造 app/api/cards/route.js — sql.js → src/db.js (Turso)
- [x] 3.2 改造 app/api/card/[id]/route.js — sql.js → src/db.js (Turso)
- [x] 3.3 改造 app/api/extract/route.js — sql.js → src/db.js (Turso)

## 4. 验证

- [x] 4.1 本地 dev 启动，首页卡片列表正常加载
- [x] 4.2 详情页正常显示
- [x] 4.3 提取新 URL 功能正常（写入 Turso）
