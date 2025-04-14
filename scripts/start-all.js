import { exec, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if this is first run
const pbDataPath = path.join(__dirname, '../server/pb_data');
const isFirstRun = !fs.existsSync(pbDataPath);

const pbPath = path.join(__dirname, '../server/pocketbase');
const command = `${pbPath} serve --http="0.0.0.0:8090"`;

console.log('Starting PocketBase server...');
const pbProcess = exec(command);

pbProcess.stdout.on('data', (data) => {
  console.log(`PocketBase: ${data}`);
});

pbProcess.stderr.on('data', (data) => {
  console.error(`PocketBase Error: ${data}`);
});

if (isFirstRun) {
  console.log('First run detected. An admin setup will be required at http://localhost:8090/_/');
}

// Start PeerJS server
const peerProcess = spawn('npx', ['peerjs', '--port', '9000'], {
  stdio: 'inherit'
});

// Start Vite dev server
const viteProcess = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit'
});

// Handle process termination
const cleanup = () => {
  pbProcess.kill();
  peerProcess.kill();
  viteProcess.kill();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);