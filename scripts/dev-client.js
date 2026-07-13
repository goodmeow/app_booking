import { config } from "dotenv";
import { spawn } from "child_process";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const viteCli = path.join(
  path.dirname(require.resolve("vite/package.json")),
  "bin/vite.js",
);

// Load environment variables
config({ path: path.resolve(__dirname, "../.env") });

const port = process.env.PORT || 3000;
const host = process.env.HOST || "localhost";

console.log(`Starting client development server on ${host}:${port}`);

const viteProcess = spawn(process.execPath, [viteCli, "--host", host, "--port", port], {
  stdio: "inherit",
  cwd: path.resolve(__dirname, "../"),
});

viteProcess.on("error", (error) => {
  console.error("Error starting vite:", error);
  process.exit(1);
});

viteProcess.on("close", (code, signal) => {
  console.log(`Vite process exited ${signal ? `from ${signal}` : `with code ${code}`}`);
  process.exit(code ?? (signal === "SIGINT" ? 130 : 143));
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => viteProcess.kill(signal));
}
