import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bundlePath = path.join(root, "dist/server/server.bundle.js");
const outputPath = path.join(root, "server/routes/index.js");
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

const header = `// Mechanically recovered from immutable dist/server/server.bundle.js.\n` +
  `// Keep behavior stable until contract tests permit modular refactoring.\n` +
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
