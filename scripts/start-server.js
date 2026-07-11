import { spawn } from "child_process";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const SERVER_PORT = process.env.SERVER_PORT || 5000;
const HOST = process.env.HOST || "localhost";

// Change to dist/server directory and run node server.bundle.js
const serverDir = path.join(__dirname, "..", "dist", "server");

console.log(`🚀 Starting server on ${HOST}:${SERVER_PORT}...`);

const nodeProcess = spawn("node", ["server.bundle.js"], {
  cwd: serverDir,
  stdio: "inherit",
  shell: true,
  env: {
    ...process.env,
    PORT: SERVER_PORT,
    SERVER_PORT: SERVER_PORT,
    HOST: HOST,
  },
});

nodeProcess.on("error", (error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

nodeProcess.on("close", (code) => {
  console.log(`Server process exited with code ${code}`);
  process.exit(code);
});

// Handle CTRL+C
process.on("SIGINT", () => {
  console.log("\n🛑 Stopping server...");
  nodeProcess.kill("SIGINT");
});
