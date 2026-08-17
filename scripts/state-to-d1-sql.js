const fs = require("fs");
const path = require("path");

const inputPath = process.argv[2];
const outputPath = process.argv[3] || "cloudflare-state-import.sql";

if (!inputPath) {
  console.error("Usage: node scripts/state-to-d1-sql.js <state-json-file> [output-sql-file]");
  process.exit(1);
}

const source = JSON.parse(fs.readFileSync(path.resolve(inputPath), "utf8"));
const state = source.state || source;
const escapedState = JSON.stringify(state).replaceAll("'", "''");
const updatedAt = new Date().toISOString();

const sql = [
  "create table if not exists lesson_app_state (",
  "  id text primary key,",
  "  state text not null,",
  "  updated_at text not null",
  ");",
  "insert into lesson_app_state (id, state, updated_at)",
  `values ('main', '${escapedState}', '${updatedAt}')`,
  "on conflict(id) do update set state = excluded.state, updated_at = excluded.updated_at;",
  "",
].join("\n");

fs.writeFileSync(path.resolve(outputPath), sql);
console.log(`D1 import SQL written to ${outputPath}`);
