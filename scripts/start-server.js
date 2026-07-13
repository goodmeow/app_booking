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

// Run reconstructed server build; dist remains immutable baseline evidence.
const serverDir = path.join(__dirname, "..", "build", "server");

console.log(`🚀 Starting server on ${HOST}:${SERVER_PORT}...`);

const nodeProcess = spawn(process.execPath, ["server.bundle.cjs"], {
  cwd: serverDir,
  stdio: "inherit",
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

nodeProcess.on("close", (code, signal) => {
  console.log(`Server process exited ${signal ? `from ${signal}` : `with code ${code}`}`);
  process.exit(code ?? (signal === "SIGINT" ? 130 : 143));
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => nodeProcess.kill(signal));
}
