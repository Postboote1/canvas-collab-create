import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Start vite dev server
const viteProcess = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true
});

// Start PeerJS server
const peerProcess = spawn('node', ['server.mjs'], {
  stdio: 'inherit',
  shell: true
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down servers...');
  viteProcess.kill();
  peerProcess.kill();
  process.exit(0);
});

console.log('Development servers started! Press Ctrl+C to stop all servers.');