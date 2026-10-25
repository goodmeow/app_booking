import { config } from "dotenv";
import { spawn } from "child_process";
import { createRequire } from "module";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const nodemonCli = require.resolve("nodemon/bin/nodemon.js");

// Load environment variables
config({ path: path.resolve(__dirname, "../.env") });

const serverPort = process.env.SERVER_PORT || 9091;
const host = process.env.HOST || "localhost";

console.log(`Starting server development on ${host}:${serverPort}`);

// Set environment variables for the server
process.env.PORT = serverPort;
process.env.HOST = host;

const nodemonProcess = spawn(
  process.execPath,
  [
    nodemonCli,
    "--watch",
    "server",
    "--watch",
    "config",
    "--ext",
    "js,json",
    "./server/server.js",
  ],
  {
    stdio: "inherit",
    cwd: path.resolve(__dirname, "../"),
    env: { ...process.env, PORT: serverPort, HOST: host },
  },
);

nodemonProcess.on("error", (error) => {
  console.error("Error starting nodemon:", error);
  process.exit(1);
});

nodemonProcess.on("close", (code, signal) => {
  console.log(`Nodemon process exited ${signal ? `from ${signal}` : `with code ${code}`}`);
  process.exit(code ?? (signal === "SIGINT" ? 130 : 143));
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => nodemonProcess.kill(signal));
}
