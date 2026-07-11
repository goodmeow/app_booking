import { config } from "dotenv";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: path.resolve(__dirname, "../.env") });

const clientPort = process.env.PORT || 3000;
const serverPort = process.env.SERVER_PORT || 5000;
const host = process.env.HOST || "localhost";

console.log(`Starting development mode:`);
console.log(`- Client on ${host}:${clientPort}`);
console.log(`- Server on ${host}:${serverPort}`);

const concurrentlyProcess = spawn(
  "concurrently",
  [`"node scripts/dev-client.js"`, `"node scripts/dev-server.js"`],
  {
    stdio: "inherit",
    shell: true,
    cwd: path.resolve(__dirname, "../"),
  }
);

concurrentlyProcess.on("error", (error) => {
  console.error("Error starting development mode:", error);
  process.exit(1);
});

concurrentlyProcess.on("close", (code) => {
  console.log(`Development mode exited with code ${code}`);
  process.exit(code);
});
