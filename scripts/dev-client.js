import { config } from "dotenv";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: path.resolve(__dirname, "../.env") });

const port = process.env.PORT || 3000;
const host = process.env.HOST || "localhost";

console.log(`Starting client development server on ${host}:${port}`);

const viteProcess = spawn("vite", ["--host", host, "--port", port], {
  stdio: "inherit",
  shell: true,
  cwd: path.resolve(__dirname, "../"),
});

viteProcess.on("error", (error) => {
  console.error("Error starting vite:", error);
  process.exit(1);
});

viteProcess.on("close", (code) => {
  console.log(`Vite process exited with code ${code}`);
  process.exit(code);
});
