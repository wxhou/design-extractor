/**
 * 增量更新 video_url：拉取 refero API，填充 cards.video_url
 * 用法: node scripts/sync-video-urls.cjs
 */
const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const https = require('https');

const DB_PATH = path.join(__dirname, '..', 'refero.db');

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error on ${url}`)); }
      });
    }).on('error', reject);
  });
}

async function main() {
  const SQL = await initSqlJs();
  const db = new SQL.Database(fs.readFileSync(DB_PATH));

  // 准备更新语句
  const updateStmt = db.prepare(`
    UPDATE cards SET video_url = ? WHERE id = ?
  `);

  let total = 0;
  let updated = 0;

  for (let page = 1; page <= 20; page++) {
    const data = await fetch(`https://styles.refero.design/api/styles?page=${page}`);
    if (!data.styles || data.styles.length === 0) break;

    for (const s of data.styles) {
      if (s.previewVideoUrl) {
        updateStmt.bind([s.previewVideoUrl, s.id]);
        updateStmt.step();
        updateStmt.reset();
        updated++;
      }
      total++;
    }
    process.stdout.write(`\r  Page ${page}: ${total} cards processed, ${updated} with video ...`);
  }

  console.log(`\n  Done: ${updated}/${total} cards have video_url`);

  fs.writeFileSync(DB_PATH, db.export());
  db.close();
}

main().catch(err => { console.error('\nError:', err.message); process.exit(1); });
