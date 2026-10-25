import { spawn } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const CLIENT_PORT = process.env.PORT || 8081;
const HOST = process.env.HOST || 'localhost';

// Serve reconstructed client build; dist remains immutable baseline evidence.
const clientDir = path.join(__dirname, '..', 'build', 'client');
const viteBin = path.join(__dirname, '..', 'node_modules', 'vite', 'bin', 'vite.js');

console.log(`🚀 Starting client on ${HOST}:${CLIENT_PORT}...`);

const viteProcess = spawn(process.execPath, [viteBin, 'preview', '--outDir', '.', '--host', HOST, '--port', CLIENT_PORT], {
  cwd: clientDir,
  stdio: 'inherit'
});

viteProcess.on('error', (error) => {
  console.error('Failed to start client:', error);
  process.exit(1);
});

viteProcess.on('close', (code, signal) => {
  console.log(`Client process exited ${signal ? `from ${signal}` : `with code ${code}`}`);
  process.exit(code ?? (signal === 'SIGINT' ? 130 : 143));
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => viteProcess.kill(signal));
}
