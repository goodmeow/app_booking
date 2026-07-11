import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();
const CLIENT_PORT = process.env.PORT || 3000;
const SERVER_PORT = process.env.SERVER_PORT || 5000;
const HOST = process.env.HOST || "localhost";

// Read original package.json
const originalPackage = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../package.json"), "utf8")
);

// Ensure directories exist
const serverDir = path.join(__dirname, "../dist/server");
const clientDir = path.join(__dirname, "../dist/client");

if (!fs.existsSync(serverDir)) {
  fs.mkdirSync(serverDir, { recursive: true });
}

if (!fs.existsSync(clientDir)) {
  fs.mkdirSync(clientDir, { recursive: true });
}

// Copy .env files to server directory
const envFiles = [".env.production"];
envFiles.forEach((envFile) => {
  const envPath = path.join(__dirname, "..", envFile);
  if (fs.existsSync(envPath)) {
    fs.copyFileSync(envPath, path.join(serverDir, envFile));
  }
});

// Copy vite.config.js to client directory for preview proxy configuration
const viteConfigPath = path.join(__dirname, "..", "vite.config.js");
if (fs.existsSync(viteConfigPath)) {
  fs.copyFileSync(viteConfigPath, path.join(clientDir, "vite.config.js"));
}

// Create package.json for server to use CommonJS
const serverPackage = {
  name: `${originalPackage.name}-server`,
  version: originalPackage.version,
  type: "commonjs",
  main: "server.bundle.js",
  scripts: {
    start: "node server.bundle.js",
  },
  engines: {
    node: ">=14.0.0",
  },
};

fs.writeFileSync(
  path.join(serverDir, "package.json"),
  JSON.stringify(serverPackage, null, 2)
);

// Create README files
const serverReadme = `# ${originalPackage.name} - Server

## Running
\`\`\`bash
node server.bundle.js
\`\`\`

## Environment
Make sure to configure your environment variables in .env files.

Server will run on port: ${SERVER_PORT}

Run from root directory to access node_modules.
`;

const clientReadme = `# ${originalPackage.name} - Client

## Running with Vite Preview
\`\`\`bash
vite preview --outDir . --port ${CLIENT_PORT}
\`\`\`

This will serve the static files on http://${HOST}:${CLIENT_PORT} using Vite preview server.

## API Proxy Configuration
The vite.config.js file is included and configured with proxy settings:
- \`/api\` requests are proxied to \`http://${HOST}:${SERVER_PORT}/api/\`
- \`/socket.io\` requests are proxied to \`ws://${HOST}:${SERVER_PORT}\`

Make sure your backend server is running on port ${SERVER_PORT} for API calls to work.

Run from root directory to access node_modules.
`;

fs.writeFileSync(path.join(serverDir, "README.md"), serverReadme);
fs.writeFileSync(path.join(clientDir, "README.md"), clientReadme);

console.log("✅ Environment files copied to server directory");
console.log("✅ Vite config copied to client directory");
console.log("✅ README files created");
console.log("");
console.log("📁 Build structure:");
console.log("├── dist/");
console.log("│   ├── client/          # Frontend static files");
console.log("│   │   ├── index.html");
console.log("│   │   ├── assets/");
console.log("│   │   ├── vite.config.js");
console.log("│   │   └── README.md");
console.log("│   └── server/          # Backend bundle");
console.log("│       ├── server.bundle.js");
console.log("│       ├── .env.*");
console.log("│       └── README.md");
console.log("");
console.log("🚀 Configuration:");
console.log(`   Client Port: ${CLIENT_PORT}`);
console.log(`   Server Port: ${SERVER_PORT}`);
console.log(`   Host: ${HOST}`);
