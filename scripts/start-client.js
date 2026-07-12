import { spawn } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const CLIENT_PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// Serve reconstructed client build; dist remains immutable baseline evidence.
const clientDir = path.join(__dirname, '..', 'build', 'client');

console.log(`🚀 Starting client on ${HOST}:${CLIENT_PORT}...`);

const viteProcess = spawn('vite', ['preview', '--outDir', '.', '--host', HOST, '--port', CLIENT_PORT], {
  cwd: clientDir,
  stdio: 'inherit',
  shell: true
});

viteProcess.on('error', (error) => {
  console.error('Failed to start client:', error);
  process.exit(1);
});

viteProcess.on('close', (code) => {
  console.log(`Client process exited with code ${code}`);
  process.exit(code);
});

// Handle CTRL+C
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping client...');
  viteProcess.kill('SIGINT');
});
