import { config } from "dotenv";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config({ path: path.resolve(__dirname, "../.env") });

const clientPort = process.env.PORT || 8081;
const serverPort = process.env.SERVER_PORT || 9091;
const host = process.env.HOST || "localhost";

console.log(`Starting development mode:`);
console.log(`- Client on ${host}:${clientPort}`);
console.log(`- Server on ${host}:${serverPort}`);

const projectDir = path.resolve(__dirname, "../");
const childScripts = ["scripts/dev-client.js", "scripts/dev-server.js"];
const children = childScripts.map((script) =>
  spawn(process.execPath, [script], {
    stdio: "inherit",
    cwd: projectDir,
    env: process.env,
  })
);

let runningChildren = children.length;
let stopping = false;
let finalExitCode = 0;

function stopChildren(signal) {
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill(signal);
    }
  }
}

function beginShutdown(signal, exitCode) {
  if (stopping) return;

  stopping = true;
  finalExitCode = exitCode;
  stopChildren(signal);
}

for (const [index, child] of children.entries()) {
  const script = childScripts[index];

  child.on("error", (error) => {
    console.error(`Error starting ${script}:`, error);
    beginShutdown("SIGTERM", 1);
  });

  child.on("close", (code, signal) => {
    runningChildren -= 1;

    if (!stopping) {
      const failed = code !== 0 || signal !== null;
      finalExitCode = failed ? code || 1 : 0;
      console.log(
        `${script} exited ${signal ? `from ${signal}` : `with code ${code}`}`
      );
      beginShutdown("SIGTERM", finalExitCode);
    }

    if (runningChildren === 0) {
      process.exitCode = finalExitCode;
    }
  });
}

process.once("SIGINT", () => beginShutdown("SIGINT", 130));
process.once("SIGTERM", () => beginShutdown("SIGTERM", 143));
