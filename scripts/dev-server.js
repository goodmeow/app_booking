import { config } from "dotenv";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: path.resolve(__dirname, "../.env") });

const serverPort = process.env.SERVER_PORT || 5000;
const host = process.env.HOST || "localhost";

console.log(`Starting server development on ${host}:${serverPort}`);

// Set environment variables for the server
process.env.PORT = serverPort;
process.env.HOST = host;

const nodemonProcess = spawn("nodemon", ["./server/server.js"], {
  stdio: "inherit",
  shell: true,
  cwd: path.resolve(__dirname, "../"),
  env: { ...process.env, PORT: serverPort, HOST: host },
});

nodemonProcess.on("error", (error) => {
  console.error("Error starting nodemon:", error);
  process.exit(1);
});

nodemonProcess.on("close", (code) => {
  console.log(`Nodemon process exited with code ${code}`);
  process.exit(code);
});
