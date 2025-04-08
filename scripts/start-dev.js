
const { spawn } = require('child_process');
const path = require('path');

// Start vite dev server
const viteProcess = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true
});

// Start PeerJS server
const peerProcess = spawn('node', ['server.js'], {
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
