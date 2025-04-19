import { exec, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { startMetricsCollector } from '../server/metrics-collector.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Check if this is first run
const pbDataPath = path.join(PROJECT_ROOT, 'server/pb_data');
const isFirstRun = !fs.existsSync(pbDataPath);

// Ensure server directories exist
const migrationsPath = path.join(PROJECT_ROOT, 'server/pb_migrations');
if (!fs.existsSync(migrationsPath)) {
  fs.mkdirSync(migrationsPath, { recursive: true });
}

// Check if we're in production mode
const isProduction = process.argv.includes('--prod') || process.env.NODE_ENV === 'production';
console.log(`Starting in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);

// Copy server.mjs to dist/server.js if in production mode
if (isProduction) {
  const serverMjsPath = path.join(PROJECT_ROOT, 'server.mjs');
  const distPath = path.join(PROJECT_ROOT, 'dist');
  const serverJsPath = path.join(distPath, 'server.js');
  
  if (!fs.existsSync(distPath)) {
    console.log('Creating dist directory...');
    fs.mkdirSync(distPath, { recursive: true });
  }
  
  console.log(`Copying server file from ${serverMjsPath} to ${serverJsPath}...`);
  try {
    fs.copyFileSync(serverMjsPath, serverJsPath);
    console.log('Server file copied successfully.');
  } catch (error) {
    console.error('Error copying server file:', error);
    process.exit(1);
  }
}

// Start PocketBase server
const pbPath = path.join(PROJECT_ROOT, 'server/pocketbase');
const command = `${pbPath} serve --http="0.0.0.0:8090"`;

console.log('Starting PocketBase server...');
const pbProcess = exec(command);

pbProcess.stdout.on('data', (data) => {
  console.log(`PocketBase: ${data}`);
  
  // If we see that PocketBase has started, launch the metrics collector
  if (data.includes('Server started at')) {
    console.log('PocketBase server detected as running, starting metrics collector...');
    startMetricsCollector();
  }
});

pbProcess.stderr.on('data', (data) => {
  console.error(`PocketBase Error: ${data}`);
});

if (isFirstRun) {
  console.log('First run detected. An admin setup will be required at http://localhost:8090/_/');
}

// Start PeerJS server
console.log('Starting PeerJS server...');
const peerProcess = spawn('npx', ['peerjs', '--port', '9000'], {
  stdio: 'inherit'
});

// In production mode, start Express server, otherwise start Vite dev server
if (isProduction) {
  console.log('Starting Express server (production)...');
  const serverPath = path.join(PROJECT_ROOT, 'dist', 'server.js');
  const expressProcess = spawn('node', [serverPath], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });
  
  // Update cleanup to include Express server
  process.on('SIGINT', () => {
    console.log('Shutting down servers...');
    pbProcess.kill();
    peerProcess.kill();
    expressProcess.kill();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('Shutting down servers...');
    pbProcess.kill();
    peerProcess.kill();
    expressProcess.kill();
    process.exit(0);
  });
} else {
  // Development mode
  console.log('Starting Vite dev server...');
  const viteProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit'
  });
  
  // Handle process termination
  process.on('SIGINT', () => {
    console.log('Shutting down servers...');
    pbProcess.kill();
    peerProcess.kill();
    viteProcess.kill();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    console.log('Shutting down servers...');
    pbProcess.kill();
    peerProcess.kill();
    viteProcess.kill();
    process.exit(0);
  });
}

console.log(`${isProduction ? 'Production' : 'Development'} services started! Press Ctrl+C to stop all servers.`);