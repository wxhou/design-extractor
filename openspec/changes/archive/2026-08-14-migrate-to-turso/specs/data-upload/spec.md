## ADDED Requirements

### Requirement: Upload local data to Turso
系统 SHALL 提供 `scripts/upload-to-turso.cjs` 脚本，读取本地 `refero.db` 并将 cards 和 categories 表数据上传到 Turso 远程数据库。

#### Scenario: 全量上传
- **WHEN** 运行 `node scripts/upload-to-turso.cjs`
- **THEN** 脚本读取本地 refero.db 的 cards 和 categories 表，使用 INSERT OR REPLACE 批量写入 Turso，输出上传数量统计

#### Scenario: 空本地数据库
- **WHEN** 本地 refero.db 不存在或 cards 表为空
- **THEN** 脚本输出提示信息并退出，不报错

#### Scenario: 幂等执行
- **WHEN** 重复运行上传脚本
- **THEN** 已存在的记录被更新，不产生重复数据
