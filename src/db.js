import { createClient } from '@libsql/client/http';
import initSqlJs from 'sql.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const _thisDir = path.dirname(fileURLToPath(import.meta.url));
// standalone 模式检测：在 standalone 目录下运行时会存在 server.js
const isStandalone = process.env.NODE_ENV === 'production' &&
  fs.existsSync(path.join(process.cwd(), 'server.js'));
// standalone 模式下 db 在 /app/refero.db（cwd 是 /app/.next/standalone）
// 非 standalone 模式下 db 在 _thisDir/../refero.db
const DB_PATH = isStandalone
  ? '/app/refero.db'
  : path.join(_thisDir, '..', 'refero.db');

const MIGRATIONS = [
  'ALTER TABLE cards ADD COLUMN spacing TEXT',
  'ALTER TABLE cards ADD COLUMN shadows TEXT',
  'ALTER TABLE cards ADD COLUMN border_radius TEXT',
];

// wasm 文件位置：运行时动态检测
const locateFile = file => {
  if (process.env.NODE_ENV === 'production') {
    const standalonePath = path.join(process.cwd(), '.next', 'standalone', file);
    if (fs.existsSync(standalonePath)) {
      return standalonePath;
    }
  }
  return path.join(_thisDir, '..', 'node_modules', 'sql.js', 'dist', file);
};

const _sqlPromise = initSqlJs({ locateFile });

let tursoClient = null;
let _dbInstance = null;

function getTursoDb() {
  if (!tursoClient) {
    const url = process.env.TURSO_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    if (!url || !authToken) return null;
    const httpsUrl = url.replace(/^libsql:\/\//, 'https://');
    tursoClient = createClient({ url: httpsUrl, authToken });
  }
  return tursoClient;
}

function normalizeQuery(sql, args = []) {
  if (typeof sql === 'object' && sql !== null) {
    return {
      sql: sql.sql,
      args: sql.args || [],
    };
  }
  return { sql, args };
}

function executeSqlJsStatement(db, sql, args = []) {
  const stm = db.prepare(sql);
  if (args.length > 0) stm.bind(args.map(String));
  const columns = stm.getColumnNames();
  const rows = [];
  while (stm.step()) {
    const values = stm.get();
    // 转换为 {col: val} 格式，与 Turso 保持一致
    const row = {};
    columns.forEach((col, i) => { row[col] = values[i]; });
    rows.push(row);
  }
  stm.free();
  return {
    rows,
    rowsAffected: isWriteStatement(sql) ? db.getRowsModified() : 0,
  };
}

function isWriteStatement(sql) {
  return /^(INSERT|UPDATE|DELETE)/i.test(sql.trim());
}

async function getSqlDb() {
  if (!_dbInstance) {
    const SQL = await _sqlPromise;
    if (fs.existsSync(DB_PATH)) {
      const buf = fs.readFileSync(DB_PATH);
      _dbInstance = new SQL.Database(buf);
    } else {
      const db = new SQL.Database();
      db.run(`
        CREATE TABLE IF NOT EXISTS cards (
          id           TEXT PRIMARY KEY,
          name         TEXT NOT NULL,
          url          TEXT,
          preview      TEXT,
          video_url    TEXT,
          screenshot   TEXT,
          colors       TEXT,
          fonts        TEXT,
          north_star   TEXT,
          color_scheme TEXT,
          category     TEXT,
          typography   TEXT,
          type_scale   TEXT,
          gradient     TEXT,
          spacing      TEXT,
          shadows      TEXT,
          border_radius TEXT,
          raw_data     TEXT,
          created_at   TEXT
        )
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS categories (
          slug       TEXT PRIMARY KEY,
          name_en    TEXT NOT NULL,
          name_zh    TEXT NOT NULL,
          sort_order INTEGER DEFAULT 0
        )
      `);
      _dbInstance = db;
    }
  }
  return _dbInstance;
}

// 统一的 db 接口，屏蔽 Turso/sql.js 差异
// 支持两种调用方式: execute(sql, args) 或 execute({ sql, args })
export async function getDb() {
  const turso = getTursoDb();
  if (turso) {
    return {
      async execute(sql, args = []) {
        // 兼容对象格式调用
        const query = normalizeQuery(sql, args);
        const result = await turso.execute(query);
        return { rows: result.rows, rowsAffected: Number(result.rowsAffected || 0) };
      },
      async batch(statements, mode = 'write') {
        const results = await turso.batch(
          statements.map(statement => normalizeQuery(statement)),
          mode,
        );
        return results.map(result => ({
          rows: result.rows,
          rowsAffected: Number(result.rowsAffected || 0),
        }));
      },
    };
  }

  // 本地 sql.js
  const db = await getSqlDb();
  return {
    async execute(sql, args = []) {
      // 兼容对象格式调用
      const query = normalizeQuery(sql, args);
      const result = executeSqlJsStatement(db, query.sql, query.args);
      if (isWriteStatement(query.sql)) {
        const data = db.export();
        fs.writeFileSync(DB_PATH, Buffer.from(data));
      }
      return result;
    },
    async batch(statements) {
      const queries = statements.map(statement => normalizeQuery(statement));
      const results = [];
      db.run('BEGIN');
      try {
        for (const query of queries) {
          results.push(executeSqlJsStatement(db, query.sql, query.args));
        }
        db.run('COMMIT');
      } catch (error) {
        db.run('ROLLBACK');
        throw error;
      }
      if (queries.some(query => isWriteStatement(query.sql))) {
        const data = db.export();
        fs.writeFileSync(DB_PATH, Buffer.from(data));
      }
      return results;
    },
  };
}

// 仅供 extract route 内部保存截图到本地文件时用（不需要数据库）
export { DB_PATH };
