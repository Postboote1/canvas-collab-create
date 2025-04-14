const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Check if PocketBase executable exists
const pbPath = path.join(__dirname, 'pocketbase');
if (!fs.existsSync(pbPath)) {
  console.error('PocketBase executable not found at:', pbPath);
  process.exit(1);
}

// Make sure data directory exists
const pbDataPath = path.join(__dirname, 'pb_data');
if (!fs.existsSync(pbDataPath)) {
  fs.mkdirSync(pbDataPath, { recursive: true });
}

// Make sure migrations directory exists
const migrationsPath = path.join(__dirname, 'pb_migrations');
if (!fs.existsSync(migrationsPath)) {
  fs.mkdirSync(migrationsPath, { recursive: true });
}

const command = `${pbPath} serve --http="0.0.0.0:8090"`;

console.log('Starting PocketBase server with command:', command);
const pbProcess = exec(command);

pbProcess.stdout.on('data', (data) => {
  console.log(`PocketBase: ${data}`);
});

pbProcess.stderr.on('data', (data) => {
  console.error(`PocketBase Error: ${data}`);
});

// Handle process termination
pbProcess.on('exit', (code) => {
  if (code !== 0) {
    console.error(`PocketBase process exited with code ${code}`);
  }
});