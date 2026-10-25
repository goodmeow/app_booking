import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundlePath = path.join(root, "dist/server/server.bundle.js");
const args = process.argv.slice(2);

if (args.length !== 2 || args[0] !== "--output" || !args[1]) {
  console.error("Usage: node scripts/reconstruct-server.mjs --output <archive.txt>");
  console.error("Recovery output is a non-runnable archive and cannot target the live server/ tree.");
  process.exit(1);
}

const outputPath = path.resolve(root, args[1]);
const serverPath = path.join(root, "server");

if (path.extname(outputPath) !== ".txt") {
  console.error("Recovery output must use .txt because the extracted artifact is non-runnable archival evidence.");
  process.exit(1);
}

const isWithin = (parent, candidate) => {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const resolveThroughExistingParent = (candidate) => {
  const missing = [];
  let current = candidate;

  while (!fs.existsSync(current)) {
    missing.unshift(path.basename(current));
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return path.join(fs.realpathSync(current), ...missing);
};

const resolvedServerPath = fs.realpathSync(serverPath);
const resolvedOutputPath = resolveThroughExistingParent(outputPath);

if (
  isWithin(serverPath, outputPath) ||
  isWithin(resolvedServerPath, resolvedOutputPath)
) {
  console.error("Refusing recovery output inside the live server/ tree.");
  process.exit(1);
}

const bundle = fs.readFileSync(bundlePath, "utf8").replace(/\r\n/g, "\n");

const startMarker = ";// ./server/pglibs/schema.js";
const endMarker = "/* harmony default export */ const routes = (routes_router);";
const start = bundle.indexOf(startMarker);
const end = bundle.indexOf(endMarker, start);

if (start < 0 || end < 0) {
  throw new Error("Server route module markers not found in baseline bundle");
}

let source = bundle.slice(start, end + endMarker.length);

source = source
  .replace(/^;\/\/ external .*\n(?:const|var) .*?require\(.*?\);\n/gm, "")
  .replace(/^\/\/ EXTERNAL MODULE: external "express"\nvar external_express_ = .*?;\n/gm, "")
  .replace(/^\/\/ EXTERNAL MODULE: \.\/config\/config\.js \+ 1 modules\nvar config = .*?;\n/gm, "")
  .replaceAll("external_express_jwt_namespaceObject", "expressJwt")
  .replaceAll("external_express_", "express")
  .replaceAll("external_pg_namespaceObject", "pg")
  .replaceAll("external_moment_namespaceObject", "moment")
  .replaceAll("external_jsonwebtoken_namespaceObject", "jwt")
  .replaceAll("external_bcrypt_namespaceObject", "bcrypt")
  .replaceAll("external_dayjs_namespaceObject", "dayjs")
  .replaceAll("config/* default */.A", "config")
  .split("\n")
  .filter((line) => !line.includes("extend_js_namespaceObject = require"))
  .map((line) => line.trimEnd().replace(/^ +\t/, "\t"))
  .join("\n");

const header = `// NON-RUNNABLE ARCHIVE: mechanically recovered from immutable dist/server/server.bundle.js.\n` +
  `// Historical dependency/import paths are intentionally preserved as evidence only.\n` +
  `import express from "express";\n` +
  `import pg from "pg";\n` +
  `import moment from "moment";\n` +
  `import jwt from "jsonwebtoken";\n` +
  `import expressJwt from "express-jwt";\n` +
  `import bcrypt from "bcrypt";\n` +
  `import dayjs from "dayjs";\n` +
  `import config from "../../config/config.js";\n\n`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${header}${source.trim()}\n\nexport default routes;\n`);
console.log(`Recovered ${path.relative(root, outputPath)}`);
