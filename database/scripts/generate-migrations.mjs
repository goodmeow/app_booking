import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "../..");
const sourcePath = path.join(rootDir, "bjb.sql");
const outputDir = path.join(rootDir, "database/migrations");
const source = fs.readFileSync(sourcePath, "utf8").replace(/\r\n/g, "\n");

const marker = /^--\n-- Name: (.+?); Type: (.+?); Schema: (.*?); Owner: (.*?)\n--\n/gm;
const markers = [...source.matchAll(marker)];
const groups = { TABLE: [], CONSTRAINT: [], FUNCTION: [] };

for (let index = 0; index < markers.length; index += 1) {
  const current = markers[index];
  const next = markers[index + 1];
  const type = current[2];

  if (!Object.hasOwn(groups, type)) continue;

  const blockEnd = next ? next.index : source.length;
  let block = source.slice(current.index, blockEnd).trim();

  block = block
    .replace(/^--\n-- Name:.*?\n--\n\n/s, "")
    .replace(/\n*ALTER (?:TABLE|FUNCTION) [\s\S]*? OWNER TO postgres;\n*/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd().replace(/^ +\t/, "\t"))
    .join("\n")
    .trim();

  if (block) groups[type].push(block);
}

const expected = { TABLE: 7, CONSTRAINT: 9, FUNCTION: 28 };
for (const [type, count] of Object.entries(expected)) {
  if (groups[type].length !== count) {
    throw new Error(`Expected ${count} ${type} blocks, found ${groups[type].length}`);
  }
}

const header = (description) =>
  [
    "-- Generated from immutable bjb.sql by database/scripts/generate-migrations.mjs.",
    `-- ${description}`,
    "-- Legacy OWNER TO postgres clauses intentionally removed.",
    "\\set ON_ERROR_STOP on",
    "",
    "BEGIN;",
    "",
  ].join("\n");

const footer = "\n\nCOMMIT;\n";
const files = [
  [
    "001_prerequisites.sql",
    [
      "-- PostgreSQL 14 provides gen_random_uuid() in pg_catalog.",
      "-- Keep prerequisite migration explicit for future extension requirements.",
      "\\set ON_ERROR_STOP on",
      "",
      "BEGIN;",
      "SELECT current_setting('server_version_num')::integer >= 140000",
      "  AS supported_postgresql_version;",
      "COMMIT;",
      "",
    ].join("\n"),
  ],
  [
    "002_tables.sql",
    `${header("Seven legacy public tables.")}${groups.TABLE.join("\n\n")}${footer}`,
  ],
  [
    "003_constraints.sql",
    `${header("Nine legacy primary/unique constraints; no foreign keys exist.")}${groups.CONSTRAINT.join("\n\n")}${footer}`,
  ],
  [
    "004_functions.sql",
    `${header("Twenty-eight legacy PL/pgSQL functions.")}${groups.FUNCTION.join("\n\n")}${footer}`,
  ],
];

for (const [name, content] of files) {
  fs.writeFileSync(path.join(outputDir, name), `${content.trimEnd()}\n`);
}

console.log(
  `Generated ${files.length} migrations: ${groups.TABLE.length} tables, ` +
    `${groups.CONSTRAINT.length} constraints, ${groups.FUNCTION.length} functions.`
);
